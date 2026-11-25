import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const Authorization = req.headers.authorization;

    if (!Authorization) {
      throw new UnauthorizedException('Token bulunamadı');
    }

    const [type, token] = Authorization.split(' ');

    if (type?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Geçersiz token tipi');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      req.user = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş token');
    }
  }
}
