import { Link } from 'react-router-dom';
import { Droplets } from 'lucide-react';

export default function Brand() {
    return (
        <Link className="brand" to="/" aria-label="Alwajud home">
            <span className="brand-mark"><Droplets size={18} strokeWidth={2.2} /></span>
            <span>Alwajud<span className="brand-period">.</span></span>
        </Link>
    );
}
