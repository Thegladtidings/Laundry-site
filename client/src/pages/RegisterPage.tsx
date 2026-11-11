import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import { getErrorMessage } from '../lib/format';
import Brand from '../components/Brand';

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [busy, setBusy] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const password = String(form.get('password'));
        if (password !== String(form.get('confirmPassword'))) {
            toast.error('Those passwords do not match.');
            return;
        }

        setBusy(true);
        try {
            await register({
                firstname: String(form.get('firstname')),
                lastname: String(form.get('lastname')),
                username: String(form.get('username')),
                email: String(form.get('email')),
                phone: String(form.get('phone')),
                password,
            });
            toast.success('Your Alwajud account is ready.');
            const material = new URLSearchParams(location.search).get('material');
            navigate(
                material ? `/orders/new?material=${encodeURIComponent(material)}` : '/orders/new',
                { replace: true },
            );
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not create your account. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="auth-page">
            <div className="auth-aside auth-aside-register">
                <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to Alwajud</Link>
                <div className="auth-aside-content">
                    <span className="section-kicker">Make room for more</span>
                    <h2>Fresh clothes.<br /><em>Clear head.</em></h2>
                    <p>Your laundry day, thoughtfully taken care of from the very first pickup.</p>
                </div>
                <span className="auth-aside-foot">A FRESH START, EVERY TIME.</span>
            </div>
            <div className="auth-main">
                <Brand />
                <div className="auth-form-wrap auth-form-wide">
                    <span className="section-kicker">Welcome to Alwajud</span>
                    <h1>Let’s make it easy.</h1>
                    <p className="auth-subtitle">Create your account and we’ll take it from here.</p>
                    <form className="form-stack" onSubmit={submit}>
                        <div className="field-row">
                            <label className="field"><span>First name</span><input name="firstname" autoComplete="given-name" placeholder="First name" maxLength={60} required /></label>
                            <label className="field"><span>Last name</span><input name="lastname" autoComplete="family-name" placeholder="Last name" maxLength={60} required /></label>
                        </div>
                        <label className="field"><span>Username</span><input name="username" autoComplete="username" placeholder="Choose a username" minLength={3} maxLength={30} pattern="[a-zA-Z0-9._-]+" required /></label>
                        <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
                        <label className="field"><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" placeholder="+234 800 000 0000" minLength={7} maxLength={20} required /></label>
                        <div className="field-row">
                            <label className="field"><span>Password</span><input name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} maxLength={72} required /></label>
                            <label className="field"><span>Confirm password</span><input name="confirmPassword" type="password" autoComplete="new-password" placeholder="Repeat password" minLength={8} maxLength={72} required /></label>
                        </div>
                        <button className="button button-dark button-wide" type="submit" disabled={busy}>{busy ? 'Creating your account…' : 'Create my account'} <ArrowUpRight size={16} /></button>
                    </form>
                    <p className="auth-switch">Already with us? <Link to="/login">Sign in</Link></p>
                </div>
                <p className="auth-privacy">Your details stay private, always.</p>
            </div>
        </section>
    );
}
