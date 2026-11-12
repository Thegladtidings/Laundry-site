import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowDownToLine,
    ArrowUpRight,
    Banknote,
    Check,
    ClipboardList,
    Clock3,
    Download,
    Image as ImageIcon,
    Plus,
    Printer,
    ReceiptText,
    RefreshCw,
    Search,
    Save,
    ShieldCheck,
    ShoppingBag,
    Users,
    Wallet,
    X,
    Tags,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatCurrency, formatDate, getErrorMessage } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import type {
    GarmentMaterial,
    OperationsSummary,
    Order,
    OrderStatus,
    PaymentMethod,
    PricingCatalog,
    CustomerSummary,
    SaleRecord,
    StaffMember,
    TagSearchResult,
    WalkInOrder,
} from '../types';
import StatusBadge from '../components/StatusBadge';
import siteConfig from '../config/site';

type AdminTab = 'overview' | 'orders' | 'sales' | 'staff' | 'pricing';
type Period = 'today' | '7d' | '30d';

const periodLabels: Record<Period, string> = {
    today: 'Today',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
};

const orderStatuses: OrderStatus[] = [
    'pending',
    'picked_up',
    'processing',
    'ready',
    'delivered',
    'cancelled',
];

const paymentMethods: PaymentMethod[] = ['cash', 'card', 'transfer'];

interface ReceiptDetails {
    receiptNumber: string;
    tagCode?: string;
    customerName: string;
    items: Order['items'];
    total: number;
    paymentMethod: PaymentMethod;
    createdAt: string;
    customer?: CustomerSummary;
}

type SelectedItem = { quantity: number; stainRemoval: boolean };

const orderCustomer = (order: Order): string =>
    typeof order.userId === 'string'
        ? 'Online customer'
        : `${order.userId.firstname} ${order.userId.lastname}`;

function useOperations(period: Period, ordersPage: number, salesPage: number) {
    return useQuery({
        queryKey: ['operations', period, ordersPage, salesPage],
        queryFn: async () => (
            await api.get<OperationsSummary>('/operations/summary', {
                params: { period, ordersPage, salesPage },
            })
        ).data,
    });
}

function PaginationControls({
    page,
    pageCount,
    onChange,
}: {
    page: number;
    pageCount: number;
    onChange: (page: number) => void;
}) {
    if (pageCount <= 1) return null;
    return (
        <div className="ops-pagination">
            <span>Page {page} of {pageCount}</span>
            <div>
                <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
                <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Next</button>
            </div>
        </div>
    );
}

function MetricCard({
    icon: Icon,
    label,
    value,
    detail,
    accent = false,
}: {
    icon: typeof Banknote;
    label: string;
    value: string;
    detail: string;
    accent?: boolean;
}) {
    return (
        <article className={`ops-metric${accent ? ' ops-metric-accent' : ''}`}>
            <span className="ops-metric-icon"><Icon size={17} /></span>
            <span className="ops-metric-label">{label}</span>
            <strong className="ops-metric-value">{value}</strong>
            <span className="ops-metric-detail">{detail}</span>
        </article>
    );
}

function SalesTable({ sales, compact = false }: { sales: SaleRecord[]; compact?: boolean }) {
    if (!sales.length) {
        return (
            <div className="ops-empty">
                <ReceiptText size={23} />
                <strong>No sales recorded in this period</strong>
                <span>Completed orders and cashier sales will show here.</span>
            </div>
        );
    }

    return (
        <div className="ops-table-wrap">
            <table className="ops-table">
                <thead>
                    <tr>
                        <th>Receipt</th>
                        <th>Customer</th>
                        <th>Payment</th>
                        {!compact && <th>Recorded by</th>}
                        <th>Date</th>
                        <th className="align-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {sales.map((sale) => (
                        <tr key={sale.id}>
                            <td>
                                <span className="table-main">{sale.receiptNumber}</span>
                                <span className="table-sub">{sale.source === 'walk-in' ? 'Walk-in sale' : 'Order payment'}</span>
                                {sale.tagCode && <span className="order-tag-code">ITEM TAG · {sale.tagCode}</span>}
                            </td>
                            <td>
                                <span className="table-main">{sale.customerName}</span>
                                <span className="table-sub">{sale.customer ? `Registered · ${sale.customer.email}` : sale.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</span>
                                {sale.customer && <span className="table-sub">{sale.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</span>}
                            </td>
                            <td><span className={`payment-method payment-${sale.paymentMethod}`}>{sale.paymentMethod}</span></td>
                            {!compact && (
                                <td>{sale.cashier ? `${sale.cashier.firstname} ${sale.cashier.lastname}` : '—'}</td>
                            )}
                            <td>{formatDate(sale.createdAt)}</td>
                            <td className="align-right table-amount">{formatCurrency(sale.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function OrderPhoto({ orderId, photoId }: { orderId: string; photoId: string }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        let active = true;
        let objectUrl = '';
        void api.get<Blob>(`/orders/${orderId}/photos/${photoId}`, { responseType: 'blob' })
            .then(({ data }) => {
                if (!active) return;
                objectUrl = URL.createObjectURL(data);
                setUrl(objectUrl);
            })
            .catch(() => {
                if (active) toast.error('An item photo could not be loaded.');
            });
        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [orderId, photoId]);

    return url ? <img className="order-photo-image" src={url} alt="Customer item" /> : <span className="order-photo-loading"><ImageIcon size={16} /></span>;
}

function VerifyOrderDialog({
    order,
    catalog,
    onClose,
    onVerify,
}: {
    order: Order;
    catalog: PricingCatalog;
    onClose: () => void;
    onVerify: (orderId: string, items: Array<{ lineId: string; materialId: string; quantity: number; stainRemoval: boolean }>) => void;
}) {
    const [items, setItems] = useState(() => order.items.map((item) => ({
        lineId: item.lineId ?? '',
        tagCode: item.tagCode,
        materialId: item.materialId ?? catalog.materials[0]?.id ?? '',
        quantity: item.quantity,
        stainRemoval: item.stainRemoval ?? false,
        name: item.name,
        photos: item.photos ?? [],
    })));
    const [busy, setBusy] = useState(false);
    const total = items.reduce((sum, item) => {
        const material = catalog.materials.find((candidate) => candidate.id === item.materialId);
        return sum + ((material?.price ?? 0) + (item.stainRemoval ? catalog.stainRemovalFee : 0)) * item.quantity;
    }, 0);

    const submit = async () => {
        if (items.some((item) => !item.lineId || !item.materialId)) {
            toast.error('This order is missing item identifiers and cannot be verified.');
            return;
        }
        setBusy(true);
        try {
            await onVerify(order._id, items.map(({ lineId, materialId, quantity, stainRemoval }) => ({
                lineId, materialId, quantity, stainRemoval,
            })));
        } catch {
            return;
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="receipt-overlay" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) onClose();
        }}>
            <section className="receipt-dialog verify-dialog" role="dialog" aria-modal="true" aria-labelledby="verify-order-title">
                <div className="receipt-dialog-heading">
                    <div><span className="section-kicker">Cashier verification · #{order._id.slice(-7).toUpperCase()}</span><h2 id="verify-order-title">Confirm items & price</h2></div>
                    <button type="button" className="receipt-close" aria-label="Close verification" onClick={onClose} disabled={busy}><X size={17} /></button>
                </div>
                <p className="verify-intro">Review the submitted items, adjust the service type, quantity or stain treatment, and verify the final total before collecting payment.</p>
                <div className="verify-items">
                    {items.map((item, index) => (
                        <article className="verify-item" key={item.lineId || index}>
                            <span className="order-tag-code">ITEM TAG · {item.tagCode || order.tagCode || '—'}</span>
                            <label className="field"><span>Material</span>
                                <select value={item.materialId} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, materialId: event.target.value } : entry))}>
                                    {catalog.materials.map((material) => <option value={material.id} key={material.id}>{material.name} · {formatCurrency(material.price)}</option>)}
                                </select>
                            </label>
                            <label className="field"><span>Quantity</span><input type="number" min="1" max="100" value={item.quantity} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: Math.max(1, Math.min(100, Number(event.target.value) || 1)) } : entry))} /></label>
                            <label className="stain-option"><input type="checkbox" checked={item.stainRemoval} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, stainRemoval: event.target.checked } : entry))} /> Stain removal <small>+{formatCurrency(catalog.stainRemovalFee)} / item</small></label>
                            {!!item.photos.length && <div className="order-photo-gallery">{item.photos.map((photo) => {
                                const id = typeof photo === 'string' ? photo : photo._id;
                                return <OrderPhoto key={id} orderId={order._id} photoId={id} />;
                            })}</div>}
                        </article>
                    ))}
                </div>
                <div className="verify-total"><span>Verified order total</span><strong>{formatCurrency(total)}</strong></div>
                <div className="verify-actions">
                    <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="button" className="button button-dark" onClick={() => void submit()} disabled={busy}>{busy ? 'Verifying…' : 'Confirm & verify'} <Check size={15} /></button>
                </div>
            </section>
        </div>
    );
}

