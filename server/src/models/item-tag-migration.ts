import mongoose from 'mongoose';

const itemTagMigrationSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    completedAt: { type: Date, required: true },
});

const ItemTagMigration = mongoose.model('ItemTagMigration', itemTagMigrationSchema);

export default ItemTagMigration;
