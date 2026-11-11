import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import HttpError from './http-error.js';
import type { UserRole } from '../types/auth.js';

export interface AuthClaims {
    userId: string;
    role: UserRole;
}

const getSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
    }
    return secret;
};

export const validateJwtConfiguration = (): void => {
    getSecret();
};

export const createToken = (claims: AuthClaims): string => {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as NonNullable<SignOptions['expiresIn']>;
    return jwt.sign(claims, getSecret(), { expiresIn });
};

export const verifyToken = (token: string): AuthClaims => {
    let payload: string | JwtPayload;
    try {
        payload = jwt.verify(token, getSecret());
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            throw new HttpError(401, 'Your session has expired. Please sign in again.');
        }
        throw error;
    }

    if (
        typeof payload === 'string'
        || typeof (payload as JwtPayload).userId !== 'string'
        || !['admin', 'user', 'cashier'].includes(String((payload as JwtPayload).role))
    ) {
        throw new HttpError(401, 'Your session has expired. Please sign in again.');
    }
    return {
        userId: (payload as JwtPayload).userId as string,
        role: (payload as JwtPayload).role as UserRole,
    };
};