function OrderTable({
    orders,
    onStatus,
    onPayment,
    onVerify,
    catalog,
    isAdmin,
}: {
    orders: Order[];
    onStatus: (orderId: string, status: OrderStatus) => void;
    onPayment: (orderId: string, paymentMethod: PaymentMethod) => void;
    onVerify: (orderId: string, items: Array<{ lineId: string; materialId: string; quantity: number; stainRemoval: boolean }>) => Promise<void>;
    catalog?: PricingCatalog;
    isAdmin: boolean;
}) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'unpaid' | 'verification' | OrderStatus>('all');
    const [methods, setMethods] = useState<Record<string, PaymentMethod>>({});
    const [verificationOrder, setVerificationOrder] = useState<Order | null>(null);

    const filteredOrders = orders.filter((order) => {
        const matchesFilter = filter === 'all'
            || (filter === 'unpaid'
                ? order.paymentStatus !== 'paid' && order.verificationStatus !== 'pending'
                : filter === 'verification'
                    ? order.verificationStatus === 'pending'
                    : order.status === filter);
        const searchTerm = search.trim().toLowerCase();
        const matchesSearch = !searchTerm
            || orderCustomer(order).toLowerCase().includes(searchTerm)
            || order._id.toLowerCase().includes(searchTerm)
            || order.tagCode?.toLowerCase().includes(searchTerm)
            || order.pickupAddress.toLowerCase().includes(searchTerm);
        return matchesFilter && matchesSearch;
    });

    return (
        <div className="ops-orders">
            <div className="ops-list-controls">
                <label className="ops-search">
                    <Search size={16} />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page’s orders" />
                </label>
                <select aria-label="Filter orders" className="ops-filter" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                    <option value="all">All orders</option>
                    <option value="unpaid">Payment due</option>
                    <option value="verification">Awaiting verification</option>
                    {orderStatuses.map((status) => <option value={status} key={status}>{status.replace('_', ' ')}</option>)}
                </select>
            </div>
            {filteredOrders.length === 0 ? (
                <div className="ops-empty"><ClipboardList size={23} /><strong>No matching orders</strong><span>Try another search or filter.</span></div>
            ) : (
                <div className="ops-table-wrap">
                    <table className="ops-table ops-order-table">
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Customer & pickup</th>
                                <th>Items & tags</th>
                                <th>Order status</th>
                                <th>Payment</th>
                                <th className="align-right">Total</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order) => (
                                <tr key={order._id}>
                                    <td>
                                        <span className="table-main">{order.tagCode || '—'}</span>
                                        <span className="table-sub">{formatDate(order.createdAt)}</span>
                                    </td>
                                    <td>
                                        <span className="table-main">{orderCustomer(order)}</span>
                                        <span className="table-sub">{order.pickupAddress}</span>
                                    </td>
                                    <td><div className="ops-item-tags">{order.items.map((item, index) => (
                                        <span key={item.lineId || index}>{item.name} × {item.quantity}<small>Tag · {item.tagCode || order.tagCode || '—'}</small></span>
                                    ))}</div></td>
                                    <td>
                                        <StatusBadge status={order.status} />
                                        <span className={`verification-badge${order.verificationStatus !== 'pending' ? ' is-verified' : ''}`}>
                                            {order.verificationStatus === 'pending' ? 'Awaiting verification' : 'Verified'}
                                        </span>
                                        <span className="table-sub ops-pickup-date">Pickup {formatDate(order.pickupDate)}</span>
                                    </td>
                                    <td>
                                        <span className={`payment-method payment-${order.paymentStatus}`}>
                                            {order.paymentStatus === 'paid' ? `Paid · ${order.paymentMethod}` : 'Due'}
                                        </span>
                                        {order.receiptNumber && <span className="table-sub">{order.receiptNumber}</span>}
                                    </td>
                                    <td className="align-right table-amount">{formatCurrency(order.total)}</td>
                                    <td>
                                        <div className="order-actions">
                                            <select
                                                aria-label={`Update status for order ${order._id.slice(-7)}`}
                                                value={order.status}
                                                onChange={(event) => onStatus(order._id, event.target.value as OrderStatus)}
                                            >
                                                {orderStatuses.map((status) => <option value={status} key={status}>{status.replace('_', ' ')}</option>)}
                                            </select>
                                            {order.verificationStatus === 'pending' && order.status !== 'cancelled' && (
                                                <button type="button" className="record-payment" onClick={() => setVerificationOrder(order)} disabled={!catalog}>
                                                    <Check size={12} /> Verify items
                                                </button>
                                            )}
                                            {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && order.verificationStatus !== 'pending' && (
                                                <div className="inline-payment">
                                                    <select
                                                        aria-label={`Payment method for order ${order._id.slice(-7)}`}
                                                        value={methods[order._id] || 'cash'}
                                                        onChange={(event) => setMethods((current) => ({
                                                            ...current,
                                                            [order._id]: event.target.value as PaymentMethod,
                                                        }))}
                                                    >
                                                        {paymentMethods.map((method) => <option value={method} key={method}>{method}</option>)}
                                                    </select>
                                                    <button type="button" className="record-payment" onClick={() => onPayment(order._id, methods[order._id] || 'cash')}>
                                                        <Check size={12} /> Collect
                                                    </button>
                                                </div>
                                            )}
                                            {isAdmin && order.paymentStatus === 'paid' && (
                                                <span className="table-sub">Paid {order.paidAt ? formatDate(order.paidAt) : ''}</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {verificationOrder && catalog && (
                <VerifyOrderDialog
                    order={verificationOrder}
                    catalog={catalog}
                    onClose={() => setVerificationOrder(null)}
                    onVerify={async (orderId, items) => {
                        await onVerify(orderId, items);
                        setVerificationOrder(null);
                    }}
                />
            )}
        </div>
    );
}

function WalkInTracking({
    jobs,
    onStatus,
}: {
    jobs: WalkInOrder[];
    onStatus: (saleId: string, status: OrderStatus) => void;
}) {
    return (
        <section className="ops-panel walk-in-tracking">
            <div className="ops-panel-heading">
                <div><span className="section-kicker">Counter service</span><h2>Walk-in job tracking</h2></div>
                <span className="ops-heading-icon"><ShoppingBag size={17} /></span>
            </div>
            {!jobs.length ? (
                <div className="ops-empty"><ClipboardList size={23} /><strong>No walk-in jobs yet</strong><span>Walk-in items will appear here after a sale is recorded.</span></div>
            ) : (
                <div className="ops-table-wrap">
                    <table className="ops-table">
                        <thead><tr><th>Item tag</th><th>Customer & items</th><th>Received</th><th>Status</th><th className="align-right">Total</th><th>Update</th></tr></thead>
                        <tbody>
                            {jobs.map((job) => (
                                <tr key={job._id}>
                                    <td><span className="order-tag-code">{job.tagCode || '—'}</span><span className="table-sub">{job.receiptNumber}</span></td>
                                    <td><span className="table-main">{job.customerName}</span><div className="ops-item-tags">{job.items.map((item, index) => <span key={item.lineId || index}>{item.name} × {item.quantity}<small>Tag · {item.tagCode || job.tagCode || '—'}</small></span>)}</div></td>
                                    <td>{formatDate(job.createdAt)}</td>
                                    <td><StatusBadge status={job.status} /></td>
                                    <td className="align-right table-amount">{formatCurrency(job.total)}</td>
                                    <td><select className="walk-in-status-select" aria-label={`Update walk-in ${job.tagCode || job._id} status`} value={job.status} onChange={(event) => onStatus(job._id, event.target.value as OrderStatus)}>{orderStatuses.map((status) => <option value={status} key={status}>{status.replace('_', ' ')}</option>)}</select></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function ItemTagLookup() {
    const [code, setCode] = useState('');
    const [date, setDate] = useState(() => {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    });
    const [query, setQuery] = useState<{ code: string; date: string } | null>(null);
    const { data, isFetching, isError } = useQuery({
        queryKey: ['item-tag-search', query],
        queryFn: async () => {
            if (!query) throw new Error('Enter a tag code and date to search.');
            const start = new Date(`${query.date}T00:00:00`);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            return (await api.get<{ results: TagSearchResult[] }>('/operations/tags', {
                params: { code: query.code, start: start.toISOString(), end: end.toISOString() },
            })).data.results;
        },
        enabled: query !== null,
    });

    const search = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!/^\d{4}$/.test(code)) {
            toast.error('Enter the four-digit item tag code.');
            return;
        }
        setQuery({ code, date });
    };

    return (
        <section className="ops-panel item-tag-lookup">
            <div className="ops-panel-heading">
                <div><span className="section-kicker">Find tagged items</span><h2>Search item tag</h2></div>
                <span className="ops-heading-icon"><Search size={17} /></span>
            </div>
            <form className="tag-search-form" onSubmit={search}>
                <label className="field"><span>Four-digit code</span><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="0001" required /></label>
                <label className="field"><span>Registered date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
                <button className="button button-dark" type="submit" disabled={isFetching}>{isFetching ? 'Searching…' : 'Find code'} <Search size={14} /></button>
            </form>
            {isError && <p className="notice notice-error">We could not search this tag. Please try again.</p>}
            {data && !isFetching && data.length === 0 && <div className="tag-search-empty">No item tags match {query?.code} on {query?.date}.</div>}
            {!!data?.length && (
                <div className="tag-search-results">
                    {data.map((result) => (
                        <article className="tag-search-result" key={`${result.recordType}-${result.recordId}`}>
                            <div><strong>{result.code}</strong><span>{result.recordType === 'walk-in' ? 'Walk-in' : 'Customer order'} · {result.customerName}</span></div>
                            <span className={`tag-result-state${result.releasedAt ? ' is-released' : ''}`}>{result.releasedAt ? 'Code reusable' : `Code assigned · ${result.status.replace('_', ' ')}`}</span>
                            <small>{formatDate(result.createdAt)} · {result.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</small>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

function WalkInSaleForm({
    materials,
    stainRemovalFee,
    onReceipt,
}: {
    materials: GarmentMaterial[];
    stainRemovalFee: number;
    onReceipt: (receipt: ReceiptDetails) => void;
}) {
    const queryClient = useQueryClient();
    const [items, setItems] = useState<Record<string, SelectedItem>>({});
    const [customerMode, setCustomerMode] = useState<'walk-in' | 'existing' | 'new'>('walk-in');
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
    const [busy, setBusy] = useState(false);
    const { data: customerMatches, isLoading: isSearchingCustomers, isError: customerSearchError } = useQuery({
        queryKey: ['customer-search', customerSearch.trim()],
        queryFn: async () => (await api.get<{ customers: CustomerSummary[] }>('/operations/customers', {
            params: { search: customerSearch.trim() },
        })).data.customers,
        enabled: customerMode === 'existing' && customerSearch.trim().length >= 2,
    });
    const selected = Object.entries(items).filter(([, item]) => item.quantity > 0);
    const total = useMemo(() => selected.reduce((sum, [id, item]) => {
        const material = materials.find((candidate) => candidate.id === id);
        return sum + ((material?.price ?? 0) + (item.stainRemoval ? stainRemovalFee : 0)) * item.quantity;
    }, 0), [selected, materials, stainRemovalFee]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selected.length) {
            toast.error('Choose at least one item type to record a sale.');
            return;
        }
        if (customerMode === 'existing' && !selectedCustomer) {
            toast.error('Search for and select a customer account, or choose another customer option.');
            return;
        }

        const form = event.currentTarget;
        const formData = new FormData(form);
        const newCustomer = customerMode === 'new' ? {
            firstname: String(formData.get('firstname') || ''),
            lastname: String(formData.get('lastname') || ''),
            email: String(formData.get('email') || ''),
            phone: String(formData.get('phone') || ''),
            password: String(formData.get('temporaryPassword') || ''),
        } : undefined;
        setBusy(true);
        try {
            const { data } = await api.post<{
                sale: ReceiptDetails;
                customer?: CustomerSummary;
                customerCreated: boolean;
            }>('/operations/sales', {
                items: selected.map(([materialId, item]) => ({
                    materialId,
                    quantity: item.quantity,
                    stainRemoval: item.stainRemoval,
                })),
                ...(customerMode === 'walk-in' ? {
                    customerName: String(formData.get('customerName') || 'Walk-in customer'),
                    customerPhone: String(formData.get('customerPhone') || ''),
                } : customerMode === 'existing' ? {
                    customerId: selectedCustomer?._id,
                } : { newCustomer }),
                paymentMethod: String(formData.get('paymentMethod')),
                notes: String(formData.get('notes') || ''),
            });
            toast.success(data.customerCreated
                ? `Customer account created and sale recorded · ${data.sale.receiptNumber}`
                : `Sale recorded · ${data.sale.receiptNumber}`);
            onReceipt({ ...data.sale, customer: data.customer });
            setItems({});
            setCustomerMode('walk-in');
            setCustomerSearch('');
            setSelectedCustomer(null);
            form.reset();
            await queryClient.invalidateQueries({ queryKey: ['operations'] });
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not record this sale. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="cash-sale-form" onSubmit={submit}>
            <div className="cash-sale-heading">
                <div>
                    <span className="section-kicker">Counter sale</span>
                    <h2>Record a walk-in</h2>
                    <p>Link the sale to a customer account or keep it as an unregistered walk-in.</p>
                </div>
                <span className="cash-sale-icon"><ShoppingBag size={19} /></span>
            </div>
            <div className="cash-sale-services">
                {materials.map((material) => {
                    const selection = items[material.id];
                    const quantity = selection?.quantity ?? 0;
                    return (
                        <div className={`cash-service${quantity > 0 ? ' is-selected' : ''}`} key={material.id}>
                            <label className="cash-material-choice">
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
                                <span className="cash-check">{quantity > 0 && <Check size={11} />}</span>
                                <span className="cash-service-text"><strong>{material.name}</strong><small>{formatCurrency(material.price)} each</small></span>
                            </label>
                            {quantity > 0 && (
                                <div className="cash-item-options">
                                    <input
                                        aria-label={`${material.name} quantity`}
                                        className="cash-quantity"
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={quantity}
                                        onChange={(event) => setItems((current) => ({
                                            ...current,
                                            [material.id]: { ...current[material.id]!, quantity: Math.max(1, Math.min(100, Number(event.target.value) || 1)) },
                                        }))}
                                    />
                                    <label className="stain-option"><input type="checkbox" checked={selection.stainRemoval} onChange={(event) => setItems((current) => ({
                                        ...current,
                                        [material.id]: { ...current[material.id]!, stainRemoval: event.target.checked },
                                    }))} /> Stain removal <small>+{formatCurrency(stainRemovalFee)}</small></label>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="cash-sale-fields">
                <fieldset className="customer-mode-fieldset">
                    <legend>Customer</legend>
                    <div className="customer-mode-tabs" role="group" aria-label="Customer account option">
                        <button type="button" className={customerMode === 'walk-in' ? 'is-active' : ''} onClick={() => setCustomerMode('walk-in')}>No account</button>
                        <button type="button" className={customerMode === 'existing' ? 'is-active' : ''} onClick={() => {
                            setCustomerMode('existing');
                            setSelectedCustomer(null);
                        }}>Link existing</button>
                        <button type="button" className={customerMode === 'new' ? 'is-active' : ''} onClick={() => {
                            setCustomerMode('new');
                            setSelectedCustomer(null);
                        }}>Create account</button>
                    </div>
                </fieldset>
                {customerMode === 'walk-in' && (
                    <>
                        <label className="field"><span>Customer name <small>Optional</small></span><input name="customerName" maxLength={120} placeholder="Walk-in customer" /></label>
                        <label className="field"><span>Phone number <small>Optional</small></span><input name="customerPhone" type="tel" maxLength={20} placeholder="Customer phone" /></label>
                    </>
                )}
                {customerMode === 'existing' && (
                    <div className="customer-picker">
                        {selectedCustomer ? (
                            <div className="selected-customer">
                                <span><strong>{selectedCustomer.firstname} {selectedCustomer.lastname}</strong><small>{selectedCustomer.email} · {selectedCustomer.phone}</small></span>
                                <button type="button" onClick={() => setSelectedCustomer(null)}>Change</button>
                            </div>
                        ) : (
                            <>
                                <label className="field"><span>Find a registered customer</span><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} autoComplete="off" placeholder="Search name, email or phone" /></label>
                                {customerSearch.trim().length < 2 && <small className="customer-hint">Enter at least 2 characters to search.</small>}
                                {isSearchingCustomers && <small className="customer-hint">Searching customer accounts…</small>}
                                {customerSearchError && <p className="notice notice-error">Customer search failed. Please try again.</p>}
                                {!!customerMatches?.length && (
                                    <div className="customer-results">
                                        {customerMatches.map((customer) => (
                                            <button type="button" key={customer._id} onClick={() => setSelectedCustomer(customer)}>
                                                <strong>{customer.firstname} {customer.lastname}</strong>
                                                <span>{customer.email} · {customer.phone}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {customerMatches?.length === 0 && customerSearch.trim().length >= 2 && !isSearchingCustomers && <small className="customer-hint">No matching customer found. Create an account if they are new.</small>}
                            </>
                        )}
                    </div>
                )}
                {customerMode === 'new' && (
                    <div className="customer-create-fields">
                        <div className="field-row">
                            <label className="field"><span>First name</span><input name="firstname" maxLength={60} autoComplete="given-name" required /></label>
                            <label className="field"><span>Last name</span><input name="lastname" maxLength={60} autoComplete="family-name" required /></label>
                        </div>
                        <label className="field"><span>Email address</span><input name="email" type="email" maxLength={254} autoComplete="email" required /></label>
                        <label className="field"><span>Phone number</span><input name="phone" type="tel" minLength={7} maxLength={20} autoComplete="tel" required /></label>
                        <label className="field"><span>Temporary password</span><input name="temporaryPassword" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /><small className="staff-password-hint">Share this with the customer securely so they can sign in.</small></label>
                    </div>
                )}
                <label className="field"><span>Payment received</span><select name="paymentMethod" defaultValue="cash">{paymentMethods.map((method) => <option value={method} key={method}>{method[0]!.toUpperCase() + method.slice(1)}</option>)}</select></label>
                <label className="field"><span>Sale note <small>Optional</small></span><input name="notes" maxLength={500} placeholder="Short reference or note" /></label>
            </div>
            <div className="cash-sale-total"><span>Total received</span><strong>{formatCurrency(total)}</strong></div>
            <button type="submit" className="button button-dark button-wide" disabled={busy || (customerMode === 'existing' && !selectedCustomer)}>
                {busy ? 'Recording sale…' : 'Record sale & issue receipt'} <ArrowUpRight size={15} />
            </button>
            <p className="cash-sale-footnote"><ShieldCheck size={13} /> Prices and stain fees come from the admin-managed service list.</p>
        </form>
    );
}

function PricingPanel({ catalog }: { catalog: PricingCatalog }) {
    const queryClient = useQueryClient();
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [stainRemovalFee, setStainRemovalFee] = useState(catalog.stainRemovalFee);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setPrices(Object.fromEntries(catalog.materials.map((material) => [material.id, material.price])));
        setStainRemovalFee(catalog.stainRemovalFee);
    }, [catalog]);

    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        try {
            const { data } = await api.put<PricingCatalog>('/operations/pricing', {
                materials: catalog.materials.map((material) => ({ id: material.id, price: prices[material.id] })),
                stainRemovalFee,
            });
            queryClient.setQueryData(['materials'], data);
            await queryClient.invalidateQueries({ queryKey: ['operations'] });
            toast.success('Service prices and stain fee updated.');
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not save the new pricing.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="ops-panel pricing-panel" onSubmit={save}>
            <div className="ops-panel-heading">
                <div><span className="section-kicker">Pricing controls</span><h2>Service list</h2></div>
                <span className="ops-heading-icon"><Tags size={17} /></span>
            </div>
            <p className="ledger-note">These prices power customer estimates, cashier intake and order verification. Changes apply to new estimates and unverified orders.</p>
            <div className="pricing-grid">
                {catalog.materials.map((material) => (
                    <label className="field pricing-field" key={material.id}>
                        <span>{material.name}</span>
                        <span className="pricing-input-wrap"><span>₦</span><input type="number" min="0" max="1000000" step="1" value={prices[material.id] ?? material.price} onChange={(event) => setPrices((current) => ({ ...current, [material.id]: Math.max(0, Math.min(1_000_000, Number(event.target.value) || 0)) }))} required /></span>
                    </label>
                ))}
            </div>
            <div className="pricing-footer">
                <label className="field"><span>Stain removal fee <small>per item</small></span><span className="pricing-input-wrap"><span>₦</span><input type="number" min="0" max="1000000" step="1" value={stainRemovalFee} onChange={(event) => setStainRemovalFee(Math.max(0, Math.min(1_000_000, Number(event.target.value) || 0)))} required /></span></label>
                <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Saving prices…' : 'Save pricing'} <Save size={15} /></button>
            </div>
        </form>
    );
}

function ReceiptDialog({ receipt, onClose }: { receipt: ReceiptDetails; onClose: () => void }) {
    return (
        <div className="receipt-overlay" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section className="receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
                <div className="receipt-dialog-heading">
                    <div><span className="section-kicker">Payment recorded</span><h2 id="receipt-title">Receipt ready</h2></div>
                    <button type="button" className="receipt-close" aria-label="Close receipt" onClick={onClose}><X size={17} /></button>
                </div>
                <div className="receipt-paper">
                    <div className="receipt-brand"><span className="brand-mark"><Banknote size={16} /></span><strong>{siteConfig.name}<span>.</span></strong></div>
                    <p className="receipt-label">PAYMENT RECEIPT</p>
                    <div className="receipt-reference"><span>Receipt number</span><strong>{receipt.receiptNumber}</strong></div>
                    {receipt.tagCode && <div className="receipt-reference"><span>Item tag code</span><strong>{receipt.tagCode}</strong></div>}
                    <div className="receipt-reference"><span>Customer</span><strong>{receipt.customer?.firstname ? `${receipt.customer.firstname} ${receipt.customer.lastname}` : receipt.customerName}</strong></div>
                    {receipt.customer && <div className="receipt-reference"><span>Account</span><strong>{receipt.customer.email}</strong></div>}
                    <div className="receipt-reference"><span>Date</span><strong>{formatDate(receipt.createdAt)}</strong></div>
                    <div className="receipt-items">
                        {receipt.items.map((item) => (
                            <div className="receipt-item" key={`${item.lineId ?? item.materialId}-${item.name}`}>
                                <span>{item.name} × {item.quantity}<small className="receipt-item-tag">Tag · {item.tagCode || receipt.tagCode}</small></span>
                                <strong>{formatCurrency(item.lineTotal ?? (item.unitPrice + (item.stainRemovalFee ?? 0)) * item.quantity)}</strong>
                            </div>
                        ))}
                    </div>
                    <div className="receipt-reference"><span>Paid by</span><strong>{receipt.paymentMethod}</strong></div>
                    <div className="receipt-total"><span>Total received</span><strong>{formatCurrency(receipt.total)}</strong></div>
                    <p className="receipt-thanks">Thank you for choosing {siteConfig.name}.<br />{siteConfig.copy.footerTagline}</p>
                </div>
                <button type="button" className="button button-dark button-wide receipt-print-button" onClick={() => window.print()}>
                    <Printer size={15} /> Print receipt
                </button>
            </section>
        </div>
    );
}

function StaffPanel() {
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState(false);
    const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null);
    const { data: staff, isLoading, isError } = useQuery({
        queryKey: ['operations-staff'],
        queryFn: async () => (await api.get<{ staff: StaffMember[] }>('/operations/staff')).data.staff,
    });

    const createStaff = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        setBusy(true);
        try {
            await api.post('/operations/staff/cashiers', {
                firstname: String(formData.get('firstname')),
                lastname: String(formData.get('lastname')),
                username: String(formData.get('username')),
                email: String(formData.get('email')),
                phone: String(formData.get('phone')),
                password: String(formData.get('password')),
            });
            form.reset();
            toast.success('Cashier account created.');
            await queryClient.invalidateQueries({ queryKey: ['operations-staff'] });
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not create the cashier account.'));
        } finally {
            setBusy(false);
        }
    };

    const toggleStaffStatus = async (member: StaffMember) => {
        setUpdatingStaffId(member.id);
        try {
            await api.patch(`/operations/staff/${member.id}/status`, { active: !member.active });
            toast.success(`${member.firstname}'s account ${member.active ? 'deactivated' : 'reactivated'}.`);
            await queryClient.invalidateQueries({ queryKey: ['operations-staff'] });
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not update that cashier account.'));
        } finally {
            setUpdatingStaffId(null);
        }
    };

    return (
        <div className="staff-layout">
            <section className="ops-panel">
                <div className="ops-panel-heading">
                    <div><span className="section-kicker">Your team</span><h2>Staff accounts</h2></div>
                    <span className="ops-heading-icon"><Users size={18} /></span>
                </div>
                {isLoading && <div className="inline-loading"><span className="spinner" /> Loading staff…</div>}
                {isError && <p className="notice notice-error">Staff accounts could not be loaded.</p>}
                {staff && staff.length === 0 && <div className="ops-empty"><Users size={22} /><strong>No staff accounts yet</strong></div>}
                {!!staff?.length && (
                    <div className="staff-list">
                        {staff.map((member) => (
                            <article className="staff-row" key={member.id}>
                                <span className={`staff-avatar staff-${member.role}${member.active ? '' : ' staff-avatar-inactive'}`}>{member.firstname.slice(0, 1)}{member.lastname.slice(0, 1)}</span>
                                <div className="staff-person"><strong>{member.firstname} {member.lastname}</strong><span>{member.email} · {member.phone}</span></div>
                                <span className={`staff-role role-${member.role}`}>{member.role}</span>
                                {member.role === 'cashier' && (
                                    <button
                                        type="button"
                                        className={`staff-toggle${member.active ? '' : ' is-inactive'}`}
                                        disabled={updatingStaffId === member.id}
                                        onClick={() => void toggleStaffStatus(member)}
                                    >
                                        {updatingStaffId === member.id ? 'Saving…' : member.active ? 'Deactivate' : 'Reactivate'}
                                    </button>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </section>
            <form className="ops-panel staff-create-form" onSubmit={createStaff}>
                <div className="ops-panel-heading">
                    <div><span className="section-kicker">Grow your team</span><h2>Add a cashier</h2></div>
                    <span className="ops-heading-icon"><Plus size={18} /></span>
                </div>
                <p className="staff-form-note">Cashiers can record sales, take order payments and update order progress. They cannot access staff accounts.</p>
                <div className="field-row">
                    <label className="field"><span>First name</span><input name="firstname" autoComplete="given-name" maxLength={60} required /></label>
                    <label className="field"><span>Last name</span><input name="lastname" autoComplete="family-name" maxLength={60} required /></label>
                </div>
                <label className="field"><span>Username</span><input name="username" minLength={3} maxLength={30} pattern="[a-zA-Z0-9._-]+" required /></label>
                <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required /></label>
                <label className="field"><span>Phone number</span><input name="phone" type="tel" minLength={7} maxLength={20} required /></label>
                <label className="field"><span>Temporary password</span><input name="password" type="password" minLength={12} maxLength={72} autoComplete="new-password" required /><small className="staff-password-hint">Use at least 12 characters. Share it securely with the cashier.</small></label>
                <button type="submit" className="button button-dark button-wide" disabled={busy}>{busy ? 'Creating account…' : 'Create cashier account'} <ArrowUpRight size={15} /></button>
            </form>
        </div>
    );
}

function exportSales(sales: SaleRecord[]): void {
    const rows = [
        ['Receipt', 'Source', 'Customer', 'Items', 'Payment method', 'Recorded at', 'Total'],
        ...sales.map((sale) => [
            sale.receiptNumber,
            sale.source,
            sale.customerName,
            sale.items.map((item) => `${item.name} x ${item.quantity}`).join('; '),
            sale.paymentMethod,
            new Date(sale.createdAt).toISOString(),
            sale.total.toString(),
        ]),
    ];
    const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${siteConfig.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OperationsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const isCashier = user?.role === 'cashier';
    const [tab, setTab] = useState<AdminTab>('overview');
    const [period, setPeriod] = useState<Period>('7d');
    const [ordersPage, setOrdersPage] = useState(1);
    const [salesPage, setSalesPage] = useState(1);
    const [receipt, setReceipt] = useState<ReceiptDetails | null>(null);
    const queryClient = useQueryClient();
    const { data, isLoading, isError, refetch } = useOperations(period, ordersPage, salesPage);
    const {
        data: catalog,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
        refetch: refetchCatalog,
    } = useQuery({
        queryKey: ['materials'],
        queryFn: async () => (await api.get<PricingCatalog>('/materials')).data,
    });

    const updateStatus = async (orderId: string, status: OrderStatus) => {
        try {
            await api.patch(`/orders/${orderId}/status`, { status });
            toast.success('Order status updated.');
            await queryClient.invalidateQueries({ queryKey: ['operations'] });
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not update that order.'));
        }
    };

    const collectPayment = async (orderId: string, paymentMethod: PaymentMethod) => {
        try {
            const { data: result } = await api.post<{ order: Order }>(`/orders/${orderId}/payment`, { paymentMethod });
            toast.success(`Payment recorded · ${result.order.receiptNumber}`);
            setReceipt({
                receiptNumber: result.order.receiptNumber || '',
                tagCode: result.order.tagCode,
                customerName: orderCustomer(result.order),
                items: result.order.items,
                total: result.order.total,
                paymentMethod,
                createdAt: result.order.paidAt || new Date().toISOString(),
            });
            await queryClient.invalidateQueries({ queryKey: ['operations'] });
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not record that payment.'));
        }
    };

    const verifyOrder = async (
        orderId: string,
        items: Array<{ lineId: string; materialId: string; quantity: number; stainRemoval: boolean }>,
    ) => {
        try {
            await api.post(`/orders/${orderId}/verify`, { items });
            toast.success('Order items and final price verified.');
            await queryClient.invalidateQueries({ queryKey: ['operations'] });
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not verify this order.'));
            throw error;
        }
    };

    const updateWalkInStatus = async (saleId: string, status: OrderStatus) => {
        try {
            await api.patch(`/operations/walk-ins/${saleId}/status`, { status });
            toast.success(status === 'delivered'
                ? 'Walk-in job marked delivered. Its tag code is now reusable.'
                : 'Walk-in job status updated.');
            await queryClient.invalidateQueries({ queryKey: ['operations'] });
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not update that walk-in job.'));
        }
    };

    const tabs: Array<{ id: AdminTab; label: string; icon: typeof Banknote }> = [
        { id: 'overview', label: 'Overview', icon: ClipboardList },
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
        { id: 'sales', label: 'Sales & receipts', icon: ReceiptText },
        { id: 'pricing', label: 'Service pricing', icon: Tags },
        { id: 'staff', label: 'Staff', icon: Users },
    ];

    return (
        <section className="operations-page">
            <div className="ops-topbar">
                <div className="ops-topbar-brand">
                    <span className="ops-brand-mark">{isAdmin ? <ShieldCheck size={17} /> : <Banknote size={18} />}</span>
                    <span><strong>{isAdmin ? 'Operations' : 'Cashier desk'}</strong><small>{siteConfig.name} · {isAdmin ? 'ADMINISTRATION' : 'POINT OF SALE'}</small></span>
                </div>
                <div className="ops-topbar-user">
                    <span className="ops-live-dot" /> {isAdmin ? 'Admin workspace' : 'Sales desk open'}
                    <span className="ops-user-avatar">{user?.firstname.slice(0, 1)}{user?.lastname.slice(0, 1)}</span>
                    <strong>{user?.firstname} {user?.lastname}</strong>
                </div>
            </div>

            <div className="ops-shell">
                {isAdmin && (
                    <nav className="ops-tabs" aria-label="Operations sections">
                        {tabs.map(({ id, label, icon: Icon }) => (
                            <button type="button" key={id} className={`ops-tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
                                <Icon size={16} /> {label}
                                {id === 'orders' && !!data?.summary.unpaidOrders && <span className="ops-tab-count">{data.summary.unpaidOrders}</span>}
                            </button>
                        ))}
                    </nav>
                )}

                <header className="ops-page-heading">
                    <div>
                        <span className="section-kicker">{isAdmin ? 'Business at a glance' : `Welcome back, ${user?.firstname}`}</span>
                        <h1>{isAdmin ? tab === 'orders' ? 'Order management' : tab === 'sales' ? 'Sales & receipts' : tab === 'staff' ? 'Your team' : tab === 'pricing' ? 'Service pricing' : 'Everything running smoothly.' : 'Let’s make today count.'}</h1>
                        <p>{isAdmin ? 'A clear view of today’s work, your sales and your team.' : 'Record counter sales, collect payments and keep every order moving.'}</p>
                    </div>
                    <div className="ops-heading-actions">
                        <label className="ops-period"><Clock3 size={15} /><select aria-label="Sales reporting period" value={period} onChange={(event) => {
                            setPeriod(event.target.value as Period);
                            setSalesPage(1);
                        }}>{Object.entries(periodLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                        <button type="button" className="ops-refresh" aria-label="Refresh operations data" onClick={() => {
                            void refetch();
                            void refetchCatalog();
                        }}><RefreshCw size={15} /></button>
                    </div>
                </header>

                {isError && <p className="notice notice-error">Operations data could not be loaded. Please try again.</p>}
                {isLoading && <div className="inline-loading"><span className="spinner" /> Loading your operations…</div>}
                {isCatalogError && <p className="notice notice-error">The service list could not be loaded. Please use refresh to retry before recording or verifying orders.</p>}

                {data && (
                    <>
                        <div className="ops-metrics">
                            <MetricCard icon={Wallet} label="Collected revenue" value={formatCurrency(data.summary.revenue)} detail={periodLabels[period]} accent />
                            <MetricCard icon={ReceiptText} label="Completed sales" value={String(data.summary.salesCount)} detail="Paid orders + counter sales" />
                            <MetricCard icon={ArrowDownToLine} label="Payments due" value={String(data.summary.unpaidOrders)} detail="Active orders to collect" />
                            <MetricCard icon={ShoppingBag} label="Orders in progress" value={String(data.summary.activeOrders)} detail={`${data.summary.ordersCount} total orders`} />
                        </div>

                        {(isCashier || (isAdmin && tab === 'overview')) && (
                            <section className="ops-overview-grid">
                                <div className="ops-panel ops-panel-sales">
                                    <div className="ops-panel-heading">
                                        <div><span className="section-kicker">Latest receipts</span><h2>Recent sales</h2></div>
                                        <button type="button" className="ops-text-button" onClick={() => isAdmin && setTab('sales')}>View all <ArrowUpRight size={14} /></button>
                                    </div>
                                    <SalesTable sales={data.sales.slice(0, 6)} compact />
                                </div>
                                <div className="ops-panel ops-panel-attention">
                                    <div className="ops-panel-heading">
                                        <div><span className="section-kicker">Keep things moving</span><h2>Needs attention</h2></div>
                                        <span className="ops-heading-icon"><ClipboardList size={17} /></span>
                                    </div>
                                    {data.orders.filter((order) => order.paymentStatus !== 'paid' && order.verificationStatus !== 'pending' && order.status !== 'cancelled').slice(0, 5).map((order) => (
                                        <div className="attention-row" key={order._id}>
                                            <span className="attention-marker"><Banknote size={14} /></span>
                                            <div><strong>{orderCustomer(order)}</strong><span>#{order._id.slice(-7).toUpperCase()} · {formatCurrency(order.total)} due</span></div>
                                            <button type="button" onClick={() => void collectPayment(order._id, 'cash')}>Collect</button>
                                        </div>
                                    ))}
                                    {!data.orders.some((order) => order.paymentStatus !== 'paid' && order.verificationStatus !== 'pending' && order.status !== 'cancelled') && <div className="attention-clear"><Check size={16} /> You’re all caught up on payments.</div>}
                                </div>
                            </section>
                        )}

                        {isAdmin && tab === 'overview' && (
                            <section className="ops-panel ops-panel-orders">
                                <div className="ops-panel-heading">
                                    <div><span className="section-kicker">The latest from the floor</span><h2>Recent orders</h2></div>
                                    <button type="button" className="ops-text-button" onClick={() => setTab('orders')}>Manage orders <ArrowUpRight size={14} /></button>
                                </div>
                                <OrderTable orders={data.orders.slice(0, 6)} onStatus={updateStatus} onPayment={collectPayment} onVerify={verifyOrder} catalog={catalog} isAdmin={isAdmin} />
                            </section>
                        )}

                        {isAdmin && tab === 'orders' && (
                            <section className="ops-panel ops-panel-orders">
                                <div className="ops-panel-heading">
                                    <div><span className="section-kicker">Customer pickups & counter work</span><h2>All recent orders <small>{data.orders.length}</small></h2></div>
                                </div>
                                <OrderTable orders={data.orders} onStatus={updateStatus} onPayment={collectPayment} onVerify={verifyOrder} catalog={catalog} isAdmin={isAdmin} />
                                <PaginationControls page={data.ordersPage} pageCount={data.ordersPageCount} onChange={setOrdersPage} />
                            </section>
                        )}
                        {isAdmin && tab === 'orders' && (
                            <>
                                <WalkInTracking jobs={data.walkInOrders} onStatus={updateWalkInStatus} />
                                <ItemTagLookup />
                            </>
                        )}

                        {isAdmin && tab === 'sales' && (
                            <section className="ops-panel ops-panel-sales-full">
                                <div className="ops-panel-heading">
                                    <div><span className="section-kicker">{periodLabels[period]}</span><h2>Sales ledger <small>{data.summary.salesCount} receipts</small></h2></div>
                                    <button type="button" className="ops-export-button" onClick={() => exportSales(data.sales)} disabled={!data.sales.length}><Download size={15} /> Export page</button>
                                </div>
                                <p className="ledger-note">Collected revenue includes settled online orders and recorded walk-in sales. Unpaid orders are excluded.</p>
                                <SalesTable sales={data.sales} />
                                <PaginationControls page={data.salesPage} pageCount={data.salesPageCount} onChange={setSalesPage} />
                            </section>
                        )}

                        {isAdmin && tab === 'staff' && <StaffPanel />}
                        {isAdmin && tab === 'pricing' && (
                            catalog
                                ? <PricingPanel catalog={catalog} />
                                : isCatalogLoading && <div className="ops-panel"><div className="inline-loading"><span className="spinner" /> Loading service prices…</div></div>
                        )}

                        {isCashier && catalog && (
                            <section className="cashier-workspace">
                                <WalkInSaleForm materials={catalog.materials} stainRemovalFee={catalog.stainRemovalFee} onReceipt={setReceipt} />
                                <div className="ops-panel cashier-orders">
                                    <div className="ops-panel-heading">
                                        <div><span className="section-kicker">Pickups & payments</span><h2>Order desk</h2></div>
                                        <span className="ops-heading-icon"><ClipboardList size={17} /></span>
                                    </div>
                                    <OrderTable orders={data.orders} onStatus={updateStatus} onPayment={collectPayment} onVerify={verifyOrder} catalog={catalog} isAdmin={false} />
                                    <PaginationControls page={data.ordersPage} pageCount={data.ordersPageCount} onChange={setOrdersPage} />
                                </div>
                                <WalkInTracking jobs={data.walkInOrders} onStatus={updateWalkInStatus} />
                                <ItemTagLookup />
                            </section>
                        )}
                        {isCashier && !catalog && isCatalogLoading && <div className="ops-panel"><div className="inline-loading"><span className="spinner" /> Loading service list…</div></div>}
                    </>
                )}
            </div>
            {receipt && <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />}
        </section>
    );
}
