import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { SessionService } from './services/sessionService';
import { SearchIndexManager } from './services/searchIndexManager';
import { AuthService } from './services/authService';
import { PermissionService } from './services/permissionService';
import { updateSessionActivity } from './middleware/sessionActivity';
import createAuthRoutes from './routes/auth';

const app = express();

const sessionService = new SessionService();
const searchIndexManager = new SearchIndexManager();
const authService = new AuthService(sessionService);
const permissionService = new PermissionService();

// Connect session events to index management
sessionService.on('organizationFirstLogin', (organizationId: string) => {
  console.log(`First login for organization ${organizationId} - building search index`);
  searchIndexManager.buildIndex(organizationId).catch(console.error);
});

sessionService.on('organizationLastLogout', (organizationId: string) => {
  console.log(`Last logout for organization ${organizationId} - destroying search index`);
  searchIndexManager.destroyIndex(organizationId);
});

// Restore sessions on startup
sessionService.restoreSessionsFromDatabase().catch(console.error);

// Middleware
app.use(cors());
app.use(express.json());
app.use(updateSessionActivity(sessionService));

// Make services available to routes
app.locals.sessionService = sessionService;
app.locals.searchIndexManager = searchIndexManager;
app.locals.authService = authService;
app.locals.permissionService = permissionService;

// Routes
app.use('/api/auth', createAuthRoutes(sessionService));

// Health check
app.get('/health', (req, res) => {
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
