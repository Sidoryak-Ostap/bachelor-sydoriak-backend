import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { GoogleAuthDto, LoginDto, SignUpDto, VerifyCodeDto } from './auth.dto';
import { User, type UserDocument } from '../users/schemas/user.schema';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

interface ILoginResponse {
  message?: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

@Injectable()
export class AuthService {
  private transporter;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.transporter
      .verify()
      .then(() => {
        console.log('📨 SMTP server is ready to send emails');
      })
      .catch((err) => {
        console.error('❌ SMTP connection error:', err);
      });
  }

  // Sign-up
  async signUp(dto: SignUpDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new BadRequestException('User already exists');

    const user: UserDocument = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      provider: 'local',
      role: 'user',
      isActive: true,
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      message: 'User registered successfully',
      ...tokens,
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

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      user,
    };
  }

  // Google Login
  async googleLogin(dto: GoogleAuthDto) {
    try {
      const googleRes = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${dto.access_token}` },
        },
      );

      const profile = googleRes.data;

      let user = await this.usersService.findByEmail(profile.email);

      if (!user) {
        throw new BadRequestException('User not found. Please sign up first');
      }

      if (user.provider !== 'google') {
        throw new BadRequestException(
          'Please log in using your email/password',
        );
      }

      const tokens = await this.generateTokens(user.id, user.email, user.role);

      return {
        message: 'Logged in with Google successfully',
        ...tokens,
        user,
      };
    } catch (err) {
      console.error(err);
      throw new BadRequestException('Something went wrong');
    }
  }

  // Google Sign-up
  async googleSignUp(dto: GoogleAuthDto) {
    try {
      const googleRes = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${dto.access_token}` },
        },
      );
      const profile = googleRes.data;
      let user = await this.usersService.findByEmail(profile.email);

      if (user) {
        throw new BadRequestException('User already exists. Please log in');
      }
      user = await this.usersService.create({
        email: profile.email,
        provider: 'google',
        role: 'user',
        isActive: true,
      });

      const tokens = await this.generateTokens(user.id, user.email, user.role);

      return {
        message: 'User registered with Google successfully',
        ...tokens,
        user,
      };
    } catch (err: any) {
      console.error(err);
      throw new BadRequestException(err.message || 'Something went wrong');
    }
  }

  // Reset Password - Send Code

  async sendCode(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User with this email does not exist');
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await this.usersService.update(user.id, {
      resetCode: code,
      resetCodeExpires: expires,
    });

    await this.transporter.sendMail({
      from: `"No Reply" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Password Reset Code',
      text: `Your password reset code is ${code}`,
      html: `<h2>Your password reset code is <strong>${code}</strong></h2>`,
    });

    return { message: 'Reset code sent successfully' };
  }

  async verifyCode({ email, code }: { email: string; code: string }) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User with this email does not exist');
    }

    if (user.resetCode !== code) {
      throw new BadRequestException('Invalid reset code');
    }

    if (user.resetCodeExpires! < new Date()) {
      throw new BadRequestException('Reset code has expired');
    }

    await this.usersService.update(user.id, {
      isResetCodeVerified: true,
    });

    return { message: 'Reset code verified successfully' };
  }

  async resetPassword({
    email,
    newPassword,
  }: {
    email: string;
    newPassword: string;
  }) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User with this email does not exist');
    }

    if (user.resetCodeExpires! < new Date()) {
      await this.usersService.update(user.id, {
        resetCode: '',
        resetCodeExpires: null,
        isResetCodeVerified: false,
      });

      throw new BadRequestException('Reset code has expired');
    }

    const hashed = await bcrypt.hash(
      newPassword,
      parseInt(process.env.SALT_ROUNDS || '10'),
    );

    await this.usersService.update(user.id, {
      password: hashed,
      resetCode: '',
      resetCodeExpires: null,
      isResetCodeVerified: false,
    });

    return { message: 'Password reset successfully' };
  }

  async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '3d',
      }),
    ]);

    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(userId, hashedToken);

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('Access denied');

      const tokenMatches = await bcrypt.compare(
        refreshToken,
        user?.refreshToken || '',
      );

      if (!tokenMatches)
        throw new UnauthorizedException('Invalid refresh token');

      const tokens = await this.generateTokens(user.id, user.email, user.role);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user,
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
  }
}
