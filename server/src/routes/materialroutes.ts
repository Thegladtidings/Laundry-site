import { Router } from 'express';
import { getPricing } from '../controllers/materialcontroller.js';

const router = Router();
router.get('/', getPricing);

export default router;
