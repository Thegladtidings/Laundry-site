import type { Request, Response } from 'express';
import { services } from '../data/services.js';

export const listServices = (_req: Request, res: Response): void => {
    res.json({ services });
};
