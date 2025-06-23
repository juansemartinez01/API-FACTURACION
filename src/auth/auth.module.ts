// auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmpresaModule } from '../empresa/empresa.module';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    EmpresaModule,
    JwtModule.register({
      secret: 'jwt-secret-clave', // 🔐 cambiar en producción
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
