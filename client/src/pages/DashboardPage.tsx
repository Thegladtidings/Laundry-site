import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CalendarDays, PackageOpen, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatCurrency, formatDate, getErrorMessage } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import type { Order, OrderStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import siteConfig from '../config/site';

const statusOptions: OrderStatus[] = ['pending', 'picked_up', 'processing', 'ready', 'delivered', 'cancelled'];

export default function DashboardPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['orders'],
        queryFn: async () => (await api.get<{ orders: Order[] }>('/orders')).data.orders,
    });

    const updateStatus = async (orderId: string, status: OrderStatus) => {
        try {
            await api.patch(`/orders/${orderId}/status`, { status });
            await queryClient.invalidateQueries({ queryKey: ['orders'] });
            toast.success('Order status updated.');
        } catch (error) {
            toast.error(getErrorMessage(error, 'We could not update that order.'));
        }
    };

    return (
        <section className="page-shell dashboard-page">
            <div className="dashboard-welcome">
                <div>
                    <span className="section-kicker">{user?.role === 'admin' ? `${siteConfig.name} operations` : `Your ${siteConfig.name} account`}</span>
                    <h1>{user?.role === 'admin' ? 'Good to have you, ' : 'A fresh start, '}{user?.firstname}<em>.</em></h1>
                    <p>{user?.role === 'admin' ? 'Here’s what’s happening with pickups and orders.' : 'Your laundry orders, all in one place.'}</p>
                </div>
                {user?.role !== 'admin' && <Link to="/orders/new" className="button button-dark"><Plus size={16} /> Book a pickup</Link>}
            </div>
            <div className="dashboard-overview">
                <div className="overview-card"><span className="overview-icon"><PackageOpen size={18} /></span><div><strong>{data?.length ?? '—'}</strong><span>{user?.role === 'admin' ? 'Recent orders' : 'Your orders'}</span></div></div>
                <div className="overview-card"><span className="overview-icon"><CalendarDays size={18} /></span><div><strong>{data?.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length ?? '—'}</strong><span>In progress</span></div></div>
                <div className="overview-card overview-note"><span>YOUR ORDERS, RIGHT ON TIME.</span><p>{user?.role === 'admin' ? 'Orders are refreshed whenever you update their status.' : 'We’ll keep your orders up to date.'}</p></div>
            </div>
            <div className="orders-heading"><div><span className="section-kicker">{user?.role === 'admin' ? 'The work in motion' : 'Your laundry orders'}</span><h2>{user?.role === 'admin' ? 'Recent orders' : 'Your orders'}</h2></div><button type="button" className="icon-button" aria-label="Refresh orders" onClick={() => void queryClient.invalidateQueries({ queryKey: ['orders'] })}><RefreshCw size={17} /></button></div>
            {isLoading && <div className="inline-loading"><span className="spinner" /> Gathering your orders…</div>}
            {isError && <p className="notice notice-error">We couldn’t load your orders. Please refresh the page to try again.</p>}
            {data?.length === 0 && (
                <div className="empty-orders">
                    <span className="empty-icon"><PackageOpen size={24} /></span>
                    <span className="section-kicker">A clean slate</span>
                    <h3>Nothing in the wash yet.</h3>
                    <p>Your first pickup is just a few clicks away. Let’s make room for more of your day.</p>
                    {user?.role !== 'admin' && <Link to="/orders/new" className="button button-dark">Book your first pickup <ArrowUpRight size={16} /></Link>}
                </div>
            )}
            {!!data?.length && (
                <div className="orders-list">
                    {data.map((order) => {
                        const customer = typeof order.userId === 'string' ? null : order.userId;
                        return (
                            <article className="order-card" key={order._id}>
                                <div className="order-card-top">
                                    <div><span className="order-id">{order.tagCode || '—'}</span><StatusBadge status={order.status} /></div>
                                    <strong className="order-total">{formatCurrency(order.verificationStatus === 'pending' ? order.estimatedTotal ?? order.total : order.total)}</strong>
                                    {order.verificationStatus === 'pending' && <span className="table-sub">Estimated · awaiting cashier verification</span>}
                                </div>
                                <div className="order-card-details">
                                    <div><span>{user?.role === 'admin' && customer ? `${customer.firstname} ${customer.lastname} · ` : ''}Pickup</span><strong>{formatDate(order.pickupDate)}</strong></div>
                                    <div><span>At</span><strong>{order.pickupAddress}</strong></div>
                                    <div><span>Items & tags</span><strong className="dashboard-item-tags">{order.items.map((item, index) => (
                                        <span key={item.lineId || index}>{item.name} × {item.quantity}{item.stainRemoval ? ' · stain removal' : ''}<small>Tag · {item.tagCode || order.tagCode || '—'}</small></span>
                                    ))}</strong></div>
                                </div>
                                {user?.role === 'admin' && (
                                    <label className="status-control">Update status
                                        <select value={order.status} onChange={(event) => void updateStatus(order._id, event.target.value as OrderStatus)}>
                                            {statusOptions.map((status) => <option value={status} key={status}>{status.replace('_', ' ')}</option>)}
                                        </select>
                                    </label>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
