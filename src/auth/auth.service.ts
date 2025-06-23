// auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EmpresaService } from '../empresa/empresa.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly empresaService: EmpresaService,
    private readonly jwtService: JwtService,
  ) {}

  async validarEmpresa(email: string, password: string) {
    const empresa = await this.empresaService.buscarPorEmail(email);
    if (!empresa) throw new UnauthorizedException('Email no registrado');

    const valid = await bcrypt.compare(password, empresa.passwordHash);
    if (!valid) throw new UnauthorizedException('Contraseña incorrecta');

    const payload = { sub: empresa.id, email: empresa.email };
    const token = this.jwtService.sign(payload);
    return { access_token: token };
  }
}
