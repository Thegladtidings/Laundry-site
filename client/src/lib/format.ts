export const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        maximumFractionDigits: 0,
    }).format(amount);

export const formatDate = (date: string): string =>
    new Intl.DateTimeFormat('en-NG', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(date));

export const getErrorMessage = (error: unknown, fallback: string): string => {
    if (
        typeof error === 'object'
        && error !== null
        && 'response' in error
        && typeof error.response === 'object'
        && error.response !== null
        && 'data' in error.response
        && typeof error.response.data === 'object'
        && error.response.data !== null
        && 'message' in error.response.data
        && typeof error.response.data.message === 'string'
    ) {
        return error.response.data.message;
    }
    return fallback;
};
