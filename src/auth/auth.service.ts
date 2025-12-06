import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { LoginDto, SignUpDto } from './auth.dto';
import { User } from 'src/users/schemas/user.schema';

interface ILoginResponse {
  message?: string;
  access_token: string;
  refresh_token: string;
  user: User;
}

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // Sign-up
  async signUp(dto: SignUpDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new BadRequestException('User already exists');

    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      provider: 'local',
      role: 'user',
      isActive: true,
    });

    const payload = { sub: user._id, email: user.email, role: user.role };
    const access_token = await this.jwtService.signAsync(payload);

    const refresh_token = await this.jwtService.signAsync(
      { sub: user._id },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    return {
      message: 'User registered successfully',
      access_token,
      refresh_token,
      user,
    };
  }

  // Login
  async login(dto: LoginDto): Promise<ILoginResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Incorrect email or password');

    if (user.provider !== 'local') {
      throw new BadRequestException('Please log in using Google');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);

    if (!isMatch) throw new BadRequestException('Incorrect email or password');

    const payload = { sub: user._id, email: user.email, role: user.role };
    const access_token = await this.jwtService.signAsync(payload);
    const refresh_token = await this.jwtService.signAsync(
      { sub: user._id },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    return {
      access_token,
      user,
      refresh_token,
    };
  }

  async loginWithGoogleToken(idToken: string) {
    try {
      // 1️⃣ Verify token with Google
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        throw new BadRequestException('Invalid Google token payload');
      }

      const { email, name } = payload;

      // 2️⃣ Find or create user
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        user = await this.usersService.create({
          name,
          email,
          provider: 'google',
          role: 'user',
          isActive: true,
        });
      }

      // 3️⃣ Generate JWT
      const tokenPayload = {
        sub: user._id,
        email: user.email,
        role: user.role,
      };
      const access_token = await this.jwtService.signAsync(tokenPayload);
      const refresh_token = await this.jwtService.signAsync(
        { sub: user._id },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '7d',
        },
      );

      return {
        message: 'Logged in with Google successfully',
        access_token,
        refresh_token,
        user,
      };
    } catch (err) {
      console.error(err);
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ access_token: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token payload');
      }

      const newAccessToken = await this.jwtService.signAsync({
        sub: user._id,
        email: user.email,
        role: user.role,
      });
      return { access_token: newAccessToken };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
