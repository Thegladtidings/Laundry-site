import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/user.js';
import jwt from 'jsonwebtoken';
import { type Request, type Response } from 'express';


interface NewUser{
    firstname: string;
    lastname: string;
    username: string;
    password: string;
    email: string;
    phone: string;
    role: 'admin' | 'user' | 'cashier';
}
interface LoginRequest extends Request {
    body: {
        email: string;
        password: string; 
        role: string;  
    };
}
interface JWTUserPayload {
    user: {
        id: string;
        email: string;
        role: string;
    };
}

export const registerUser = async (req: Request, res: Response) => {
    const { firstname, lastname, username, password, email, phone,   role } = req.body as NewUser;
    if(!firstname || !lastname || !username || !password || !email || !phone || !role) {
        res.status(400).json({ message: 'All fields are required' });
        return;
    }
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const newUser = new User({
            firstname,
            lastname,
            username,
            password,
            email,
            phone,
            role
        });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: (error as Error).message });
    }

}

export const loginUser = async (req: LoginRequest, res: Response) => {
    const { email, password,role} = req.body;
      if (!email || !password || !role) {
            res.status(400).json({ message: 'Email, password, and role are required' });
            return;
        }
    
    const user = await User.findOne({ email });

    try {
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isMatch : boolean = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const payload: JWTUserPayload = {
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        };
        const secret: string = process.env.JWT_SECRET || 'default_secret';

          const token : string = jwt.sign(
            payload, 
            secret,
            {expiresIn: '1h'}
          );

          res.json({
            message: 'Login successful',
            token,
            user:{
                id: user.id,
                email: user.email,
                role: user.role
            }
          });
            } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: (error as Error).message    });
    }

}