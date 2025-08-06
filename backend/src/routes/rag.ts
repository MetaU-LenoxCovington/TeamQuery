
import { Router } from "express";
import { ragController } from "../controllers/ragController";
import { authenticateToken } from "../middleware/auth";

const createRagRoutes = () => {
  const router = Router();

  router.use(authenticateToken);

  router.post('/search', ragController.search);
  router.post('/query', ragController.ragQuery);

  router.post('/build-index', ragController.buildIndex);
  router.get('/index-status', ragController.getIndexStatus);
  router.delete('/index', ragController.destroyIndex);
  
  router.get('/users/:userId/group-recommendations', ragController.getUserGroupRecommendations);

  return router;
};

export default createRagRoutes;
