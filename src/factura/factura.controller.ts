import { Controller, Get, Post, Param, Body, Query, NotFoundException, UsePipes, ValidationPipe } from '@nestjs/common';
import { FacturaService } from './factura.service';
import { Factura } from './factura.entity';
import { CrearFacturaConLoginDto } from './dto/crear-factura-login.dto';
import { AuthService } from 'src/auth/auth.service';
import { QueryFacturaLogDto } from './dto/query-factura-log.dto';

@Controller('facturas')
export class FacturaController {
  constructor(
    private readonly facturaService: FacturaService,
    private readonly authService: AuthService,
  ) {}

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


  /**
   * GET /facturas/logs?empresaId=1&status=success&page=1&pageSize=20&from=2025-08-01&to=2025-08-31
   */
  @Get('logs')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async listLogs(@Query() query: QueryFacturaLogDto) {
    const res = await this.facturaService.listFacturaLogs(query);
    return res;
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
