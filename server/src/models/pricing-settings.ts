import mongoose from 'mongoose';
import { defaultMaterials, defaultStainRemovalFee } from '../data/materials.js';

const materialPriceSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
}, { _id: false });

const pricingSettingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, default: 'default' },
    materials: {
        type: [materialPriceSchema],
        required: true,
        default: defaultMaterials,
    },
    stainRemovalFee: {
        type: Number,
        required: true,
        min: 0,
        default: defaultStainRemovalFee,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const PricingSettings = mongoose.model('PricingSettings', pricingSettingsSchema);

export default PricingSettings;
