import { EventEmitter } from 'events';
import { prisma } from '../lib/prisma';

interface ActiveSession {
  sessionId: string;
  userId: string;
  organizationId: string;
  lastActivity: Date;
  expiresAt: Date;
}

export class SessionService extends EventEmitter {
	private activeSessions = new Map<string, ActiveSession>();
	private organizationSessions = new Map<string, Set<string>>();
	private sessionCleanupInterval: NodeJS.Timeout;

	constructor() {
		super();
		this.sessionCleanupInterval = setInterval(() => {
			this.cleanupExpiredSessions();
		}, 1000 * 60 * 5); // every 5 minutes
	}

	async createSession(userId: string, organizationId: string): Promise<string> {
		const sessionId = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

		const session: ActiveSession = {
			sessionId,
			userId,
			organizationId,
			lastActivity: new Date(),
			expiresAt,
		};

		this.activeSessions.set(sessionId, session);

		if (!this.organizationSessions.has(organizationId)) {
			this.organizationSessions.set(organizationId, new Set());
			// emit first active sesion from this org to start building search indices
			this.emit('organizationFirstLogin', organizationId);
		}

		const orgSessions  = this.organizationSessions.get(organizationId);
		if(orgSessions){
			orgSessions.add(sessionId);
		}

		await prisma.session.create({
			data: {
				id: sessionId,
				userId,
				organizationId,
				expiresAt,
			}
		});

		return sessionId;
	}

	async destroySession(sessionId: string): Promise<void> {
		const session = this.activeSessions.get(sessionId);
		if (!session){
			return;
		}

		const { organizationId } = session;

		this.activeSessions.delete(sessionId);

		const orgSessions = this.organizationSessions.get(organizationId);
		if (orgSessions) {
			orgSessions.delete(sessionId);

			if (orgSessions.size === 0) {
				this.organizationSessions.delete(organizationId);
				this.emit('organizationLastLogout', organizationId);
			}
		}

		await prisma.userSession.delete({
			where: { id: sessionId }
		})
	}

	private cleanupExpiredSessions(): void {
		const now = new Date();
		const expiredSessions: string[] = [];

		for (const [sessionId, session] of this.activeSessions) {
			if (session.expiresAt < now) {
				expiredSessions.push(sessionId);
			}
		}

		expiredSessions.forEach(sessionId => {
			this.destroySession(sessionId);
		})
	}

}
