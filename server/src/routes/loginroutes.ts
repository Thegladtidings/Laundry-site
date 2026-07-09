import {Router,type Request, type Response} from 'express';
import { loginUser, registerUser  } from '../controllers/authcontroller.js';
const router = Router();


router.post('/', loginUser);
router.post('/register', registerUser);

export default router;