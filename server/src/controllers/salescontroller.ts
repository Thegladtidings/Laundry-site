import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { defaultMaterials } from '../data/materials.js';
import { allocateItemTag, discardItemTag, releaseItemTag } from '../lib/item-tag.js';
import HttpError from '../lib/http-error.js';
import CashSale from '../models/cash-sale.js';
import ItemTagAssignment from '../models/item-tag-assignment.js';
import Order from '../models/order.js';
import PricingSettings from '../models/pricing-settings.js';
import User from '../models/user.js';

const periodSchema = z.enum(['today', '7d', '30d']).default('7d');
const pageSchema = z.coerce.number().int().min(1).max(1000).default(1);
const pageSize = 25;

const saleSchema = z.object({
    items: z.array(z.object({
        materialId: z.string().min(1),
        quantity: z.number().int().min(1).max(100),
        stainRemoval: z.boolean().default(false),
    }).strict()).min(1).max(defaultMaterials.length),
    customerName: z.string().trim().max(120).optional().default('Walk-in customer'),
    customerPhone: z.string().trim().max(20).optional().default(''),
    customerId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    newCustomer: z.object({
        firstname: z.string().trim().min(1).max(60),
        lastname: z.string().trim().min(1).max(60),
        email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
        phone: z.string().trim().min(7).max(20),
        password: z.string().min(8).max(72),
    }).strict().optional(),
    paymentMethod: z.enum(['cash', 'card', 'transfer']),
    notes: z.string().trim().max(500).optional().default(''),
}).strict().refine((input) => !(input.customerId && input.newCustomer), {
    message: 'Select an existing customer or create a new account, not both.',
});

const customerSearchSchema = z.object({
    search: z.string().trim().min(2).max(100),
}).strict();
const walkInStatusSchema = z.object({
    status: z.enum(['pending', 'picked_up', 'processing', 'ready', 'delivered', 'cancelled']),
}).strict();
const tagSearchSchema = z.object({
    code: z.string().regex(/^\d{4}$/),
    start: z.string().datetime(),
    end: z.string().datetime(),
}).strict();

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const startOfToday = (): Date => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
};

const getPeriodStart = (period: 'today' | '7d' | '30d'): Date => {
    const start = startOfToday();
    if (period === '7d') start.setUTCDate(start.getUTCDate() - 6);
    if (period === '30d') start.setUTCDate(start.getUTCDate() - 29);
    return start;
};

