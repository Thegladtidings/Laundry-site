import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import connectDB from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();
import authRoutes from './routes/authroutes.js';
import orderRoutes from './routes/orderroutes.js';
import serviceRoutes from './routes/serviceroutes.js';
import operationsRoutes from './routes/operationsroutes.js';
import materialRoutes from './routes/materialroutes.js';
import errorHandler from './middleware/error-handler.js';
import { validateJwtConfiguration } from './lib/jwt.js';
import { migrateItemTags } from './lib/migrate-item-tags.js';

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173' || 'https://laundry-site-mu-five.vercel.app')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('This origin is not allowed by the server.'));
    },
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
}));

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/operations', operationsRoutes);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
    validateJwtConfiguration();
    await connectDB();
    await migrateItemTags();
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => {
        console.log(`Laundry API listening on port ${port}`);
    });
};

startServer().catch((error: unknown) => {
    console.error('Unable to start the API:', error);
    process.exitCode = 1;
});
