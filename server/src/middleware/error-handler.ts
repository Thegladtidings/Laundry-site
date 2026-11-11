import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import HttpError from '../lib/http-error.js';

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ZodError) {
        res.status(400).json({
            message: 'Please check the information you entered.',
            errors: error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })),
        });
        return;
    }

    if (error instanceof HttpError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }

    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ message: 'Some of the information provided is invalid.' });
        return;
    }

    if (error instanceof mongoose.Error.CastError) {
        res.status(400).json({ message: 'The requested record is invalid.' });
        return;
    }

    if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Each item photo must be 5 MB or smaller.'
            : error.code === 'LIMIT_FILE_COUNT'
                ? 'You can upload at most 30 item photos per order.'
                : 'The uploaded item photos could not be processed.';
        res.status(400).json({ message });
        return;
    }

    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        res.status(409).json({ message: 'An account with those details already exists.' });
        return;
    }

    console.error('Unhandled API error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again shortly.' });
};

export default errorHandler;
