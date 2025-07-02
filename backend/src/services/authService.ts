import { prisma } from '../lib/prisma';
import { PasswordUtils } from '../utils/password';
import { JWTUtils } from '../utils/jwt';
import { AuthError, ValidationError } from '../utils/errors';
import { SessionService } from './sessionService';
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

			let organization;
			if ( data.organizationName ) {
				organization = await tx.organization.create({
					data: {
						name: data.organizationName,
						adminUserId: user.id,
					}
				});

				await tx.organizationMembership.create({
					data: {
						userId: user.id,
						organizationId: organization.id,
						role: 'ADMIN',
						canUpload: true,
						canDelete: true,
						canManageUsers: true,
					}
				});

		return {user, organization};

	}});

		return {
			message: 'User registered successfully',
			userId: result.user.id,
		};
	}

	async login( data: LoginRequest ): Promise<LoginResponse> {
		if ( !data.email || !data.password || !data.organizationId) {
			throw ValidationError.missingField('email, password, or organizationId is missing');
		}

		const user = await prisma.user.findUnique({
			where: { email: data.email },
			include: {
				memberships: {
					where: { organizationId: data.organizationId },
					innclude: {
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

		const membership = user.memberships[0];
		if (!membership) {
			throw new AuthError('User is not a member of the organization');
		}

		const sessionId = await this.sessionService.createSession(user.id, data.organizationId);

		const refreshTokenRecord = await prisma.refreshToken.create({
			data: {
				token: crypto.randomUUID(),
				userId: user.id,
				organizationId: data.organizationId,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
			}
		})
	}
}
