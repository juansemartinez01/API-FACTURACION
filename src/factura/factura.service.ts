// factura.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Factura } from './factura.entity';
import { Repository } from 'typeorm';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { Empresa } from 'src/empresa/empresa.entity';
import { EmpresaService } from 'src/empresa/empresa.service';
import axios from 'axios';


@Injectable()
export class FacturaService {
  constructor(
    @InjectRepository(Factura)
    private readonly facturaRepo: Repository<Factura>,
    private readonly empresaService: EmpresaService,
  ) {}

  async crearFactura(dto: CrearFacturaDto): Promise<Factura> {
    const empresa: Empresa | null = await this.empresaService.buscarPorId(dto.empresaId);
    if (!empresa) throw new Error('Empresa no encontrada');

    interface FacturaApiResponse {
      cae: string;
      vencimiento: string;
      nro_comprobante: string;
      fecha: string;
      qr_url: string;
    }

    // ----------------------------
    // Intentar 1 vez y reintentar si falla con error 500
    let response;
    try {
      response = await axios.post<FacturaApiResponse>(
        'https://facturador-production.up.railway.app/facturas',
        {
          cuit_emisor: dto.cuit_emisor,
          importe_total: dto.importe_total,
          test: dto.test,
          punto_venta: dto.punto_venta,
          factura_tipo: dto.factura_tipo,
          metodo_pago: dto.metodo_pago,
        }
      );
    } catch (error) {
  const status = error.response?.status;
  const mensaje = error.response?.data?.message || error.message;

  console.error('Error al facturar:', {
    status,
    mensaje,
    stack: error.stack?.split('\n')[0], // opcional
  });

  if (status === 500) {
    // Retry
    await new Promise((res) => setTimeout(res, 500));
    response = await axios.post<FacturaApiResponse>(
      'https://facturador-production.up.railway.app/facturas',
      {
        cuit_emisor: dto.cuit_emisor,
        importe_total: dto.importe_total,
        test: dto.test,
        punto_venta: dto.punto_venta,
        factura_tipo: dto.factura_tipo,
        metodo_pago: dto.metodo_pago,
      }
    );
  } else {
    throw new Error(`Error al facturar: ${mensaje}`);
  }
}

    // ----------------------------

    const { cae, vencimiento, nro_comprobante, fecha, qr_url } = response.data;

    const factura = this.facturaRepo.create({
      cae,
      vencimiento,
      nro_comprobante: Number(nro_comprobante),
      fecha,
      qr_url,
      empresa,
    });

    return this.facturaRepo.save(factura);
  }

  async obtenerTodas(empresaId: number): Promise<Factura[]> {
    return this.facturaRepo.find({
      where: { empresa: { id: empresaId } },
      order: { fecha: 'DESC' },
    });
  }

  async obtenerPorId(id: number): Promise<Factura | null> {
    return this.facturaRepo.findOne({
      where: { id },
      relations: ['empresa'],
    });
  }
}
