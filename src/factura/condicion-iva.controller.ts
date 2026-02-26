import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CondicionIvaService } from './condicion-iva.service';
import { ConsultarCondicionIvaDto } from './dto/consultar-condicion-iva.dto';

@Controller('facturacion/facturas')
export class CondicionIvaController {
  constructor(private readonly service: CondicionIvaService) {}

  @Post('consultar-condicion-iva')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  consultar(@Body() dto: ConsultarCondicionIvaDto) {
    return this.service.consultarCondicionIva(dto);
  }
}
