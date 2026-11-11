import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { defaultMaterials } from '../data/materials.js';
import { allocateItemTag, discardItemTag, ensureActiveItemTag, releaseItemTag } from '../lib/item-tag.js';
import HttpError from '../lib/http-error.js';
import Order from '../models/order.js';
import OrderPhoto from '../models/order-photo.js';
import PricingSettings from '../models/pricing-settings.js';

const createOrderSchema = z.object({
    items: z.array(z.object({
        materialId: z.string().min(1),
        quantity: z.number().int().min(1).max(100),
        stainRemoval: z.boolean().default(false),
    }).strict()).min(1).max(defaultMaterials.length),
    pickupAddress: z.string().trim().min(8).max(300),
    pickupDate: z.string().datetime(),
    notes: z.string().trim().max(1000).optional().default(''),
}).strict();

const orderStatuses = ['pending', 'picked_up', 'processing', 'ready', 'delivered', 'cancelled'] as const;
const updateStatusSchema = z.object({ status: z.enum(orderStatuses) }).strict();
const paymentSchema = z.object({
    paymentMethod: z.enum(['cash', 'card', 'transfer']),
}).strict();
const verifyOrderSchema = z.object({
    items: z.array(z.object({
        lineId: z.string().uuid(),
        materialId: z.string().min(1),
        quantity: z.number().int().min(1).max(100),
        stainRemoval: z.boolean(),
    }).strict()).min(1).max(defaultMaterials.length),
}).strict();

const createReceiptNumber = (): string =>
    `FF-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`;

const uploadedFiles = (req: Request): Express.Multer.File[] =>
    Array.isArray(req.files) ? req.files : [];

