export interface LaundryService {
    id: string;
    name: string;
    description: string;
    price: number;
    unit: string;
    turnaround: string;
    featured?: boolean;
}

export const services: LaundryService[] = [
    {
        id: 'wash-fold',
        name: 'Wash & fold',
        description: 'Everyday essentials, washed with care and neatly folded.',
        price: 1800,
        unit: 'per kg',
        turnaround: '24–48 hours',
        featured: true,
    },
    {
        id: 'dry-cleaning',
        name: 'Dry cleaning',
        description: 'A considered clean for suits, dresses and delicate fabrics.',
        price: 4500,
        unit: 'per item',
        turnaround: '2–3 days',
        featured: true,
    },
    {
        id: 'steam-press',
        name: 'Steam & press',
        description: 'Crisp, beautifully finished garments ready to wear.',
        price: 2200,
        unit: 'per item',
        turnaround: '24 hours',
    },
    {
        id: 'bedding',
        name: 'Bedding & linens',
        description: 'Fresh sheets, duvet covers and towels, finished to perfection.',
        price: 6500,
        unit: 'per bundle',
        turnaround: '2–3 days',
        featured: true,
    },
    {
        id: 'shoe-care',
        name: 'Shoe care',
        description: 'A gentle clean and refresh for your favourite pairs.',
        price: 8500,
        unit: 'per pair',
        turnaround: '3–5 days',
    },
    {
        id: 'express',
        name: 'Express service',
        description: 'A little more urgent, without compromising on care.',
        price: 5000,
        unit: 'per kg',
        turnaround: 'Same day',
    },
];
