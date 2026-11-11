import { Router } from 'express';
import { getCurrentUser, loginUser, registerUser } from '../controllers/authcontroller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', authenticate, getCurrentUser);

export default router;
