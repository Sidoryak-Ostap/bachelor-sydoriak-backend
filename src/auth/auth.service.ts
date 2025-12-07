import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { GoogleAuthDto, LoginDto, SignUpDto } from './auth.dto';
import { User } from 'src/users/schemas/user.schema';
import axios from 'axios';

interface ILoginResponse {
  message?: string;
  access_token: string;
  refresh_token: string;
  user: User;
}

@Injectable()
export class AuthService {
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
        message: 'User registered with Google successfully',
        access_token,
        refresh_token,
        user,
      };
    } catch (err) {
      console.error(err);
      throw new BadRequestException(err.message || 'Something went wrong');
    }
  }

  // Refresh Access Token
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
