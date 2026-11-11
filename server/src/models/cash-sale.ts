import mongoose from 'mongoose';

interface CashSaleItem {
    tagCode: string;
    materialId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    stainRemoval: boolean;
    stainRemovalFee: number;
    lineTotal: number;
}

interface CashSaleRecord {
    _id: mongoose.Types.ObjectId;
    receiptNumber: string;
    tagCode: string;
    cashierId: mongoose.Types.ObjectId;
    customerId?: mongoose.Types.ObjectId | null;
    customerName: string;
    customerPhone: string;
    items: CashSaleItem[];
    total: number;
    paymentMethod: 'cash' | 'card' | 'transfer';
    status: 'pending' | 'picked_up' | 'processing' | 'ready' | 'delivered' | 'cancelled';
    notes: string;
    createdAt: Date;
    updatedAt: Date;
}

const cashSaleItemSchema = new mongoose.Schema<CashSaleItem>({
    tagCode: { type: String, required: true, match: /^\d{4}$/ },
    materialId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    stainRemoval: { type: Boolean, default: false },
    stainRemovalFee: { type: Number, required: true, min: 0, default: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const cashSaleSchema = new mongoose.Schema<CashSaleRecord>({
    receiptNumber: { type: String, required: true, unique: true },
    tagCode: { type: String, required: true, match: /^\d{4}$/ },
    cashierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
    },
    customerName: { type: String, trim: true, maxlength: 120, default: 'Walk-in customer' },
    customerPhone: { type: String, trim: true, maxlength: 20, default: '' },
    items: { type: [cashSaleItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'transfer'],
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'picked_up', 'processing', 'ready', 'delivered', 'cancelled'],
        default: 'pending',
        index: true,
    },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true });

cashSaleSchema.index({ createdAt: -1 });

const CashSale = mongoose.model<CashSaleRecord>('CashSale', cashSaleSchema);

export default CashSale;
