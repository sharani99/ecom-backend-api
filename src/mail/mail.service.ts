import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('MAIL_HOST'),
      port: Number(this.config.getOrThrow('MAIL_PORT')),
      secure: false,
      auth: {
        user: this.config.getOrThrow<string>('MAIL_USER'),
        pass: this.config.getOrThrow<string>('MAIL_PASSWORD'),
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    return this.transporter.sendMail({
      from: this.config.getOrThrow<string>('MAIL_USER'),
      to,
      subject,
      html,
    });
  }

  async sendCreateProfile(email:string){
    return this.sendMail(
      email,
      'hesap oluşturma',
      `<h2>hesap oluşturma</h2>
      <p>Hesapınız başarıyla oluşturuldu</p>
     `
    )
  }

  async sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `http://localhost:3000/reset-password?token=${token}`;

  return this.sendMail(
    email,
    'Şifre Sıfırlama',
    `
      <h2>Şifre Sıfırlama</h2>
      <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın.</p>
      <a href="${resetLink}">Şifremi Sıfırla</a>
      <p>Bu bağlantı 15 dakika geçerlidir.</p>
    `,
  );
}
}