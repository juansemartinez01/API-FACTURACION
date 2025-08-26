// factura.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Factura } from './factura.entity';
import { Repository } from 'typeorm';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { Empresa } from 'src/empresa/empresa.entity';
import { EmpresaService } from 'src/empresa/empresa.service';
import axios from 'axios';

type AlicuotaIva = {
  id_iva: number;
  base_imponible: number;
  importe: number;
};

type CrearFacturaConLoginPayload = {
  // login (no se envían a la API externa)
  email?: string;
  password?: string;
  token?: string;
  sign?: string;

  // datos factura (los que espera la API externa)
  cuit_emisor: string;
  importe_total: number;

  test?: boolean;
  punto_venta?: number;

  doc_tipo?: number;
  doc_nro?: number;
  cond_iva_receptor?: number;

  factura_tipo?: number;
  metodo_pago?: number;

  importe_neto?: number | null;
  importe_iva?: number;
  importe_total_concepto?: number;
  importe_exento?: number;
  importe_tributos?: number;

  alicuotas_iva?: AlicuotaIva[] | null;

  moneda?: string;
  moneda_pago?: string;
  cotizacion?: string;
  concepto?: number;

  // NC/ND opcionales
  tipo_comprobante_original?: number | null;
  pto_venta_original?: number | null;
  nro_comprobante_original?: number | null;
  cuit_receptor_comprobante_original?: number | null;

  // seteado por el controller
  empresaId?: number;
};

@Injectable()
export class FacturaService {
  constructor(
    @InjectRepository(Factura)
    private readonly facturaRepo: Repository<Factura>,
    private readonly empresaService: EmpresaService,
  ) {}

  



async crearFactura(dto: CrearFacturaConLoginPayload): Promise<Factura> {
  // === Empresa ===
  const empresaIdNum = Number(dto.empresaId);
  if (!Number.isFinite(empresaIdNum)) {
    throw new Error('empresaId inválido o ausente');
  }
  const empresa: Empresa | null = await this.empresaService.buscarPorId(empresaIdNum);
  if (!empresa) throw new Error('Empresa no encontrada');

  // === Helper para remover undefined (dejamos null si corresponde) ===
  const pruneUndefined = <T extends Record<string, any>>(obj: T): T =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

  // === Normalización de defaults (evita undefined que rompa tipos en server externo) ===
  const payload = pruneUndefined({
    // Emisor / compra
    cuit_emisor: String(dto.cuit_emisor),
    importe_total: Number(dto.importe_total),

    test: dto.test ?? true,
    punto_venta: dto.punto_venta ?? 1,

    // Receptor
    doc_tipo: dto.doc_tipo ?? 99,
    doc_nro: dto.doc_nro ?? 0,
    cond_iva_receptor: dto.cond_iva_receptor ?? 5,

    // Factura
    factura_tipo: dto.factura_tipo ?? 11,
    metodo_pago: dto.metodo_pago ?? 1,

    importe_neto: dto.importe_neto ?? null,
    importe_iva: dto.importe_iva ?? 0.0,
    importe_total_concepto: dto.importe_total_concepto ?? 0.0,
    importe_exento: dto.importe_exento ?? 0.0,
    importe_tributos: dto.importe_tributos ?? 0.0,

    alicuotas_iva: dto.alicuotas_iva ?? null,

    // Moneda / concepto
    moneda: dto.moneda ?? 'PES',
    moneda_pago: dto.moneda_pago ?? 'N',
    cotizacion: dto.cotizacion ?? '1',
    concepto: dto.concepto ?? 1,

    // NC/ND
    tipo_comprobante_original: dto.tipo_comprobante_original ?? null,
    pto_venta_original: dto.pto_venta_original ?? null,
    nro_comprobante_original: dto.nro_comprobante_original ?? null,
    cuit_receptor_comprobante_original: dto.cuit_receptor_comprobante_original ?? null,
  });

  interface FacturaApiResponse {
    cae: string;
    vencimiento: string;
    nro_comprobante: string;
    fecha: string;
    qr_url: string;
  }

  const url = 'https://facturador-production.up.railway.app/facturas';

  // === Llamada + retry 1 vez si 500 ===
  let response;
  try {
    response = await axios.post<FacturaApiResponse>(url, payload);
  } catch (error: any) {
    const status = error?.response?.status;
    const mensaje = error?.response?.data?.message || error?.message;

    console.error('Error al facturar (intento 1):', {
      status,
      mensaje,
      stack: error?.stack?.split('\n')[0],
    });

    if (status === 500) {
      await new Promise((res) => setTimeout(res, 500));
      response = await axios.post<FacturaApiResponse>(url, payload);
    } else {
      throw new Error(`Error al facturar: ${mensaje}`);
    }
  }

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
