import { Router } from 'express';
import { listServices } from '../controllers/servicecontroller.js';

const router = Router();
router.get('/', listServices);

export default router;
