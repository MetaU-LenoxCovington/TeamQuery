import { Router } from "express";
import { authController } from "../controllers/authController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const createAuthRoutes = (sessionService: any) => {
    const router = Router();

    router.post('/register', authController.register);
    router.post('/login', authController.login);
    router.post('/refresh', authController.refresh);
    router.post('/logout', authController.logout);

    router.post('/logout-all', authenticateToken(sessionService), requireAdmin, authController.logoutAll);
    router.get('/me', authenticateToken(sessionService), authController.getMe);

    return router;
};

export default createAuthRoutes;
