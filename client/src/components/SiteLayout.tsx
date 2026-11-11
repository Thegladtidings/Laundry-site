import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import Brand from './Brand';

export default function SiteLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);

    const signOut = () => {
        logout();
        setMenuOpen(false);
        navigate('/');
    };

    return (
        <>
            <header className="site-header">
                <div className="header-inner">
                    <Brand />
                    <button
                        type="button"
                        className="menu-toggle"
                        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        {menuOpen ? <X size={21} /> : <Menu size={21} />}
                    </button>
                    <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
                        <NavLink to="/#services" onClick={() => setMenuOpen(false)}>Our services</NavLink>
                        <NavLink to="/#how-it-works" onClick={() => setMenuOpen(false)}>How it works</NavLink>
                        {user ? (
                            <>
                                <Link to="/dashboard" className="nav-account" onClick={() => setMenuOpen(false)}>
                                    {user.role === 'admin' ? 'Operations' : user.role === 'cashier' ? 'Cashier desk' : `${user.firstname}'s account`}
                                </Link>
                                <button type="button" className="nav-signout" onClick={signOut}>Sign out</button>
                                {user.role === 'user' && (
                                    <Link to="/orders/new" className="button button-small button-dark" onClick={() => setMenuOpen(false)}>
                                        Book a pickup <ArrowUpRight size={15} />
                                    </Link>
                                )}
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="nav-account" onClick={() => setMenuOpen(false)}>Sign in</Link>
                                <Link to="/register" className="button button-small button-dark" onClick={() => setMenuOpen(false)}>
                                    Book a pickup <ArrowUpRight size={15} />
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>
            <main><Outlet /></main>
            <footer className="site-footer">
                <div className="footer-inner">
                    <div>
                        <Brand />
                        <p>More time for what feels like you.</p>
                    </div>
                    <div className="footer-meta">
                        <span>Thoughtful laundry care, delivered.</span>
                        <span>© {new Date().getFullYear()} Alwajud</span>
                    </div>
                </div>
            </footer>
        </>
    );
}
