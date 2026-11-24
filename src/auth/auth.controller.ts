import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Delete,
  Param,
  Res,
  Put,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from 'src/types/types';
import { AuthGuard } from './guard/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { basename } from 'node:path';
import type { Response } from 'express';
import { UpdateProfileDto } from './dto/UpdateProfileDto';
import { ChangePasswordDto } from './dto/ChangePasswordDto';
import { ForgotPasswordDto } from './dto/ForgotPasswordDto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/RefreshTokenDto';
import { RolesGuard } from './guard/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from 'src/generated/prisma/enums';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.authService.getMyProfile(user.id);
  }

  @Put('me')
  @UseGuards(AuthGuard)
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Put('change-password')
  @UseGuards(AuthGuard)
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya bulunamadı');
    }
    return this.authService.uploadAvatar(user.id, file.filename);
  }

  @Post('refresh')
  refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user.id);
  }

  @Post("forgot-password")
  forgotPassword(@Body() dto:ForgotPasswordDto){
    return this.authService.forgotPassword(dto)
  }

  @Post("reset-password")
  resetPassword(@Body() dto:ResetPasswordDto){
    return this.authService.resetPassword(dto)
  }

  @Delete('avatar')
  @UseGuards(AuthGuard)
  removeAvatar(@CurrentUser() user: JwtPayload) {
    return this.authService.removeAvatar(user.id);
  }



  @Get('avatar/:avatarId')
  showAvatar(@Param('avatarId') avatarId: string, @Res() res: Response) {
    return res.sendFile(basename(avatarId), { root: 'uploads/avatars' });
  }
}
