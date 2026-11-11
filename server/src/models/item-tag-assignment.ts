import mongoose from 'mongoose';

const itemTagAssignmentSchema = new mongoose.Schema({
    code: { type: String, required: true, match: /^\d{4}$/ },
    recordType: { type: String, required: true, enum: ['order', 'walk-in'] },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
    active: { type: Boolean, default: true, required: true },
    releasedAt: Date,
}, { timestamps: true });

itemTagAssignmentSchema.index(
    { code: 1 },
    { unique: true, partialFilterExpression: { active: true } },
);
itemTagAssignmentSchema.index(
    { recordType: 1, recordId: 1 },
    { unique: true, partialFilterExpression: { active: true } },
);
itemTagAssignmentSchema.index({ code: 1, createdAt: -1 });

const ItemTagAssignment = mongoose.model('ItemTagAssignment', itemTagAssignmentSchema);

export default ItemTagAssignment;
