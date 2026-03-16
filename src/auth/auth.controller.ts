import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UnauthorizedException,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthDto, LoginDto, SignUpDto, VerifyCodeDto } from './auth.dto';
import type { Response, Request } from 'express';
import { GetUser } from './decorators/get-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { type UserDocument } from 'src/users/schemas/user.schema';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Post('signup')
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...rest } = await this.authService.signUp(dto);

    this.setRefreshTokenCookie(res, refreshToken);

    return rest;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...rest } = await this.authService.login(dto);

    this.setRefreshTokenCookie(res, refreshToken);

    return rest;
  }

  @Post('google-login')
  async googleLogin(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...rest } = await this.authService.googleLogin(dto);

    this.setRefreshTokenCookie(res, refreshToken);

    return rest;
  }

  @Post('google-signup')
  async googleSignUp(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...rest } = await this.authService.googleSignUp(dto);

    this.setRefreshTokenCookie(res, refreshToken);

    return rest;
  }

  @Post('refresh')
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refreshToken'];

    if (!refreshToken)
      throw new UnauthorizedException('No refresh token found');

    const { refreshToken: newRefreshToken, ...rest } =
      await this.authService.refreshTokens(refreshToken);

    this.setRefreshTokenCookie(res, newRefreshToken);

    return {
      ...rest,
    };
  }

  @Post('send-code')
  async sendCode(@Body('email') email: string) {
    return this.authService.sendCode(email);
  }

  @Post('verify-code')
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: { email: string; newPassword: string }) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.cookie('refreshToken', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/',
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    return { message: 'Successfully logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@GetUser() user: UserDocument) {
    return user;
  }
}
