import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isPrismaError, PRISMA_UNIQUE_VIOLATION } from '../common/prisma-errors';
import { EnvironmentVariables } from '../config/env.validation';
import { UsersService } from '../users/users.service';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { AuthPayload } from './models/auth-payload.model';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly saltRounds: number;
  private readonly expiresIn: number;
  /** Dipake kalo email gak ketemu, biar waktu responnya sama (anti user enumeration). */
  private readonly dummyHash: string;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.saltRounds = config.get('BCRYPT_SALT_ROUNDS', { infer: true });
    this.expiresIn = config.get('JWT_EXPIRES_IN', { infer: true });
    this.dummyHash = bcrypt.hashSync('timing-attack-dummy-password', this.saltRounds);
  }

  async register(input: RegisterInput): Promise<User> {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, this.saltRounds);
    try {
      return await this.users.create(input.email, passwordHash);
    } catch (error) {
      // kalo ada 2 register barengan pake email sama, unique index yang jadi penentu
      if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    const user = await this.users.findByEmail(input.email);
    const passwordMatches = await bcrypt.compare(input.password, user?.password ?? this.dummyHash);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      user,
    };
  }

  async validateToken(token: string): Promise<User> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // bisa aja user-nya udah dihapus setelah token dibuat
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
