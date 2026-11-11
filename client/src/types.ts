export type UserRole = 'admin' | 'user' | 'cashier';

export interface User {
    id: string;
    firstname: string;
    lastname: string;
    username: string;
    email: string;
    phone: string;
    role: UserRole;
}

export interface GarmentMaterial {
    id: string;
    name: string;
    price: number;
}

export interface PricingCatalog {
    materials: GarmentMaterial[];
    stainRemovalFee: number;
    updatedAt?: string;
}

export interface OrderPhotoReference {
    _id: string;
    contentType: string;
    createdAt?: string;
}

export type OrderStatus =
    | 'pending'
    | 'picked_up'
    | 'processing'
    | 'ready'
    | 'delivered'
    | 'cancelled';

export type PaymentMethod = 'cash' | 'card' | 'transfer';
export type PaymentStatus = 'unpaid' | 'paid';

export interface CustomerSummary {
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
}

export interface Order {
    _id: string;
    tagCode?: string;
    userId: string | CustomerSummary;
    items: Array<{
        lineId?: string;
        tagCode?: string;
        materialId?: string;
        name: string;
        quantity: number;
        unitPrice: number;
        stainRemoval?: boolean;
        stainRemovalFee?: number;
        lineTotal?: number;
        photos?: Array<string | OrderPhotoReference>;
    }>;
    pickupAddress: string;
    pickupDate: string;
    notes: string;
    total: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    estimatedTotal?: number;
    verificationStatus?: 'pending' | 'verified';
    verifiedAt?: string;
    verifiedBy?: CustomerSummary;
    paymentMethod?: PaymentMethod;
    paidAt?: string;
    receiptNumber?: string;
    createdAt: string;
}

export interface SaleRecord {
    id: string;
    receiptNumber: string;
    tagCode?: string;
    customerName: string;
    items: Order['items'];
    total: number;
    paymentMethod: PaymentMethod;
    createdAt: string;
    cashier: CustomerSummary | null;
    customer?: CustomerSummary | null;
    source: 'order' | 'walk-in';
}

export interface WalkInOrder {
    _id: string;
    tagCode?: string;
    receiptNumber: string;
    customerId?: string | CustomerSummary | null;
    customerName: string;
    customerPhone: string;
    items: Order['items'];
    total: number;
    paymentMethod: PaymentMethod;
    status: OrderStatus;
    createdAt: string;
}

export interface TagSearchResult {
    code: string;
    recordType: 'order' | 'walk-in';
    recordId: string;
    createdAt: string;
    releasedAt?: string | null;
    status: OrderStatus;
    customerName: string;
    items: Array<{ name: string; quantity: number; tagCode?: string | null }>;
}

export interface OperationsSummary {
    period: 'today' | '7d' | '30d';
    ordersPage: number;
    ordersPageCount: number;
    salesPage: number;
    salesPageCount: number;
    summary: {
        revenue: number;
        salesCount: number;
        ordersCount: number;
        unpaidOrders: number;
        activeOrders: number;
    };
    orders: Order[];
    walkInOrders: WalkInOrder[];
    sales: SaleRecord[];
}

export interface StaffMember extends User {
    createdAt: string;
    active: boolean;
}
