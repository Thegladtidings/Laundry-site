import { ArrowUpRight, Shirt, Sparkles, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GarmentMaterial } from '../types';
import { formatCurrency } from '../lib/format';

const serviceIcons = [Shirt, Sparkles, Wind];

export default function MaterialCard({
    material,
    index,
    bookingPath,
}: {
    material: GarmentMaterial;
    index: number;
    bookingPath: string;
}) {
    const Icon = serviceIcons[index % serviceIcons.length]!;

    return (
        <article className="service-card">
            <div className="service-icon"><Icon size={20} strokeWidth={1.7} /></div>
            <div className="service-card-top">
                <span className="eyebrow">GARMENT CARE</span>
                <ArrowUpRight size={17} className="service-arrow" />
            </div>
            <h3>{material.name}</h3>
            <p>Carefully cleaned and finished, with optional stain treatment available at booking.</p>
            <div className="service-price">
                <strong>{formatCurrency(material.price)}</strong>
                <span>per item</span>
            </div>
            <Link
                to={`${bookingPath}?material=${encodeURIComponent(material.id)}`}
                className="service-card-link"
            >
                Choose garment <ArrowUpRight size={13} />
            </Link>
        </article>
    );
}