export const getOperationsSummary = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    const period = periodSchema.parse(req.query.period);
    const ordersPage = pageSchema.parse(req.query.ordersPage);
    const salesPage = pageSchema.parse(req.query.salesPage);
    const start = getPeriodStart(period);
    const offset = (salesPage - 1) * pageSize;
    const throughSalesPage = offset + pageSize;
    const cashierFilter = req.auth.role === 'admin'
        ? {}
        : { cashierId: new mongoose.Types.ObjectId(req.auth.userId) };
    const [orders, orderTotals, paidOrders, walkInSales, walkInTotals, unpaidOrders, activeOrders, ordersCount, walkInOrders] = await Promise.all([
        Order.find({})
            .sort({ createdAt: -1 })
            .skip((ordersPage - 1) * pageSize)
            .limit(pageSize)
            .populate<{
                userId: { firstname: string; lastname: string } | null;
                cashierId: { _id: string; firstname: string; lastname: string } | null;
            }>('userId', 'firstname lastname email phone')
            .populate<{
                userId: { firstname: string; lastname: string } | null;
                cashierId: { _id: string; firstname: string; lastname: string } | null;
            }>('cashierId', 'firstname lastname')
            .populate('items.photos', 'contentType createdAt')
            .populate('verifiedBy', 'firstname lastname'),
        Order.aggregate([
            { $match: {
                ...cashierFilter,
                paymentStatus: 'paid',
                paidAt: { $gte: start },
                verificationStatus: { $ne: 'pending' },
            } },
            { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
        ]),
        Order.find({
            ...cashierFilter,
            paymentStatus: 'paid',
            paidAt: { $gte: start },
            verificationStatus: { $ne: 'pending' },
        })
            .sort({ paidAt: -1 })
            .limit(throughSalesPage)
            .populate<{
                userId: { firstname: string; lastname: string } | null;
                cashierId: { _id: string; firstname: string; lastname: string } | null;
            }>('userId', 'firstname lastname')
            .populate<{
                userId: { firstname: string; lastname: string } | null;
                cashierId: { _id: string; firstname: string; lastname: string } | null;
            }>('cashierId', 'firstname lastname'),
        CashSale.find({ ...cashierFilter, createdAt: { $gte: start } })
            .sort({ createdAt: -1 })
            .limit(throughSalesPage)
            .populate<{
                cashierId: { firstname: string; lastname: string } | null;
                customerId: {
                    _id: mongoose.Types.ObjectId;
                    firstname: string;
                    lastname: string;
                    email: string;
                    phone: string;
                } | null;
            }>(
                'cashierId',
                'firstname lastname',
            )
            .populate(
                'customerId',
                'firstname lastname email phone',
            ),
        CashSale.aggregate([
            { $match: { ...cashierFilter, createdAt: { $gte: start } } },
            { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
        ]),
        Order.countDocuments({
            paymentStatus: { $ne: 'paid' },
            verificationStatus: { $ne: 'pending' },
            status: { $ne: 'cancelled' },
        }),
        Order.countDocuments({ status: { $nin: ['delivered', 'cancelled'] } }),
        Order.countDocuments(),
        CashSale.find(cashierFilter)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('customerId', 'firstname lastname email phone'),
    ]);

    const orderRevenue = orderTotals[0]?.revenue ?? 0;
    const walkInRevenue = walkInTotals[0]?.revenue ?? 0;
    const allSalesInRange = [
        ...paidOrders.map((order) => ({
            id: order.receiptNumber,
            receiptNumber: order.receiptNumber,
            tagCode: order.tagCode,
            customerName: order.userId && typeof order.userId === 'object' && 'firstname' in order.userId
                ? `${order.userId.firstname} ${order.userId.lastname}`
                : 'Online customer',
            items: order.items,
            total: order.total,
            paymentMethod: order.paymentMethod,
            createdAt: order.paidAt ?? order.createdAt,
            cashier: order.cashierId,
            source: 'order' as const,
        })),
        ...walkInSales.map((sale) => ({
            id: sale.id,
            receiptNumber: sale.receiptNumber,
            tagCode: sale.tagCode,
            customerName: sale.customerId && typeof sale.customerId === 'object'
                ? `${sale.customerId.firstname} ${sale.customerId.lastname}`
                : sale.customerName,
            customer: sale.customerId && typeof sale.customerId === 'object'
                ? {
                    _id: String(sale.customerId._id),
                    firstname: sale.customerId.firstname,
                    lastname: sale.customerId.lastname,
                    email: sale.customerId.email,
                    phone: sale.customerId.phone,
                }
                : null,
            items: sale.items,
            total: sale.total,
            paymentMethod: sale.paymentMethod,
            createdAt: sale.createdAt,
            cashier: sale.cashierId,
            source: 'walk-in' as const,
        })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const salesCount = (orderTotals[0]?.count ?? 0) + (walkInTotals[0]?.count ?? 0);

    res.json({
        period,
        ordersPage,
        ordersPageCount: Math.max(1, Math.ceil(ordersCount / pageSize)),
        salesPage,
        salesPageCount: Math.max(1, Math.ceil(salesCount / pageSize)),
        summary: {
            revenue: orderRevenue + walkInRevenue,
            salesCount,
            ordersCount,
            unpaidOrders,
            activeOrders,
        },
        orders,
        walkInOrders,
        sales: allSalesInRange.slice(offset, offset + pageSize),
    });
};

export const searchCustomers = async (req: Request, res: Response): Promise<void> => {
    const { search } = customerSearchSchema.parse(req.query);
    const pattern = new RegExp(escapeRegex(search), 'i');
    const customers = await User.find({
        role: 'user',
        $or: [
            { firstname: pattern },
            { lastname: pattern },
            { email: pattern },
            { phone: pattern },
        ],
    })
        .select('firstname lastname email phone')
        .sort({ firstname: 1, lastname: 1 })
        .limit(20)
        .lean();
    res.json({ customers });
};

export const searchItemTags = async (req: Request, res: Response): Promise<void> => {
    const { code, start: startInput, end: endInput } = tagSearchSchema.parse(req.query);
    const start = new Date(startInput);
    const end = new Date(endInput);
    if (end <= start || end.getTime() - start.getTime() > 26 * 60 * 60 * 1000) {
        throw new HttpError(400, 'Enter a valid single-day range for the item tag search.');
    }
    const assignments = await ItemTagAssignment.find({
        code,
        createdAt: { $gte: start, $lt: end },
    }).sort({ createdAt: -1 }).lean();
    const orderIds = assignments.filter((entry) => entry.recordType === 'order').map((entry) => entry.recordId);
    const saleIds = assignments.filter((entry) => entry.recordType === 'walk-in').map((entry) => entry.recordId);
    const [orders, sales] = await Promise.all([
        Order.find({ _id: { $in: orderIds } })
            .populate<{ userId: { firstname: string; lastname: string } | null }>('userId', 'firstname lastname')
            .lean(),
        CashSale.find({ _id: { $in: saleIds } })
            .populate<{ customerId: { firstname: string; lastname: string } | null }>(
                'customerId',
                'firstname lastname',
            )
            .lean(),
    ]);
    const orderById = new Map(orders.map((order) => [String(order._id), order]));
    const saleById = new Map(sales.map((sale) => [String(sale._id), sale]));
    const results: Array<{
        code: string;
        recordType: 'order' | 'walk-in';
        recordId: string;
        createdAt: Date;
        releasedAt: Date | null | undefined;
        status: string;
        customerName: string;
        items: Array<{ name: string; quantity: number; tagCode?: string | null }>;
    }> = [];
    for (const assignment of assignments) {
        const order = assignment.recordType === 'order' ? orderById.get(String(assignment.recordId)) : undefined;
        if (order) {
            const customer = order.userId && typeof order.userId === 'object' && 'firstname' in order.userId
                ? `${order.userId.firstname} ${order.userId.lastname}`
                : 'Customer order';
            results.push({
                code: assignment.code,
                recordType: 'order',
                recordId: String(order._id),
                createdAt: assignment.createdAt,
                releasedAt: assignment.releasedAt,
                status: order.status,
                customerName: customer,
                items: order.items.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    ...(item.tagCode ? { tagCode: item.tagCode } : {}),
                })),
            });
            continue;
        }
        const sale = assignment.recordType === 'walk-in' ? saleById.get(String(assignment.recordId)) : undefined;
        if (!sale) continue;
        const customer = sale.customerId && typeof sale.customerId === 'object' && 'firstname' in sale.customerId
            ? `${sale.customerId.firstname} ${sale.customerId.lastname}`
            : sale.customerName;
        results.push({
            code: assignment.code,
            recordType: 'walk-in',
            recordId: String(sale._id),
            createdAt: assignment.createdAt,
            releasedAt: assignment.releasedAt,
            status: sale.status,
            customerName: customer,
            items: sale.items.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                ...(item.tagCode ? { tagCode: item.tagCode } : {}),
            })),
        });
    }
    res.json({ results });
};

