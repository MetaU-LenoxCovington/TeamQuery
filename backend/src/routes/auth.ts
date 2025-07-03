import { Router } from "express";
import { authController } from "../controllers/authController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

router.post('/logout-all', authenticateToken, requireAdmin, authController.logoutAll);
router.get('/me', authenticateToken, authController.getMe);

export default router;
