import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Clock3, PackageCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import type { PricingCatalog } from '../types';
import MaterialCard from '../components/MaterialCard';
import { useAuth } from '../auth/AuthContext';

export default function HomePage() {
    const { user } = useAuth();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['materials'],
        queryFn: async () => (await api.get<PricingCatalog>('/materials')).data,
    });
    const bookingLink = user ? '/orders/new' : '/register';

    return (
        <>
            <section className="hero">
                <div className="hero-copy">
                    <div className="hero-kicker"><span className="kicker-line" /> A little more room in your day</div>
                    <h1>Laundry, beautifully <em>taken care of.</em></h1>
                    <p className="hero-description">
                        Thoughtful garment care, right from your doorstep. We pick up, make it fresh, and bring it back.
                    </p>
                    <div className="hero-actions">
                        <Link className="button button-dark" to={bookingLink}>Schedule a pickup <ArrowUpRight size={16} /></Link>
                        <a className="text-link" href="#how-it-works">See how it works <ArrowDown size={15} /></a>
                    </div>
                    <div className="hero-proof">
                        <div className="proof-avatars" aria-hidden="true"><span>A</span><span>M</span><span>T</span></div>
                        <p><strong>A fresh kind of laundry day.</strong><br />Loved by busy people across the city.</p>
                    </div>
                </div>
                <div className="hero-visual" role="img" aria-label="Freshly folded laundry in a sunlit home">
                    <div className="hero-image" />
                    <div className="hero-image-shade" />
                    <div className="hero-note">
                        <span className="hero-note-icon"><Sparkles size={16} /></span>
                        <div><strong>Made fresh, just for you.</strong><span>Care in every detail.</span></div>
                    </div>
                    <div className="hero-count"><span>01</span> / 03</div>
                    <span className="visual-caption">FRESHNESS, ON YOUR SCHEDULE</span>
                </div>
                <div className="hero-bottom">
                    <span><span className="online-dot" /> PICKUP & DELIVERY, MADE EASY</span>
                    <span>01 — YOUR CLOTHES, OUR CARE</span>
                </div>
            </section>

            <section className="benefit-strip" aria-label="Our promise">
                <div><Clock3 size={18} /><span>Pickup when it suits you</span></div>
                <div><Sparkles size={18} /><span>Care for every kind of fabric</span></div>
                <div><PackageCheck size={18} /><span>Freshness, delivered home</span></div>
                <div><Check size={18} /><span>Thoughtful, every time</span></div>
            </section>

            <section className="section services-section" id="services">
                <div className="section-heading">
                    <div>
                        <span className="section-kicker">Thoughtful care, transparent pricing</span>
                        <h2>Care for every<br /><em>kind of garment.</em></h2>
                    </div>
                    <p>See the current price for each garment type. Your order estimate updates with quantity and any optional stain treatment.</p>
                </div>
                {isLoading && <div className="inline-loading"><span className="spinner" /> Loading garment prices…</div>}
                {isError && <p className="notice notice-error">Our garment catalogue is unavailable right now. Please try again in a moment.</p>}
                {data && (
                    <div className="service-grid">
                        {data.materials.map((material, index) => (
                            <MaterialCard key={material.id} material={material} index={index} bookingPath={bookingLink} />
                        ))}
                    </div>
                )}
                <div className="service-footnote"><span>Stain removal is optional.</span> The admin-set fee is shown during booking and applies per selected item.</div>
            </section>

            <section className="how-section" id="how-it-works">
                <div className="how-intro">
                    <span className="section-kicker">Consider it handled</span>
                    <h2>Three small steps.<br /><em>One lovely feeling.</em></h2>
                    <p>Getting laundry off your list should feel just as good as getting it back.</p>
                    <Link to={bookingLink} className="button button-light">Let’s get started <ArrowRight size={16} /></Link>
                </div>
                <div className="steps-list">
                    <article className="step-card"><span className="step-number">01</span><div><h3>Choose a time</h3><p>Tell us what needs care and when to stop by. We’ll take it from there.</p></div><ArrowUpRight size={18} /></article>
                    <article className="step-card"><span className="step-number">02</span><div><h3>We make it fresh</h3><p>Your pieces are cleaned and finished with the attention they deserve.</p></div><ArrowUpRight size={18} /></article>
                    <article className="step-card"><span className="step-number">03</span><div><h3>Enjoy the feeling</h3><p>Fresh, folded and back at your door. More time for the good stuff.</p></div><ArrowUpRight size={18} /></article>
                </div>
            </section>

            <section className="closing-cta">
                <div className="closing-decoration"><span /><span /><span /></div>
                <span className="section-kicker">A better kind of laundry day</span>
                <h2>Ready for a little<br /><em>breathing room?</em></h2>
                <p>Start with one pickup. We think you’ll like how it feels.</p>
                <Link to={bookingLink} className="button button-dark">Book your first pickup <ArrowUpRight size={16} /></Link>
            </section>
        </>
    );
}
