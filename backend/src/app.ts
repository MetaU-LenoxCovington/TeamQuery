import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { sessionService } from './services/sessionServiceSingleton';
import { SearchIndexManager } from './services/searchIndexManager';
import { AuthService } from './services/authService';
import { PermissionService } from './services/permissionService';
import { updateSessionActivity } from './middleware/sessionActivity';
import createAuthRoutes from './routes/auth';
import { logger } from './utils/logger';

const app = express();
const searchIndexManager = new SearchIndexManager();
const authService = new AuthService(sessionService);
const permissionService = new PermissionService();

// Connect session events to index management
sessionService.on('organizationFirstLogin', (organizationId: string) => {
  logger.info(`First login for organization ${organizationId} - building search index`);
  searchIndexManager.buildIndex(organizationId).catch(console.error);
});

sessionService.on('organizationLastLogout', (organizationId: string) => {
  logger.info(`Last logout for organization ${organizationId} - destroying search index`);
  searchIndexManager.destroyIndex(organizationId);
});

// Restore sessions on startup
sessionService.restoreSessionsFromDatabase().catch(console.error);

// Middleware
app.use(cors());
app.use(express.json());
app.use(updateSessionActivity);

// Make services available to routes
app.locals.sessionService = sessionService;
app.locals.searchIndexManager = searchIndexManager;
app.locals.authService = authService;
app.locals.permissionService = permissionService;

// Routes
app.use('/api/auth', createAuthRoutes());

// Health check
app.get('/health', (_req, res) => {
  const activeOrgs = sessionService.getActiveOrganizations();
  const activeIndexes = searchIndexManager.getActiveIndexes();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeOrganizations: activeOrgs.length,
    activeIndexes: activeIndexes.length,
  });
});

app.use(errorHandler);

export { app };
