import mongoose from 'mongoose';

interface OrderItem {
    lineId: string;
    tagCode: string;
    materialId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    stainRemoval: boolean;
    stainRemovalFee: number;
    lineTotal: number;
    photos: mongoose.Types.ObjectId[];
}

interface OrderRecord {
    tagCode: string;
    userId: mongoose.Types.ObjectId;
    items: OrderItem[];
    pickupAddress: string;
    pickupDate: Date;
    notes: string;
    total: number;
    estimatedTotal?: number;
    verificationStatus: 'pending' | 'verified';
    verifiedAt?: Date;
    verifiedBy?: mongoose.Types.ObjectId;
    status: 'pending' | 'picked_up' | 'processing' | 'ready' | 'delivered' | 'cancelled';
    paymentStatus: 'unpaid' | 'paid';
    paymentMethod?: 'cash' | 'card' | 'transfer';
    paidAt?: Date;
    receiptNumber?: string;
    cashierId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const orderItemSchema = new mongoose.Schema({
    lineId: { type: String, required: true },
    tagCode: { type: String, required: true, match: /^\d{4}$/ },
    materialId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    stainRemoval: { type: Boolean, default: false },
    stainRemovalFee: { type: Number, required: true, min: 0, default: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    photos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrderPhoto' }],
}, { _id: false });

const orderSchema = new mongoose.Schema<OrderRecord>({
    tagCode: { type: String, required: true, match: /^\d{4}$/ },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    items: { type: [orderItemSchema], required: true },
    pickupAddress: { type: String, required: true, trim: true, maxlength: 300 },
    pickupDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    total: { type: Number, required: true, min: 0 },
    estimatedTotal: { type: Number, min: 0 },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified'],
        default: 'verified',
        index: true,
    },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: ['pending', 'picked_up', 'processing', 'ready', 'delivered', 'cancelled'],
        default: 'pending',
        index: true,
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'paid'],
        default: 'unpaid',
        index: true,
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'transfer'],
    },
    paidAt: Date,
    receiptNumber: String,
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

orderSchema.index({ createdAt: -1 });
orderSchema.index({ paidAt: -1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
