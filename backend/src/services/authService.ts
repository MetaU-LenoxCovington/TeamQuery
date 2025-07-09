import { prisma } from '../lib/prisma';
import { PasswordUtils } from '../utils/password';
import { JWTUtils } from '../utils/jwt';
import { AuthError, ValidationError } from '../utils/errors';
import { SessionService } from './sessionService';
import { logger }	from '../utils/logger';
import crypto from 'crypto';
import {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
} from '../types/auth';

export class AuthService {
	constructor( private sessionService: SessionService ){}

	async register( data: RegisterRequest ): Promise<RegisterResponse> {

		if ( !data.email || !data.password || !data.name ) {
			throw ValidationError.missingField('email, password, or name is missing');
		}

		if ( !this.isValidEmail(data.email) ) {
			throw ValidationError.invalidInputFormat('email', data.email);
		}

		const existingUser = await prisma.user.findUnique({
			where: { email: data.email }
		});

		if ( existingUser ) {
			throw new AuthError('User with this email already exists');
		}

		const hashedPassword = await PasswordUtils.hash(data.password);

		const result = await prisma.$transaction( async (tx: any) => {
			const user = await tx.user.create({
				data: {
					email: data.email,
					password: hashedPassword,
					name: data.name,
				}
			});

			let organization = null;
			let membership = null;

			if ( data.organizationName ) {
				organization = await tx.organization.create({
					data: {
						name: data.organizationName,
						adminUserId: user.id,
					}
				});

				membership = await tx.organizationMembership.create({
					data: {
						userId: user.id,
						organizationId: organization.id,
						role: 'ADMIN',
						canUpload: true,
						canDelete: true,
						canManageUsers: true,
					}
				});
			}

			return { user, organization, membership };
		});

		const { user, organization, membership } = result;

		// If no organization was created, throw an error
		if (!organization || !membership) {
			throw new AuthError('Organization creation failed');
		}

		// Create session for the organization
		const sessionId = await this.sessionService.createSession(user.id, organization.id);

		// Create refresh token
		const refreshTokenRecord = await prisma.refreshToken.create({
			data: {
				token: crypto.randomUUID(),
				userId: user.id,
				organizationId: organization.id,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
			}
		});

		// Generate tokens
		const accessToken = JWTUtils.generateAccessToken({
			userId: user.id,
			organizationId: organization.id,
			role: membership.role,
			isAdmin: membership.role === 'ADMIN',
			email: user.email,
			name: user.name,
			sessionId: sessionId
		});

		const refreshToken = JWTUtils.generateRefreshToken({
			userId: user.id,
			organizationId: organization.id,
			tokenId: refreshTokenRecord.id,
			sessionId: sessionId,
		});

		return {
			accessToken,
			refreshToken,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				organizations: [{
					id: organization.id,
					name: organization.name,
					role: membership.role,
					isAdmin: membership.role === 'ADMIN',
				}],
			},
			defaultOrganizationId: organization.id,
		};
	}

	async login( data: LoginRequest ): Promise<LoginResponse> {
		if ( !data.email || !data.password ) {
			throw ValidationError.missingField('email or password is missing');
		}

		const user = await prisma.user.findUnique({
			where: { email: data.email },
			include: {
				memberships: {
					include: {
						organization: true,
					}
				}
			}
		});

		if ( !user ) {
			throw AuthError.invalidCredentials();
		}

		const isValidPassword = await PasswordUtils.verify(user.password, data.password);
		if (!isValidPassword) {
			throw AuthError.invalidCredentials();
		}

		if (user.memberships.length === 0) {
			throw new AuthError('User is not a member of any organization');
		}

		// Create sessions for all organizations the user belongs to
		const sessionPromises = user.memberships.map(membership =>
			this.sessionService.createSession(user.id, membership.organizationId)
		);
		const sessionIds = await Promise.all(sessionPromises);

		// Use the first organization as default
		// TODO: Add logic to select default organization based on user preferences
		// TODO: Allow user to switch between organizations
		const defaultOrganization = user.memberships[0];
		const defaultSessionId = sessionIds[0];

		const refreshTokenRecord = await prisma.refreshToken.create({
			data: {
				token: crypto.randomUUID(),
				userId: user.id,
				organizationId: defaultOrganization.organizationId,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
			}
		});

		const accessToken = JWTUtils.generateAccessToken({
			userId: user.id,
			organizationId: defaultOrganization.organizationId,
			role: defaultOrganization.role,
			isAdmin: defaultOrganization.role === 'ADMIN',
			email: user.email,
			name: user.name,
			sessionId: defaultSessionId
		});

		const refreshToken = JWTUtils.generateRefreshToken({
			userId: user.id,
			organizationId: defaultOrganization.organizationId,
			tokenId: refreshTokenRecord.id,
			sessionId: defaultSessionId,
		});

		return {
			accessToken,
			refreshToken,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				organizations: user.memberships.map(membership => ({
					id: membership.organizationId,
					name: membership.organization.name,
					role: membership.role,
					isAdmin: membership.role === 'ADMIN',
				})),
			},
			defaultOrganizationId: defaultOrganization.organizationId,
		};
	}

	async refresh( data: RefreshRequest ): Promise<RefreshResponse> {
		try {
			const payload = JWTUtils.verifyRefreshToken(data.refreshToken);

			const refreshTokenRecord = await prisma.refreshToken.findUnique({
				where: { id: payload.tokenId },
				include: {
					user: {
						include: {
							memberships: {
								where: { organizationId: payload.organizationId },
							}
					}
			}
		}
	});

	if (!refreshTokenRecord || refreshTokenRecord.isRevoked) {
		throw AuthError.refreshTokenInvalid();
	}

	if (refreshTokenRecord.expiresAt < new Date()) {
		throw AuthError.refreshTokenExpired();
	}

	const user = refreshTokenRecord.user;
	const membership = user.memberships[0];

	if (!membership) {
		throw new AuthError('User membership not found');
	}

	const sessionInfo = this.sessionService.getSessionInfo(payload.sessionId);
	if (!sessionInfo) {
		throw new AuthError('Session expired');
	}

	const accessToken = JWTUtils.generateAccessToken({
		userId: user.id,
		organizationId: payload.organizationId,
		role: membership.role,
		isAdmin: membership.role === 'ADMIN',
		email: user.email,
		name: user.name,
		sessionId: payload.sessionId,
	});

	const newRefreshTokenRecord = await prisma.refreshToken.create({
		data: {
			token: crypto.randomUUID(),
			userId: user.id,
			organizationId: payload.organizationId,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
		}
	});

	await prisma.refreshToken.update({
		where: { id: payload.tokenId },
		data: { isRevoked: true }
	});

	const newRefreshToken = JWTUtils.generateRefreshToken({
		userId: user.id,
		organizationId: payload.organizationId,
		tokenId: newRefreshTokenRecord.id,
		sessionId: payload.sessionId,
	});

	return {
		accessToken,
		refreshToken: newRefreshToken,
	}

		} catch (error ) {
			if (error instanceof AuthError) {
				throw error;
			}
			throw AuthError.refreshTokenInvalid();
		}
	}

	async logout(refreshToken: string): Promise<void> {
		try {
			const payload = JWTUtils.verifyRefreshToken(refreshToken);

			if (payload.sessionId) {
				await this.sessionService.destroySession(payload.sessionId);
			}

			await prisma.refreshToken.update({
				where: { id: payload.tokenId },
				data: { isRevoked: true }
			});
		} catch (error) {
			logger.warn('Logout with invalid token', error);
		}
	}

	async logoutAll(userId: string, organizationId: string): Promise<void> {
		await prisma.refreshToken.updateMany({
			where: {
				userId,
				organizationId,
				isRevoked: false,
			},
			data: { isRevoked: true }
		});

		const sessions = await prisma.userSession.findMany({
			where: { userId, organizationId }
		});

		for (const session of sessions) {
			await this.sessionService.destroySession(session.id);
		}
	}

	async getUserOrganizations(email: string): Promise<Array<{id: string, name: string}>> {
		const user = await prisma.user.findUnique({
			where: { email },
			include: {
				memberships: {
					include: {
						organization: true,
					}
				}
			}
		});

		if (!user) {
			return [];
		}

		return user.memberships.map(membership => ({
			id: membership.organizationId,
			name: membership.organization.name,
		}));
	}

	private isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}


}
