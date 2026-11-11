import mongoose from 'mongoose';

interface ItemTagSequenceRecord {
    key: string;
    value: number;
}

const itemTagSequenceSchema = new mongoose.Schema<ItemTagSequenceRecord>({
    key: { type: String, required: true, unique: true },
    value: { type: Number, required: true },
});

const ItemTagSequence = mongoose.model<ItemTagSequenceRecord>('ItemTagSequence', itemTagSequenceSchema);

export default ItemTagSequence;
