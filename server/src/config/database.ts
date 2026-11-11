import mongoose from 'mongoose';

const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('MONGO_URI is required. Add it to server/.env before starting the API.');
    }

    const conn = await mongoose.connect(uri, {
        dbName: process.env.DB_NAME || 'laundrydb',
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
};

export default connectDB;
