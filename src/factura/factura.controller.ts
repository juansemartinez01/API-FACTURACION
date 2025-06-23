// factura.controller.ts
import { Controller, Get, Post, Param, Body, Query, NotFoundException, UseGuards } from '@nestjs/common';
import { FacturaService } from './factura.service';
import { Factura } from './factura.entity';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('facturas')
export class FacturaController {
  constructor(private readonly facturaService: FacturaService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
    async crearFactura(@Body() data: CrearFacturaDto): Promise<Factura> {
    return this.facturaService.crearFactura(data);
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
