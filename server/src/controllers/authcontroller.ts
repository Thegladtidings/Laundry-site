import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { z } from 'zod';
import User from '../models/user.js';
import { createToken } from '../lib/jwt.js';
import HttpError from '../lib/http-error.js';

const registrationSchema = z.object({
    firstname: z.string().trim().min(1).max(60),
    lastname: z.string().trim().min(1).max(60),
    username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    phone: z.string().trim().min(7).max(20),
    password: z.string().min(8).max(72),
}).strict();

const loginSchema = z.object({
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(72),
}).strict();

const createCashierSchema = z.object({
    firstname: z.string().trim().min(1).max(60),
    lastname: z.string().trim().min(1).max(60),
    username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    phone: z.string().trim().min(7).max(20),
    password: z.string().min(12).max(72),
}).strict();

const serializeUser = (user: {
    id: string;
    firstname: string;
    lastname: string;
    username: string;
    email: string;
    phone: string;
    role: string;
}) => ({
    id: user.id,
    firstname: user.firstname,
    lastname: user.lastname,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
});

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    const input = registrationSchema.parse(req.body);
    const user = await User.create(input);
    const token = createToken({ userId: user.id, role: user.role });

    res.status(201).json({ user: serializeUser(user), token });
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email, active: true }).select('+password');
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
        throw new HttpError(401, 'The email or password you entered is incorrect.');
    }

    const token = createToken({ userId: user.id, role: user.role });
    res.json({ user: serializeUser(user), token });
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new HttpError(401, 'Please sign in to continue.');
    const user = await User.findById(req.auth.userId);
    if (!user) throw new HttpError(401, 'Your account could not be found.');
    res.json({ user: serializeUser(user) });
};

export const listStaff = async (_req: Request, res: Response): Promise<void> => {
    const staff = await User.find({ role: { $in: ['admin', 'cashier'] } })
        .select('firstname lastname username email phone role active createdAt')
        .sort({ role: 1, firstname: 1 });
    res.json({
        staff: staff.map((member) => ({
            id: member.id,
            firstname: member.firstname,
            lastname: member.lastname,
            username: member.username,
            email: member.email,
            phone: member.phone,
            role: member.role,
            active: member.active,
            createdAt: member.createdAt,
        })),
    });
};

export const createCashier = async (req: Request, res: Response): Promise<void> => {
    const input = createCashierSchema.parse(req.body);
    const cashier = await User.create({ ...input, role: 'cashier' });
    res.status(201).json({ user: serializeUser(cashier) });
};

export const updateCashierStatus = async (req: Request, res: Response): Promise<void> => {
    const { active } = z.object({ active: z.boolean() }).strict().parse(req.body);
    const cashier = await User.findOneAndUpdate(
        { _id: req.params.userId, role: 'cashier' },
        { active },
        { new: true, runValidators: true },
    ).select('firstname lastname username email phone role active createdAt');
    if (!cashier) throw new HttpError(404, 'That cashier account could not be found.');
    res.json({ user: cashier });
};
