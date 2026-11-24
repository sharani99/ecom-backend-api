import { BadRequestException, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '1d',
        },
      }),
    }),
    MailModule,

    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/avatars',

        filename(req, file, cb) {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1000000)}`;

          const filename = `${uniqueName}-${file.originalname}`;

          cb(null, filename);
        },
      }),

      fileFilter(req, file, cb) {
        if (file.mimetype.startsWith('image')) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Bu tür dosyaları yükleyemezsiniz'),
            false,
          );
        }
      },

      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
