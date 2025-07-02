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
		if ( !data.email || !data.password || !organizationId) {
			throw ValidationError.missingField('email, password, or organizationId is missing');
		}
}
