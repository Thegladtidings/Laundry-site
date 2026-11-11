import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, LockKeyhole } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import { getErrorMessage } from '../lib/format';
import Brand from '../components/Brand';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [busy, setBusy] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        const form = new FormData(event.currentTarget);
        try {
            await login({
                email: String(form.get('email')),
                password: String(form.get('password')),
            });
            toast.success('Welcome back. Your fresh start is ready.');
            const from = (location.state as {
                from?: { pathname?: string; search?: string };
            } | null)?.from;
            const destination = from ? `${from.pathname || ''}${from.search || ''}` : '/dashboard';
            navigate(destination || '/dashboard', { replace: true });
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not sign you in. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="auth-page">
            <div className="auth-aside">
                <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to Alwajud</Link>
                <div className="auth-aside-content">
                    <span className="auth-aside-mark"><LockKeyhole size={21} /></span>
                    <span className="section-kicker">Your laundry, in good hands</span>
                    <h2>A little more space<br /><em>for your day.</em></h2>
                    <p>Pick up right where you left off. Your next fresh start is just around the corner.</p>
                </div>
                <span className="auth-aside-foot">GOOD CARE, RIGHT ON TIME.</span>
            </div>
            <div className="auth-main">
                <Brand />
                <div className="auth-form-wrap">
                    <span className="section-kicker">Welcome back</span>
                    <h1>Lovely to see you.</h1>
                    <p className="auth-subtitle">Sign in to manage your pickups and orders.</p>
                    <form className="form-stack" onSubmit={submit}>
                        <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
                        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" placeholder="Your password" required /></label>
                        <button className="button button-dark button-wide" type="submit" disabled={busy}>{busy ? 'Signing you in…' : 'Sign in'} <ArrowUpRight size={16} /></button>
                    </form>
                    <p className="auth-switch">New to Alwajud? <Link to="/register">Create an account</Link></p>
                </div>
                <p className="auth-privacy">Your details stay private, always.</p>
            </div>
        </section>
    );
}
