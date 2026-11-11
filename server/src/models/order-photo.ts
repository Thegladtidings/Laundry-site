import mongoose from 'mongoose';

interface OrderPhotoRecord {
    _id: mongoose.Types.ObjectId;
    orderId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    lineId: string;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
    data: Buffer;
    createdAt: Date;
    updatedAt: Date;
}

const orderPhotoSchema = new mongoose.Schema<OrderPhotoRecord>({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    lineId: { type: String, required: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    data: { type: Buffer, required: true, select: false },
}, { timestamps: true });

const OrderPhoto: mongoose.Model<OrderPhotoRecord> = mongoose.model<OrderPhotoRecord>(
    'OrderPhoto',
    orderPhotoSchema,
);

export default OrderPhoto;
