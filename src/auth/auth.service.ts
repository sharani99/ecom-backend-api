import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from 'src/types/types';
import { basename, join } from 'path';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { UpdateProfileDto } from './dto/UpdateProfileDto';
import { ChangePasswordDto } from './dto/ChangePasswordDto';
import { Role } from 'src/generated/prisma/enums';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/ForgotPasswordDto';
import { randomBytes, createHash } from 'node:crypto';
import { MailService } from 'src/mail/mail.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/RefreshTokenDto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const { username, email, password } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('E-posta kayıtlı ');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: passwordHash,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
    });

    await this.mailService.sendCreateProfile(email);

    return user;
  }

  async login(dto: LoginDto) {
    const { email, password } = dto;
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    const comparePassword = await bcrypt.compare(password, user.password);

    if (!comparePassword) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.role,
    );

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    return {
      safeUser,
      accessToken,
      refreshToken,
    };
  }

  async getMyProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('kullanıcı bulunmadı');
    }

    return user;
  }

  async uploadAvatar(userId: number, newAvatarUrl: string) {
    const user = await this.getMyProfile(userId);

    const oldAvatarUrl = user.avatarUrl;

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarUrl: newAvatarUrl,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    if (oldAvatarUrl && oldAvatarUrl !== newAvatarUrl) {
      const oldPath = join(
        process.cwd(),
        'uploads',
        'avatars',
        basename(oldAvatarUrl),
      );

      if (existsSync(oldPath)) {
        await unlink(oldPath);
      }
    }

    return updatedUser;
  }

  async removeAvatar(userId: number) {
    const user = await this.getMyProfile(userId);

    const oldAvatarUrl = user.avatarUrl;

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarUrl: null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    if (oldAvatarUrl) {
      const avatarPath = join(
        process.cwd(),
        'uploads',
        'avatars',
        basename(oldAvatarUrl),
      );

      if (existsSync(avatarPath)) {
        await unlink(avatarPath);
      }
    }

    return updatedUser;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const { username, email } = dto;

    const user = await this.getMyProfile(userId);

    if (email !== undefined && email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (existingUser) {
        throw new ConflictException('Bu e-posta başka birine ait');
      }
    }

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        ...(username !== undefined && { username }),
        ...(email !== undefined && { email }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    });
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const { currentPassword, newPassword } = dto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Mevcut şifre hatalı');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      throw new BadRequestException('Yeni şifre mevcut şifreyle aynı olamaz');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { password: passwordHash, refreshTokenHash: null },
    });

    return {
      message: 'Şifre başarıyla değiştirildi',
    };
  }

  async generateTokens(userId: number, role: Role) {
    const payload = { id: userId, role: role };
    const accessToken = await this.generateAccessToken(payload);

    const payloadRefresh = { id: userId, role: role, type: 'refresh' };

    const refreshToken = await this.jwtService.signAsync(payloadRefresh, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshTokenHash: refreshTokenHash,
      },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    const { refreshToken } = dto;
    let payload;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş refresh token',
      );
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Geçersiz token türü');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true, refreshTokenHash: true },
    });

    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Oturum geçersiz');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isValid) {
      throw new UnauthorizedException('Geçersiz refresh token');
    }
    return await this.generateTokens(user.id, user.role);
  }

  async logout(userId: number) {
    await this.getMyProfile(userId);
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshTokenHash: null,
      },
    });
    return {
      message: 'Başarıyla çıkış yapıldı',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const message = 'E-posta kayıtlıysa sıfırlama bağlantısı gönderilecektir.';

    if (!user) {
      return { message };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: expires,
      },
    });

    await this.mailService.sendPasswordResetEmail(email, token);

    return { message };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { token, newPassword } = dto;

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findUnique({
      where: {
        resetPasswordToken: tokenHash,
      },
    });

    if (
      !user ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires <= new Date()
    ) {
      throw new BadRequestException('Geçersiz veya süresi dolmuş token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const result = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        resetPasswordToken: tokenHash,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
      data: {
        password: passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshTokenHash: null,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('Geçersiz veya süresi dolmuş token');
    }

    return {
      message: 'Şifreniz başarıyla sıfırlandı.',
    };
  }

  private async generateAccessToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload);
  }
}
