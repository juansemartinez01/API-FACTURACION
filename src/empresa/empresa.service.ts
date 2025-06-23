// empresa.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Empresa } from './empresa.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmpresaService {
  constructor(
    @InjectRepository(Empresa)
    private readonly empresaRepo: Repository<Empresa>,
  ) {}

  async registrarEmpresa(data: Partial<Empresa>): Promise<Empresa> {
    const empresa = new Empresa();
    if (!data.nombre) {
      throw new Error('El nombre de la empresa es requerido');
    }
    if (!data.cuit) {
      throw new Error('El CUIT de la empresa es requerido');
    }
    if (!data.email) {
      throw new Error('El email de la empresa es requerido');
    }
    if (!data.passwordHash) {
      throw new Error('La contraseña de la empresa es requerida');
    }
    empresa.nombre = data.nombre;
    empresa.cuit = data.cuit;
    empresa.email = data.email;
    empresa.passwordHash = await bcrypt.hash(data.passwordHash, 10);
    return this.empresaRepo.save(empresa);
  }

  async buscarPorCuit(cuit: string): Promise<Empresa | null> {
    return this.empresaRepo.findOne({ where: { cuit } });
  }

  async buscarPorId(id: number): Promise<Empresa | null> {
    return this.empresaRepo.findOne({ where: { id } });
  }

  async buscarPorEmail(email: string): Promise<Empresa | null> {
    return this.empresaRepo.findOne({ where: { email } });
  }

}