export const createWalkInSale = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    const input = saleSchema.parse(req.body);
    const pricing = await PricingSettings.findOneAndUpdate(
        { key: 'default' },
        { $setOnInsert: { materials: defaultMaterials } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const items = input.items.map((item) => {
        const material = pricing.materials.find((candidate) => candidate.id === item.materialId);
        if (!material) throw new HttpError(400, 'One of the selected materials is unavailable.');
        const stainRemovalFee = item.stainRemoval ? pricing.stainRemovalFee : 0;
        return {
            materialId: material.id,
            name: material.name,
            quantity: item.quantity,
            unitPrice: material.price,
            stainRemoval: item.stainRemoval,
            stainRemovalFee,
            lineTotal: (material.price + stainRemovalFee) * item.quantity,
        };
    });

    let customerId: mongoose.Types.ObjectId | null = null;
    let customerAccount: {
        _id: string;
        firstname: string;
        lastname: string;
        email: string;
        phone: string;
    } | undefined;
    let customerName = input.customerName || 'Walk-in customer';
    let customerPhone = input.customerPhone;
    let newCustomerCreated = false;
    if (input.customerId) {
        const customer = await User.findOne({ _id: input.customerId, role: 'user' })
            .select('firstname lastname email phone');
        if (!customer) throw new HttpError(404, 'The selected customer account could not be found.');
        customerId = customer._id;
        customerName = `${customer.firstname} ${customer.lastname}`;
        customerPhone = customer.phone;
        customerAccount = {
            _id: customer.id,
            firstname: customer.firstname,
            lastname: customer.lastname,
            email: customer.email,
            phone: customer.phone,
        };
    } else if (input.newCustomer) {
        const duplicate = await User.findOne({
            $or: [{ email: input.newCustomer.email }, { phone: input.newCustomer.phone }],
        }).select('email phone');
        if (duplicate) {
            const duplicateField = duplicate.email === input.newCustomer.email ? 'email address' : 'phone number';
            throw new HttpError(409, `A user account with this ${duplicateField} already exists. Search for and select that customer instead.`);
        }

        const usernameStem = input.newCustomer.email.split('@')[0]!
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '')
            .slice(0, 20) || 'customer';
        let username = '';
        do {
            username = `${usernameStem}-${randomBytes(3).toString('hex')}`;
        } while (await User.exists({ username }));

        const customer = await User.create({
            ...input.newCustomer,
            username,
            role: 'user',
        });
        customerId = customer._id;
        customerName = `${customer.firstname} ${customer.lastname}`;
        customerPhone = customer.phone;
        customerAccount = {
            _id: customer.id,
            firstname: customer.firstname,
            lastname: customer.lastname,
            email: customer.email,
            phone: customer.phone,
        };
        newCustomerCreated = true;
    }

    let sale: InstanceType<typeof CashSale> | undefined;
    const saleId = new mongoose.Types.ObjectId();
    let tagCode = '';
    try {
        const newSale = new CashSale({
            _id: saleId,
            receiptNumber: `FF-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`,
            cashierId: req.auth.userId,
            customerId,
            customerName,
            customerPhone,
            items,
            total: items.reduce((sum, item) => sum + item.lineTotal, 0),
            paymentMethod: input.paymentMethod,
            notes: input.notes,
        });
        tagCode = await allocateItemTag('walk-in', saleId);
        newSale.tagCode = tagCode;
        newSale.items = items.map((item) => ({ ...item, tagCode }));
        sale = await newSale.save();
    } catch (error) {
        if (tagCode) await discardItemTag('walk-in', saleId);
        if (newCustomerCreated && customerId) await User.deleteOne({ _id: customerId });
        throw error;
    }

    if (!sale) throw new HttpError(500, 'The walk-in sale could not be saved.');
    res.status(201).json({
        sale,
        customer: customerAccount,
        customerCreated: newCustomerCreated,
    });
};

