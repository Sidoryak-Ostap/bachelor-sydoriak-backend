import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>/?]).+$/, {
    message:
      'Password must contain at least one uppercase letter and one symbol',
  })
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class GoogleLoginDto {
  @IsString()
  id_token: string;
}
