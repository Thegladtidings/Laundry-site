import { Router } from 'express';
import {
    createOrder,
    getOrderPhoto,
    listOrders,
    recordOrderPayment,
    updateOrderStatus,
    verifyOrderItems,
} from '../controllers/ordercontroller.js';
import { authenticate, requireAdminOrCashier } from '../middleware/authenticate.js';
import uploadOrderPhotos from '../middleware/order-photos.js';

const router = Router();

router.use(authenticate);
router.get('/', listOrders);
router.post('/', uploadOrderPhotos, createOrder);
router.get('/:orderId/photos/:photoId', getOrderPhoto);
router.patch('/:orderId/status', requireAdminOrCashier, updateOrderStatus);
router.post('/:orderId/payment', requireAdminOrCashier, recordOrderPayment);
router.post('/:orderId/verify', requireAdminOrCashier, verifyOrderItems);

export default router;
