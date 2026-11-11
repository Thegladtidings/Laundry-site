export type UserRole = 'admin' | 'user' | 'cashier';

declare global {
    namespace Express {
        interface Request {
            auth?: {
                userId: string;
                role: UserRole;
            };
        }
    }
}