export const updateWalkInStatus = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    const { status } = walkInStatusSchema.parse(req.body);
    const sale = await CashSale.findById(req.params.saleId);
    if (!sale) throw new HttpError(404, 'That walk-in job could not be found.');
    if (req.auth.role !== 'admin' && String(sale.cashierId) !== req.auth.userId) {
        throw new HttpError(403, 'You do not have access to this walk-in job.');
    }
    const result = await CashSale.collection.updateOne(
        { _id: sale._id, status: { $ne: 'delivered' } },
        { $set: { status } },
    );
    if (result.matchedCount === 0) {
        const latestSale = await CashSale.findById(sale._id).select('status');
        if (latestSale?.status === 'delivered' && status === 'delivered') {
            await releaseItemTag('walk-in', sale._id);
            const deliveredSale = await CashSale.findById(sale._id).populate('customerId', 'firstname lastname email phone');
            if (!deliveredSale) throw new HttpError(404, 'That walk-in job could not be found.');
            res.json({ sale: deliveredSale });
            return;
        }
        if (latestSale?.status === 'delivered' && status !== 'delivered') {
            throw new HttpError(409, 'A delivered walk-in job cannot be reopened.');
        }
        throw new HttpError(404, 'That walk-in job could not be found.');
    }
    const updatedSale = await CashSale.findById(sale._id).populate('customerId', 'firstname lastname email phone');
    if (!updatedSale) throw new HttpError(404, 'That walk-in job could not be found.');
    if (status === 'delivered') await releaseItemTag('walk-in', sale._id);
    res.json({ sale: updatedSale });
};
