import type { NextFunction, Request, Response } from 'express';
import HttpError from '../lib/http-error.js';
import { verifyToken } from '../lib/jwt.js';
import User from '../models/user.js';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authorization = req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
        next(new HttpError(401, 'Please sign in to continue.'));
        return;
    }

    let claims: ReturnType<typeof verifyToken>;
    try {
        claims = verifyToken(authorization.slice(7));
    } catch (error) {
        next(error);
        return;
    }

    const user = await User.findById(claims.userId).select('role active');
    if (!user || !user.active) {
        next(new HttpError(401, 'Your account is inactive. Please contact an administrator.'));
        return;
    }

    req.auth = { userId: user.id, role: user.role };
    next();
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
    if (req.auth?.role !== 'admin') {
        next(new HttpError(403, 'Administrator access is required.'));
        return;
    }
    next();
};

export const requireAdminOrCashier = (req: Request, _res: Response, next: NextFunction): void => {
    if (req.auth?.role !== 'admin' && req.auth?.role !== 'cashier') {
        next(new HttpError(403, 'Staff access is required.'));
        return;
    }
    next();
};
