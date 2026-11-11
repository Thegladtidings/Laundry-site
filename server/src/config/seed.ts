import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './database.js';
import User from '../models/user.js';

dotenv.config();

const seedAdmin = async (): Promise<void> => {
    const { MONGO_URI, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
    if (!MONGO_URI || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
        throw new Error('Set MONGO_URI, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding.');
    }
    if (SEED_ADMIN_PASSWORD.length < 12) {
        throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters long.');
    }

    await connectDB();
    const email = SEED_ADMIN_EMAIL.trim().toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
        if (existing.role !== 'admin') {
            throw new Error(`The account ${email} already exists and is not an administrator.`);
        }
        console.log(`Administrator account already exists: ${email}`);
        return;
    }

    await User.create({
        firstname: 'Laundry',
        lastname: 'Administrator',
        username: 'laundry-admin',
        email,
        phone: process.env.SEED_ADMIN_PHONE || '0000000000',
        password: SEED_ADMIN_PASSWORD,
        role: 'admin',
    });
    console.log(`Administrator account created: ${email}`);
};

seedAdmin()
    .catch((error: unknown) => {
        const isAuthenticationError = error instanceof mongoose.mongo.MongoServerError
            && (
                error.code === 18
                || error.code === 8000
                || error.codeName === 'AtlasError'
                || /bad auth|authentication failed/i.test(error.message)
            );

        if (isAuthenticationError) {
            console.error(
                'Unable to connect to MongoDB: Atlas rejected the database credentials. '
                + 'Check MONGO_URI in server/.env and confirm it uses the correct MongoDB database user '
                + 'and password. If the password contains reserved URL characters, percent-encode them. '
                + 'Do not share or commit your connection string.',
            );
        } else {
            console.error('Unable to seed administrator account:', error);
        }
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
