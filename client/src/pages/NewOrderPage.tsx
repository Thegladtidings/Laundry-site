import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Check, ImagePlus, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatCurrency, getErrorMessage } from '../lib/format';
import type { Order, PricingCatalog } from '../types';

type SelectedItem = { quantity: number; stainRemoval: boolean };

function localDateTimeMinimum(): string {
    const minimum = new Date(Date.now() + 60 * 60 * 1000);
    minimum.setMinutes(0, 0, 0);
    return new Date(minimum.getTime() - minimum.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
}

function ImagePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <div className="item-photo-preview">
            {url && <img src={url} alt={file.name} />}
            <button type="button" aria-label={`Remove ${file.name}`} onClick={onRemove}><X size={12} /></button>
        </div>
    );
}

export default function NewOrderPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [items, setItems] = useState<Record<string, SelectedItem>>({});
    const [photos, setPhotos] = useState<Record<string, File[]>>({});
    const [busy, setBusy] = useState(false);
    const { data: catalog, isLoading, isError } = useQuery({
        queryKey: ['materials'],
        queryFn: async () => (await api.get<PricingCatalog>('/materials')).data,
    });
    const requestedMaterial = searchParams.get('material');

    useEffect(() => {
        if (!requestedMaterial || !catalog?.materials.some((material) => material.id === requestedMaterial)) return;
        setItems((current) => current[requestedMaterial] ? current : {
            ...current,
            [requestedMaterial]: { quantity: 1, stainRemoval: false },
        });
    }, [requestedMaterial, catalog]);

    const selected = Object.entries(items).filter(([, item]) => item.quantity > 0);
    const total = selected.reduce((sum, [materialId, item]) => {
        const material = catalog?.materials.find((candidate) => candidate.id === materialId);
        return sum + ((material?.price ?? 0) + (item.stainRemoval ? catalog?.stainRemovalFee ?? 0 : 0)) * item.quantity;
    }, 0);

    const updatePhotos = (materialId: string, event: ChangeEvent<HTMLInputElement>) => {
        const addedFiles = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (addedFiles.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
            toast.error('Photos must be JPEG, PNG or WebP images.');
            return;
        }
        if (addedFiles.some((file) => file.size > 5 * 1024 * 1024)) {
            toast.error('Each photo must be 5 MB or smaller.');
            return;
        }
        const existing = photos[materialId] ?? [];
        if (existing.length + addedFiles.length > 3) {
            toast.error('Add up to 3 photos for each garment type.');
            return;
        }
        const totalPhotos = Object.values(photos).reduce((count, files) => count + files.length, 0);
        if (totalPhotos + addedFiles.length > 30) {
            toast.error('Add up to 30 photos for an order.');
            return;
        }
        setPhotos({ ...photos, [materialId]: [...existing, ...addedFiles] });
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selected.length) {
            toast.error('Choose at least one garment type to continue.');
            return;
        }
        setBusy(true);
        const form = new FormData(event.currentTarget);
        const request = new FormData();
        request.append('items', JSON.stringify(selected.map(([materialId, item]) => ({
            materialId,
            quantity: item.quantity,
            stainRemoval: item.stainRemoval,
        }))));
        request.append('pickupAddress', String(form.get('pickupAddress')));
        request.append('pickupDate', new Date(String(form.get('pickupDate'))).toISOString());
        request.append('notes', String(form.get('notes') || ''));
        selected.forEach(([materialId], index) => {
            for (const file of photos[materialId] ?? []) request.append(`itemPhoto-${index}`, file);
        });
        try {
            const { data } = await api.post<{ order: Order }>('/orders', request);
            toast.success(`Pickup registered · ${data.order.tagCode}. The cashier will confirm the items and final price.`);
            navigate('/dashboard');
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not place your order. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="page-shell booking-page">
            <Link className="back-link back-link-dark" to="/dashboard"><ArrowLeft size={16} /> Back to your account</Link>
            <div className="page-heading booking-heading">
                <span className="section-kicker">A little less on your list</span>
                <h1>Let’s plan your <em>pickup.</em></h1>
                <p>Tell us what you’re sending, add photos if helpful, and see an estimate before the cashier verifies your items.</p>
            </div>
            <form className="booking-layout" onSubmit={submit}>
                <div className="booking-main">
                    <section className="booking-panel">
                        <div className="panel-title"><span className="step-chip">01</span><div><h2>Choose your garments</h2><p>Select each material type and the number of pieces.</p></div></div>
                        {isLoading && <div className="inline-loading"><span className="spinner" /> Loading garment prices…</div>}
                        {isError && <p className="notice notice-error">We couldn’t load the garment catalogue. Please try again shortly.</p>}
                        <div className="booking-service-list">
                            {catalog?.materials.map((material) => {
                                const selection = items[material.id];
                                const quantity = selection?.quantity ?? 0;
                                return (
                                    <div className={`booking-service${quantity > 0 ? ' is-selected' : ''}`} key={material.id}>
                                        <label className="booking-material-choice">
                                            <input
                                                type="checkbox"
                                                checked={quantity > 0}
                                                onChange={(event) => setItems((current) => {
                                                    const next = { ...current };
                                                    if (event.target.checked) next[material.id] = { quantity: 1, stainRemoval: false };
                                                    else delete next[material.id];
                                                    return next;
                                                })}
                                            />
                                            <span className="custom-check">{quantity > 0 && <Check size={13} />}</span>
                                            <span className="booking-service-copy"><strong>{material.name}</strong><small>{formatCurrency(material.price)} per item</small></span>
                                        </label>
                                        {quantity > 0 && (
                                            <div className="material-options">
                                                <label className="quantity-field">Quantity
                                                    <input
                                                        aria-label={`${material.name} quantity`}
                                                        className="quantity-input"
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        value={quantity}
                                                        onChange={(event) => setItems((current) => ({
                                                            ...current,
                                                            [material.id]: { ...current[material.id]!, quantity: Math.max(1, Math.min(100, Number(event.target.value) || 1)) },
                                                        }))}
                                                    />
                                                </label>
                                                <label className="stain-option">
                                                    <input
                                                        type="checkbox"
                                                        checked={selection.stainRemoval}
                                                        onChange={(event) => setItems((current) => ({
                                                            ...current,
                                                            [material.id]: { ...current[material.id]!, stainRemoval: event.target.checked },
                                                        }))}
                                                    />
                                                    Stain removal <small>+{formatCurrency(catalog?.stainRemovalFee ?? 0)} / item</small>
                                                </label>
                                                <label className="item-photo-upload">
                                                    <ImagePlus size={14} /> Add photos <small>{photos[material.id]?.length ?? 0}/3</small>
                                                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => updatePhotos(material.id, event)} disabled={(photos[material.id]?.length ?? 0) >= 3} />
                                                </label>
                                                {!!photos[material.id]?.length && (
                                                    <div className="item-photo-list">
                                                        {photos[material.id]?.map((file, index) => (
                                                            <ImagePreview key={`${file.name}-${file.lastModified}`} file={file} onRemove={() => setPhotos((current) => ({
                                                                ...current,
                                                                [material.id]: (current[material.id] ?? []).filter((_, photoIndex) => photoIndex !== index),
                                                            }))} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                    <section className="booking-panel">
                        <div className="panel-title"><span className="step-chip">02</span><div><h2>Pickup details</h2><p>We’ll come to you, right on time.</p></div></div>
                        <div className="form-stack">
                            <label className="field"><span>Pickup address</span><input name="pickupAddress" autoComplete="street-address" placeholder="Street address, area, city" minLength={8} maxLength={300} required /></label>
                            <label className="field"><span>Preferred pickup time</span><input name="pickupDate" type="datetime-local" min={localDateTimeMinimum()} required /></label>
                            <label className="field"><span>Anything we should know? <small>Optional</small></span><textarea name="notes" rows={3} maxLength={1000} placeholder="Special instructions, fabric notes, or a gate code…" /></label>
                        </div>
                    </section>
                </div>
                <aside className="booking-summary">
                    <span className="section-kicker">Your fresh start</span>
                    <h2>Order summary</h2>
                    {selected.length === 0 ? (
                        <p className="summary-empty">Your chosen garments will appear here.</p>
                    ) : (
                        <div className="summary-lines">
                            {selected.map(([id, selection]) => {
                                const material = catalog?.materials.find((item) => item.id === id);
                                if (!material) return null;
                                const unitTotal = material.price + (selection.stainRemoval ? catalog?.stainRemovalFee ?? 0 : 0);
                                return <div className="summary-line" key={id}><span>{material.name} <small>× {selection.quantity}{selection.stainRemoval ? ' · stain care' : ''}</small></span><strong>{formatCurrency(unitTotal * selection.quantity)}</strong></div>;
                            })}
                        </div>
                    )}
                    <div className="summary-total"><span>Estimated total</span><strong>{formatCurrency(total)}</strong></div>
                    <p className="summary-note">This estimate uses current prices. The cashier will verify garment types, quantities, and stain treatment before payment.</p>
                    <button type="submit" className="button button-dark button-wide" disabled={busy || isLoading || isError}>
                        {busy ? 'Booking your pickup…' : 'Request pickup'} <ArrowUpRight size={16} />
                    </button>
                    <p className="summary-reassurance"><Check size={14} /> No payment required until verified</p>
                </aside>
            </form>
        </section>
    );
}
