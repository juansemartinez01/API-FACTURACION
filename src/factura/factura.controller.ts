// factura.controller.ts
import { Controller, Get, Post, Param, Body, Query, NotFoundException, UseGuards } from '@nestjs/common';
import { FacturaService } from './factura.service';
import { Factura } from './factura.entity';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CrearFacturaConLoginDto } from './dto/crear-factura-login.dto';
import { AuthService } from 'src/auth/auth.service';

@Controller('facturas')
export class FacturaController {
  constructor(private readonly facturaService: FacturaService,private readonly authService: AuthService,) {}

  @Post('login-facturar')
    async loginYFacturar(@Body() dto: CrearFacturaConLoginDto) {
    const { access_token } = await this.authService.validarEmpresa(dto.email, dto.password);
    const empresaId = this.authService.decodeToken(access_token).sub;

    const factura = await this.facturaService.crearFactura({
        ...dto,
        empresaId,
    });

    return {
        token: access_token,
        factura,
    };
    }

  @Get()
  async listarFacturas(@Query('empresaId') empresaId: number): Promise<Factura[]> {
    return this.facturaService.obtenerTodas(empresaId);
  }

  @Get(':id')
  async verFactura(@Param('id') id: number): Promise<Factura> {
    const factura = await this.facturaService.obtenerPorId(id);
    if (!factura) {
      throw new NotFoundException(`Factura with id ${id} not found`);
    }
    return factura;
  }
}
