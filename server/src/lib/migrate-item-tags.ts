import ItemTagAssignment from '../models/item-tag-assignment.js';
import ItemTagMigration from '../models/item-tag-migration.js';
import CashSale from '../models/cash-sale.js';
import Order from '../models/order.js';
import { allocateItemTag, releaseItemTag } from './item-tag.js';

const dropUniqueTagCodeIndex = async (collection: typeof Order.collection): Promise<void> => {
    let indexes;
    try {
        indexes = await collection.indexes();
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 26) return;
        throw error;
    }
    for (const index of indexes) {
        if (index.unique && index.key.tagCode === 1 && index.name) {
            await collection.dropIndex(index.name);
        }
    }
};

const releaseDeliveredJobTags = async (): Promise<void> => {
    const activeAssignments = await ItemTagAssignment.find({ active: true }).select('recordType recordId').lean();
    const orderIds = activeAssignments
        .filter((assignment) => assignment.recordType === 'order')
        .map((assignment) => assignment.recordId);
    const saleIds = activeAssignments
        .filter((assignment) => assignment.recordType === 'walk-in')
        .map((assignment) => assignment.recordId);
    const releasedAt = new Date();

    if (orderIds.length) {
        const deliveredOrderIds = await Order.distinct('_id', {
            _id: { $in: orderIds },
            status: 'delivered',
        });
        if (deliveredOrderIds.length) {
            await ItemTagAssignment.collection.updateMany(
                { recordType: 'order', recordId: { $in: deliveredOrderIds }, active: true },
                { $set: { active: false, releasedAt } },
            );
        }
    }

    if (saleIds.length) {
        const deliveredSaleIds = await CashSale.distinct('_id', {
            _id: { $in: saleIds },
            status: 'delivered',
        });
        if (deliveredSaleIds.length) {
            await ItemTagAssignment.collection.updateMany(
                { recordType: 'walk-in', recordId: { $in: deliveredSaleIds }, active: true },
                { $set: { active: false, releasedAt } },
            );
        }
    }
};

export const migrateItemTags = async (): Promise<void> => {
    await dropUniqueTagCodeIndex(Order.collection);
    await dropUniqueTagCodeIndex(CashSale.collection);
    await releaseDeliveredJobTags();
    const migrationKey = 'four-digit-garment-tags-v1';
    if (await ItemTagMigration.exists({ key: migrationKey })) return;

    let updated = 0;
    const orders = Order.find({}).sort({ createdAt: 1 }).cursor();
    for await (const order of orders) {
        let assignment = await ItemTagAssignment.findOne({
            recordType: 'order',
            recordId: order._id,
        });
        if (!assignment) {
            const delivered = order.status === 'delivered';
            const code = await allocateItemTag('order', order._id, {
                createdAt: order.createdAt,
                active: !delivered,
                ...(delivered ? { releasedAt: order.updatedAt } : {}),
            });
            assignment = await ItemTagAssignment.findOne({ recordType: 'order', recordId: order._id });
            if (!assignment) throw new Error(`Tag assignment ${code} was not persisted.`);
        }
        const code = assignment.code;
        if (order.status === 'delivered' && assignment.active) {
            await releaseItemTag('order', order._id);
        }
        if (order.tagCode !== code || order.items.some((item) => item.tagCode !== code)) {
            order.tagCode = code;
            order.items.forEach((item) => {
                item.tagCode = code;
            });
            await order.save();
            updated += 1;
        }
    }

    const sales = CashSale.find({}).sort({ createdAt: 1 }).cursor();
    for await (const sale of sales) {
        let assignment = await ItemTagAssignment.findOne({
            recordType: 'walk-in',
            recordId: sale._id,
        });
        if (!assignment) {
            const delivered = sale.status === 'delivered';
            const code = await allocateItemTag('walk-in', sale._id, {
                createdAt: sale.createdAt,
                active: !delivered,
                ...(delivered ? { releasedAt: sale.updatedAt } : {}),
            });
            assignment = await ItemTagAssignment.findOne({ recordType: 'walk-in', recordId: sale._id });
            if (!assignment) throw new Error(`Tag assignment ${code} was not persisted.`);
        }
        const code = assignment.code;
        if (sale.status === 'delivered' && assignment.active) {
            await releaseItemTag('walk-in', sale._id);
        }
        if (sale.tagCode !== code || sale.items.some((item) => item.tagCode !== code)) {
            sale.tagCode = code;
            sale.items.forEach((item) => {
                item.tagCode = code;
            });
            await sale.save();
            updated += 1;
        }
    }

    if (updated) console.log(`Migrated item tag codes for ${updated} orders and walk-in sales.`);
    await ItemTagMigration.create({ key: migrationKey, completedAt: new Date() });
};
