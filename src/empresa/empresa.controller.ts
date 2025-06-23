// empresa.controller.ts
import { Controller, Post, Body, Get, Param, NotFoundException } from '@nestjs/common';
import { EmpresaService } from './empresa.service';
import { Empresa } from './empresa.entity';

@Controller('empresas')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Post()
  async registrar(@Body() data: Partial<Empresa>): Promise<Empresa> {
    return this.empresaService.registrarEmpresa(data);
  }

  @Get(':id')
  async verEmpresa(@Param('id') id: number): Promise<Empresa> {
    const empresa = await this.empresaService.buscarPorId(id);
    if (!empresa) {
      throw new NotFoundException(`Empresa with id ${id} not found`);
    }
    return empresa;
  }
}
