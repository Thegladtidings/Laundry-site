import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import api from '../lib/api';
import type { User } from '../types';

interface Credentials {
    email: string;
    password: string;
}

interface RegistrationDetails extends Credentials {
    firstname: string;
    lastname: string;
    username: string;
    phone: string;
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    login: (credentials: Credentials) => Promise<void>;
    register: (details: RegistrationDetails) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('Alwajud_token');
        if (!token) {
            setLoading(false);
            return;
        }

        api.get<{ user: User }>('/auth/me')
            .then(({ data }) => setUser(data.user))
            .catch(() => {
                localStorage.removeItem('Alwajud_token');
                setUser(null);
            })
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (credentials: Credentials) => {
        const { data } = await api.post<{ user: User; token: string }>('/auth/login', credentials);
        localStorage.setItem('Alwajud_token', data.token);
        setUser(data.user);
    }, []);

    const register = useCallback(async (details: RegistrationDetails) => {
        const { data } = await api.post<{ user: User; token: string }>('/auth/register', details);
        localStorage.setItem('Alwajud_token', data.token);
        setUser(data.user);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('Alwajud_token');
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, loading, login, register, logout }),
        [user, loading, login, register, logout],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider.');
    return context;
}
