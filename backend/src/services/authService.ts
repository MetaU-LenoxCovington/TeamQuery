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

		const user = await prisma.user.create({
			data: { email: data.email, password: hashedPassword, name: data.name }
		});

		const organization = await prisma.organization.create({
			data: { name: data.organizationName, adminUserId: user.id }
		});

		const membership = await prisma.organizationMembership.create({
			data: { userId: user.id, organizationId: organization.id, role: 'ADMIN' }
		});

		return  user;
	}
}
