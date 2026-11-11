import type { OrderStatus } from '../types';

const statusLabels: Record<OrderStatus, string> = {
    pending: 'Awaiting pickup',
    picked_up: 'Picked up',
    processing: 'In care',
    ready: 'Ready to return',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
    return <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>;
}
