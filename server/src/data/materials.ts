export interface GarmentMaterial {
    id: string;
    name: string;
    price: number;
}

export const defaultMaterials: GarmentMaterial[] = [
    { id: 'native', name: 'Native / traditional wear', price: 3500 },
    { id: 'shirt', name: 'Shirt', price: 1500 },
    { id: 't-shirt', name: 'T-shirt', price: 1200 },
    { id: 'polo', name: 'Polo shirt', price: 1800 },
    { id: 'suit', name: 'Suit', price: 8000 },
    { id: 'trousers', name: 'Trousers', price: 2000 },
    { id: 'uniform', name: 'Uniform', price: 2500 },
    { id: 'bedsheet', name: 'Bedsheet', price: 4500 },
    { id: 'duvet', name: 'Duvet', price: 9000 },
    { id: 'dress', name: 'Dress', price: 4000 },
    { id: 'skirt', name: 'Skirt', price: 1800 },
    { id: 'jacket', name: 'Jacket', price: 5000 },
    { id: 'towel', name: 'Towel', price: 1200 },
];

export const defaultStainRemovalFee = 1200;
