// factura.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Factura } from './factura.entity';
import { DeepPartial, Repository } from 'typeorm';
import { CrearFacturaDto } from './dto/crear-factura.dto'; // opcional
import { Empresa } from 'src/empresa/empresa.entity';
import { EmpresaService } from 'src/empresa/empresa.service';
import axios from 'axios';
import { FacturaLog } from './factura-log.entity';
import { QueryFacturaLogDto } from './dto/query-factura-log.dto';
import { SelectQueryBuilder } from 'typeorm';

export type FacturaLogListResult = {
  items: FacturaLog[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

function normalizeDateStart(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  // inicio del día
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function normalizeDateEnd(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  // fin del día
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}




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
    @InjectRepository(FacturaLog)
    private readonly facturaLogRepo: Repository<FacturaLog>,
    private readonly empresaService: EmpresaService,
  ) {}

  // Axios preconfigurado (solo timeout + headers para compat con tipos viejos)
  private axiosClient = axios.create({
    timeout: 10000, // 10s
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
    },
  });

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  private pruneUndefined<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
  }

  // Logger conciso (sin AxiosError para evitar issues de tipos)
  private logAxiosError(ctx: string, err: any, meta?: Record<string, any>) {
    const status = err?.response?.status;
    const dataMsg = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.response?.data;
    const code = err?.code;
    const method = err?.config?.method?.toUpperCase();
    const target = err?.config?.url;
    const msg = err?.message;

    console.error(`[${ctx}]`, {
      status,
      code,
      method,
      url: target,
      message: msg,
      dataMessage: typeof dataMsg === 'string' ? dataMsg : undefined,
      ...(meta ?? {}),
    });
  }

  async crearFactura(dto: CrearFacturaConLoginPayload): Promise<Factura> {
  // === Empresa ===
  const empresaIdNum = Number(dto.empresaId);
  if (!Number.isFinite(empresaIdNum)) {
    throw new Error('empresaId inválido o ausente');
  }
  const empresa: Empresa | null = await this.empresaService.buscarPorId(empresaIdNum);
  if (!empresa) throw new Error('Empresa no encontrada');

  // === Normalización de defaults ===
  const payload = this.pruneUndefined({
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

  // snapshot de request (sin password)
  const requestSnapshot = {
    email: dto.email ?? null,
    // password: NUNCA guardar - si querés, un flag:
    used_password_login: !!dto.password,
    ...payload,
  };

  interface FacturaApiResponse {
    cae: string;
    vencimiento: string;
    nro_comprobante: string;
    fecha: string;
    qr_url: string;
  }

  const url = 'https://facturador-production.up.railway.app/facturas';

  // === Auditoría: registro "pending"
  const started = Date.now();
  const logPending = this.facturaLogRepo.create({
    empresa,
    empresa_id: empresa.id,
    email: dto.email ?? null,
    used_password_login: !!dto.password,
    cuit_emisor: String(payload.cuit_emisor),
    punto_venta: Number(payload.punto_venta),
    factura_tipo: Number(payload.factura_tipo),
    importe_total: String(payload.importe_total?.toFixed?.(2) ?? Number(payload.importe_total).toFixed(2)),
    request_payload: requestSnapshot,
    response_payload: null,
    status: 'pending',
    attempts: 0,
    duration_ms: null,
    factura: null,
    factura_id: null,
  });
  const log = await this.facturaLogRepo.save(logPending);

  // === Llamada con retry (hasta 2)
  let response: { data: FacturaApiResponse } | undefined;
  let attempts = 0;

  try {
    while (attempts < 2) {
      attempts++;
      try {
        response = await this.axiosClient.post<FacturaApiResponse>(url, payload);
        break; // OK
      } catch (error) {
        const status = (error as any)?.response?.status;
        this.logAxiosError(`facturar:intento_${attempts}`, error);

        const isTransient =
          !status ||
          (status >= 500 && status <= 599) ||
          ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes((error as any)?.code);

        if (attempts < 2 && isTransient) {
          await this.sleep(attempts * 500); // backoff 0.5s, 1s
          continue;
        }

        const msg =
          (error as any)?.response?.data?.message ||
          (error as any)?.message ||
          'Error desconocido al facturar';

        // Guardar log en error y re-lanzar
        await this.facturaLogRepo.update(log.id, {
          status: 'error',
          attempts,
          duration_ms: Date.now() - started,
          error_message: String(msg),
          response_payload: (error as any)?.response?.data ?? null,
        });

        throw new Error(`Error al facturar: ${msg}`);
      }
    }

    if (!response) {
      await this.facturaLogRepo.update(log.id, {
        status: 'error',
        attempts,
        duration_ms: Date.now() - started,
        error_message: 'Sin respuesta de la API de facturación.',
      });
      throw new Error('Sin respuesta de la API de facturación.');
    }

    // === Persistir Factura “cruda” como antes
    const { cae, vencimiento, nro_comprobante, fecha, qr_url } = response.data;

    const factura = this.facturaRepo.create({
      cae,
      vencimiento,
      nro_comprobante: Number(nro_comprobante),
      fecha,
      qr_url,
      empresa,
    });
    const facturaSaved = await this.facturaRepo.save(factura);

    // === Actualizar log con SUCCESS + response
    const partial: DeepPartial<FacturaLog> = {
    id: log.id, // <- PK para actualizar
    status: 'success',
    attempts,
    duration_ms: Date.now() - started,
    response_payload: {
      ...response.data,
      // ⚠️ NO JSON.stringify: es JSONB, TypeORM serializa
      factura_snapshot: {
        id: facturaSaved.id,
        cae: facturaSaved.cae,
        vencimiento: facturaSaved.vencimiento,
        nro_comprobante: facturaSaved.nro_comprobante,
        fecha: facturaSaved.fecha,
        qr_url: facturaSaved.qr_url,
      },
    },
    factura_id: facturaSaved.id, // setear FK, no objeto relación aquí
  };

  await this.facturaLogRepo.save(partial);

    return facturaSaved;
  } catch (e) {
    // ya se actualizó el log a 'error' adentro del catch del bucle
    throw e;
  }
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








  async listFacturaLogs(query: QueryFacturaLogDto): Promise<FacturaLogListResult> {
    const {
      empresaId, status, cuit, punto_venta, factura_tipo,
      has_factura, email, used_password_login, attemptsMin, attemptsMax,
      search, from, to, minImporte, maxImporte, sortBy = 'created_at', sortDir = 'DESC',
      page = 1, pageSize = 20,
    } = query;

    const qb = this.facturaLogRepo.createQueryBuilder('l')
      .leftJoinAndSelect('l.factura', 'f')
      .where('l.empresa_id = :empresaId', { empresaId });

    // Filtros
    if (status) qb.andWhere('l.status = :status', { status });
    if (cuit) qb.andWhere('l.cuit_emisor = :cuit', { cuit });
    if (typeof punto_venta === 'number') qb.andWhere('l.punto_venta = :pto', { pto: punto_venta });
    if (typeof factura_tipo === 'number') qb.andWhere('l.factura_tipo = :ft', { ft: factura_tipo });
    if (typeof has_factura === 'boolean') {
      qb.andWhere(has_factura ? 'l.factura_id IS NOT NULL' : 'l.factura_id IS NULL');
    }
    if (email) qb.andWhere('l.email ILIKE :email', { email: `%${email}%` });
    if (typeof used_password_login === 'boolean') qb.andWhere('l.used_password_login = :upl', { upl: used_password_login });

    if (typeof attemptsMin === 'number') qb.andWhere('l.attempts >= :amin', { amin: attemptsMin });
    if (typeof attemptsMax === 'number') qb.andWhere('l.attempts <= :amax', { amax: attemptsMax });

    const fromISO = from ? normalizeDateStart(from) : undefined;
    const toISO = to ? normalizeDateEnd(to) : undefined;
    if (fromISO) qb.andWhere('l.created_at >= :from', { from: fromISO });
    if (toISO) qb.andWhere('l.created_at <= :to', { to: toISO });

    if (typeof minImporte === 'number') qb.andWhere('l.importe_total >= :imin', { imin: minImporte });
    if (typeof maxImporte === 'number') qb.andWhere('l.importe_total <= :imax', { imax: maxImporte });

    if (search) qb.andWhere('l.error_message ILIKE :s', { s: `%${search}%` });

    // Orden
    const dir = (String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';
    const sortColumn = ['created_at', 'importe_total', 'attempts', 'status'].includes(sortBy)
      ? sortBy
      : 'created_at';
    qb.orderBy(`l.${sortColumn}`, dir);

    // Paginación
    const take = pageSize;
    const skip = (page - 1) * pageSize;
    qb.take(take).skip(skip);

    const [items, total] = await qb.getManyAndCount();

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
