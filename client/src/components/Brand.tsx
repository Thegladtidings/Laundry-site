import { Link } from 'react-router-dom';
import { Droplets } from 'lucide-react';
import siteConfig from '../config/site';

export default function Brand() {
    return (
        <Link className="brand" to="/" aria-label={`${siteConfig.name} home`}>
            <span className="brand-mark"><Droplets size={18} strokeWidth={2.2} /></span>
            <span>{siteConfig.name}<span className="brand-period">.</span></span>
        </Link>
    );
}
