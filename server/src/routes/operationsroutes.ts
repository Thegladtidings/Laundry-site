import { Router } from 'express';
import { createCashier, listStaff, updateCashierStatus } from '../controllers/authcontroller.js';
import {
    getOperationsSummary,
    createWalkInSale,
    searchCustomers,
    searchItemTags,
    updateWalkInStatus,
} from '../controllers/salescontroller.js';
import { updatePricing } from '../controllers/materialcontroller.js';
import { authenticate, requireAdmin, requireAdminOrCashier } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate, requireAdminOrCashier);
router.get('/summary', getOperationsSummary);
router.get('/customers', searchCustomers);
router.get('/tags', searchItemTags);
router.patch('/walk-ins/:saleId/status', updateWalkInStatus);
router.put('/pricing', requireAdmin, updatePricing);
router.post('/sales', createWalkInSale);
router.get('/staff', requireAdmin, listStaff);
router.post('/staff/cashiers', requireAdmin, createCashier);
router.patch('/staff/:userId/status', requireAdmin, updateCashierStatus);

export default router;
