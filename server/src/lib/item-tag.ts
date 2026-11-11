import mongoose from 'mongoose';
import HttpError from './http-error.js';
import ItemTagAssignment from '../models/item-tag-assignment.js';
import ItemTagSequence from '../models/item-tag-sequence.js';

type TaggedRecordType = 'order' | 'walk-in';

const isDuplicateKeyError = (error: unknown): boolean =>
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 11000;

export const allocateItemTag = async (
    recordType: TaggedRecordType,
    recordId: mongoose.Types.ObjectId,
    options: { createdAt?: Date; active?: boolean; releasedAt?: Date } = {},
): Promise<string> => {
    const active = options.active ?? true;
    if (active && await ItemTagAssignment.countDocuments({ active: true }) >= 9999) {
        throw new HttpError(409, 'All four-digit item tag codes are currently assigned to undelivered jobs.');
    }

    for (let attempt = 0; attempt < 9999; attempt += 1) {
        let sequence;
        try {
            sequence = await ItemTagSequence.findOneAndUpdate(
                { key: 'garment-tags' },
                { $inc: { value: 1 } },
                { new: true, upsert: true, setDefaultsOnInsert: true },
            );
        } catch (error) {
            if (isDuplicateKeyError(error)) continue;
            throw error;
        }
        if (!sequence) throw new HttpError(500, 'A garment tag code could not be allocated.');
        const number = ((sequence.value - 1) % 9999) + 1;
        const code = String(number).padStart(4, '0');

        try {
            await ItemTagAssignment.create({
                code,
                recordType,
                recordId,
                active,
                ...(options.releasedAt ? { releasedAt: options.releasedAt } : {}),
                ...(options.createdAt ? { createdAt: options.createdAt, updatedAt: options.createdAt } : {}),
            });
            return code;
        } catch (error) {
            if (isDuplicateKeyError(error)) continue;
            throw error;
        }
    }

    throw new HttpError(409, 'All four-digit item tag codes are currently assigned to undelivered jobs.');
};

export const ensureActiveItemTag = async (
    recordType: TaggedRecordType,
    recordId: mongoose.Types.ObjectId,
): Promise<string> => {
    const assignment = await ItemTagAssignment.findOne({ recordType, recordId, active: true }).select('code');
    return assignment?.code ?? allocateItemTag(recordType, recordId);
};

export const releaseItemTag = async (
    recordType: TaggedRecordType,
    recordId: mongoose.Types.ObjectId,
): Promise<void> => {
    await ItemTagAssignment.updateOne(
        { recordType, recordId, active: true },
        { $set: { active: false, releasedAt: new Date() } },
    );
};

export const discardItemTag = async (
    recordType: TaggedRecordType,
    recordId: mongoose.Types.ObjectId,
): Promise<void> => {
    await ItemTagAssignment.deleteOne({ recordType, recordId, active: true });
};