const imageContentType = (buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null => {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (
        buffer.length >= 8
        && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
        return 'image/png';
    }
    if (
        buffer.length >= 12
        && buffer.toString('ascii', 0, 4) === 'RIFF'
        && buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return 'image/webp';
    }
    return null;
};

export const listOrders = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    const filter = req.auth.role === 'admin' || req.auth.role === 'cashier'
        ? {}
        : { userId: req.auth.userId };
    const orders = await Order.find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('userId', 'firstname lastname email phone')
        .populate('items.photos', 'contentType createdAt')
        .populate('verifiedBy', 'firstname lastname');
    res.json({ orders });
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    let rawItems: unknown = req.body.items;
    if (typeof rawItems === 'string') {
        try {
            rawItems = JSON.parse(rawItems) as unknown;
        } catch {
            throw new HttpError(400, 'The item list is not valid JSON.');
        }
    }
    const input = createOrderSchema.parse({
        ...req.body,
        items: rawItems,
    });
    const pickupDate = new Date(input.pickupDate);
    if (pickupDate.getTime() < Date.now()) {
        throw new HttpError(400, 'Choose a pickup time in the future.');
    }

    const files = uploadedFiles(req);
    const photoIndexes = new Map<number, Array<{ file: Express.Multer.File; contentType: 'image/jpeg' | 'image/png' | 'image/webp' }>>();
    for (const file of files) {
        const indexMatch = /^itemPhoto-(\d+)$/.exec(file.fieldname);
        const itemIndex = Number(indexMatch?.[1]);
        const contentType = imageContentType(file.buffer);
        if (!indexMatch || !Number.isInteger(itemIndex) || itemIndex >= input.items.length) {
            throw new HttpError(400, 'Each item photo must be attached to a valid item.');
        }
        if (!contentType) throw new HttpError(400, 'Upload a valid JPEG, PNG or WebP item photo.');
        const photos = photoIndexes.get(itemIndex) || [];
        if (photos.length >= 3) throw new HttpError(400, 'Upload no more than 3 photos for each item.');
        photos.push({ file, contentType });
        photoIndexes.set(itemIndex, photos);
    }

    const pricing = await PricingSettings.findOneAndUpdate(
        { key: 'default' },
        { $setOnInsert: { materials: defaultMaterials } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const pricedItems = input.items.map((item) => {
        const material = pricing.materials.find((candidate) => candidate.id === item.materialId);
        if (!material) throw new HttpError(400, 'One of the selected materials is unavailable.');
        const stainRemovalFee = item.stainRemoval ? pricing.stainRemovalFee : 0;
        return {
            lineId: randomUUID(),
            materialId: material.id,
            name: material.name,
            quantity: item.quantity,
            unitPrice: material.price,
            stainRemoval: item.stainRemoval,
            stainRemovalFee,
            lineTotal: (material.price + stainRemovalFee) * item.quantity,
        };
    });

    const orderId = new mongoose.Types.ObjectId();
    const tagCode = await allocateItemTag('order', orderId);
    const taggedItems = pricedItems.map((item) => ({ ...item, tagCode }));
    const photoDocuments = files.map((file) => {
        const itemIndex = Number(/^itemPhoto-(\d+)$/.exec(file.fieldname)?.[1]);
        const photo = new OrderPhoto({
            orderId,
            userId: req.auth!.userId,
            lineId: taggedItems[itemIndex]!.lineId,
            contentType: imageContentType(file.buffer)!,
            data: file.buffer,
        });
        return photo;
    });

    const items = taggedItems.map((item, index) => ({
        ...item,
        photos: photoDocuments
            .filter((photo) => photo.lineId === item.lineId)
            .map((photo) => photo._id),
    }));
    const order = new Order({
        _id: orderId,
        tagCode,
        userId: req.auth.userId,
        items,
        pickupAddress: input.pickupAddress,
        pickupDate,
        notes: input.notes,
        total: items.reduce((sum, item) => sum + item.lineTotal, 0),
        estimatedTotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
        verificationStatus: 'pending',
    });

    try {
        if (photoDocuments.length) await OrderPhoto.insertMany(photoDocuments);
        await order.save();
    } catch (error) {
        if (photoDocuments.length) {
            await OrderPhoto.deleteMany({ _id: { $in: photoDocuments.map((photo) => photo._id) } });
        }
        await discardItemTag('order', orderId);
        throw error;
    }
    res.status(201).json({ order });
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
    const { status } = updateStatusSchema.parse(req.body);
    const orderId = req.params.orderId;
    if (typeof orderId !== 'string' || !mongoose.isValidObjectId(orderId)) {
        throw new HttpError(404, 'That order could not be found.');
    }
    const id = new mongoose.Types.ObjectId(orderId);
    const filter = {
        _id: id,
        status: { $ne: 'delivered' },
        ...(status === 'delivered' ? { verificationStatus: 'verified' } : {}),
    };
    const result = await Order.collection.updateOne(
        filter,
        { $set: { status } },
    );
    if (result.matchedCount === 0) {
        const existingOrder = await Order.findById(id).select('status verificationStatus');
        if (existingOrder?.status === 'delivered' && status === 'delivered') {
            const order = await Order.findById(id).populate('userId', 'firstname lastname email phone')
                .populate('items.photos', 'contentType createdAt')
                .populate('verifiedBy', 'firstname lastname');
            if (!order) throw new HttpError(404, 'That order could not be found.');
            await releaseItemTag('order', order._id);
            res.json({ order });
            return;
        }
        if (existingOrder && status === 'delivered' && existingOrder.verificationStatus !== 'verified') {
            throw new HttpError(409, 'An order must be verified before it can be delivered.');
        }
        if (existingOrder?.status === 'delivered' && status !== 'delivered') {
            throw new HttpError(409, 'A delivered order cannot be reopened.');
        }
        throw new HttpError(404, 'That order could not be found.');
    }
    const order = await Order.findById(id).populate('userId', 'firstname lastname email phone')
        .populate('items.photos', 'contentType createdAt')
        .populate('verifiedBy', 'firstname lastname');

    if (!order) throw new HttpError(404, 'That order could not be found.');
    if (status === 'delivered') await releaseItemTag('order', order._id);
    res.json({ order });
};

export const verifyOrderItems = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    const input = verifyOrderSchema.parse(req.body);
    const order = await Order.findById(req.params.orderId);
    if (!order) throw new HttpError(404, 'That order could not be found.');
    if (order.status === 'delivered') throw new HttpError(409, 'A delivered order cannot be changed.');
    if (order.verificationStatus === 'verified') throw new HttpError(409, 'This order has already been verified.');
    if (order.paymentStatus === 'paid') throw new HttpError(409, 'A paid order cannot be changed.');

    const existingLineIds = new Set(order.items.map((item) => item.lineId));
    if (
        input.items.length !== existingLineIds.size
        || input.items.some((item) => !existingLineIds.has(item.lineId))
    ) {
        throw new HttpError(400, 'Verification must include every submitted item exactly once.');
    }

    const pricing = await PricingSettings.findOne({ key: 'default' });
    if (!pricing) throw new HttpError(500, 'Material pricing has not been configured.');
    const tagCode = await ensureActiveItemTag('order', order._id);
    const verifiedItems = input.items.map((verifiedItem) => {
        const material = pricing.materials.find((candidate) => candidate.id === verifiedItem.materialId);
        if (!material) throw new HttpError(400, 'One of the selected materials is unavailable.');
        const submittedItem = order.items.find((item) => item.lineId === verifiedItem.lineId)!;
        const stainRemovalFee = verifiedItem.stainRemoval ? pricing.stainRemovalFee : 0;
        return {
            ...submittedItem,
            tagCode,
            materialId: material.id,
            name: material.name,
            quantity: verifiedItem.quantity,
            unitPrice: material.price,
            stainRemoval: verifiedItem.stainRemoval,
            stainRemovalFee,
            lineTotal: (material.price + stainRemovalFee) * verifiedItem.quantity,
        };
    });

    order.items = verifiedItems;
    order.tagCode = tagCode;
    order.total = verifiedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    order.verificationStatus = 'verified';
    order.verifiedAt = new Date();
    order.verifiedBy = new mongoose.Types.ObjectId(req.auth.userId);
    await order.save();
    res.json({ order });
};

export const getOrderPhoto = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    const photo = await OrderPhoto.findById(req.params.photoId)
        .where('orderId')
        .equals(req.params.orderId)
        .select('+data');
    if (!photo) throw new HttpError(404, 'That item photo could not be found.');
    if (req.auth.role === 'user' && String(photo.userId) !== req.auth.userId) {
        throw new HttpError(403, 'You do not have access to that item photo.');
    }
    res.set({
        'Content-Type': photo.contentType,
        'Content-Length': String(photo.data.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
    });
    res.send(photo.data);
};

export const recordOrderPayment = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    const { paymentMethod } = paymentSchema.parse(req.body);
    const orderToPay = await Order.findById(req.params.orderId).select('verificationStatus');
    if (!orderToPay) throw new HttpError(404, 'That order could not be found.');
    if (orderToPay.verificationStatus !== 'verified') {
        throw new HttpError(409, 'Verify the order items and final price before collecting payment.');
    }
    const order = await Order.findOneAndUpdate(
        {
            _id: req.params.orderId,
            paymentStatus: 'unpaid',
            verificationStatus: { $ne: 'pending' },
            status: { $ne: 'cancelled' },
        },
        {
            $set: {
                paymentStatus: 'paid',
                paymentMethod,
                paidAt: new Date(),
                receiptNumber: createReceiptNumber(),
                cashierId: req.auth.userId,
            },
        },
        { new: true, runValidators: true },
    ).populate('userId', 'firstname lastname email phone')
        .populate('cashierId', 'firstname lastname');

    if (!order) {
        const existingOrder = await Order.findById(req.params.orderId).select('paymentStatus status verificationStatus');
        if (!existingOrder) throw new HttpError(404, 'That order could not be found.');
        if (existingOrder.paymentStatus === 'paid') {
            throw new HttpError(409, 'This order has already been paid.');
        }
        if (existingOrder.verificationStatus !== 'verified') {
            throw new HttpError(409, 'Verify the order items and final price before collecting payment.');
        }
        throw new HttpError(409, 'Cancelled orders cannot be paid.');
    }

    res.json({ order });
};
