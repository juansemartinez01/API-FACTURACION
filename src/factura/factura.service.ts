// factura.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Factura } from './factura.entity';
import { DeepPartial, Repository } from 'typeorm';
import { Empresa } from 'src/empresa/empresa.entity';
import { EmpresaService } from 'src/empresa/empresa.service';
import axios from 'axios';
import { FacturaLog } from './factura-log.entity';
import { QueryFacturaLogDto } from './dto/query-factura-log.dto';

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
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function normalizeDateEnd(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

type AlicuotaIva = {
  id_iva: number;
  base_imponible: number;
  importe: number;
};

type CrearFacturaConLoginPayload = {
  // login (opcional, pueden o no enviarse)
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

  // 🔗 IDs de ventas asociadas (opcional)
  ventas_ids?: number[] | null;
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

  // Axios preconfigurado: más timeout y validateStatus para no perder body de error
  private axiosClient = axios.create({
    timeout: 15000, // 15s
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
    },
    validateStatus: () => true, // Nunca throw por status; decidimos nosotros
  });

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  private pruneUndefined<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
  }

  // Util para serializar sin referencias circulares
  private safeJson(data: any) {
    try {
      return typeof data === 'string' ? data : JSON.stringify(data);
    } catch {
      return '[unserializable]';
    }
  }

  // Logger conciso con request/response (todo en 'any' para evitar errores de tipos)
  private logAxiosError(ctx: string, errOrResponse: any, meta?: Record<string, any>) {
    const res: any = errOrResponse?.response ?? errOrResponse; // puede ser response directo por validateStatus
    const req: any = errOrResponse?.config ?? res?.config;

    const status = res?.status;
    const statusText = res?.statusText;
    const data = res?.data;
    const headers = res?.headers;

    const code = errOrResponse?.code;
    const message = errOrResponse?.message ?? `HTTP ${status} ${statusText ?? ''}`.trim();

    console.error(`[${ctx}]`, {
      code,
      message,
      method: req?.method?.toUpperCase?.(),
      url: req?.url,
      requestHeaders: req?.headers,
      requestData: this.safeJson(req?.data),
      status,
      statusText,
      responseHeaders: headers,
      responseData: this.safeJson(data),
      ...(meta ?? {}),
    });
  }

  private buildHeaders(dto: CrearFacturaConLoginPayload): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
    };

    // Si tu API usa token/sign por header propio:
    if (dto.token && dto.sign) {
      headers['X-AFIP-Token'] = String(dto.token);
      headers['X-AFIP-Sign'] = String(dto.sign);
    } else if (dto.token) {
      // Alternativa común: Authorization: Bearer
      headers['Authorization'] = `Bearer ${String(dto.token)}`;
    }

    return headers;
  }

  async crearFactura(dto: CrearFacturaConLoginPayload): Promise<Factura> {
    // === Empresa ===
    const empresaIdNum = Number(dto.empresaId);
    if (!Number.isFinite(empresaIdNum)) {
      throw new Error('empresaId inválido o ausente');
    }
    const empresa: Empresa | null = await this.empresaService.buscarPorId(empresaIdNum);
    if (!empresa) throw new Error('Empresa no encontrada');

    // === Normalización de defaults y coherencia de IVA ===
    const total = Number(dto.importe_total);
    const iva = dto.importe_iva ?? 0;
    const netoCalculado = iva > 0 ? (total - iva) : total;

    const alicuotas =
      iva > 0
        ? (dto.alicuotas_iva ?? [
            {
              id_iva: 5, // 21% típico
              base_imponible: Number(netoCalculado),
              importe: Number(iva),
            },
          ])
        : null;

    const payload = this.pruneUndefined({
      // enviar CUIT como número
      cuit_emisor: Number(dto.cuit_emisor),
      importe_total: total,

      test: dto.test ?? true,
      punto_venta: dto.punto_venta ?? 1,

      // Receptor
      doc_tipo: dto.doc_tipo ?? 99,
      doc_nro: dto.doc_nro ?? 0,
      cond_iva_receptor: dto.cond_iva_receptor ?? 5,

      // Factura
      factura_tipo: dto.factura_tipo ?? 11,
      metodo_pago: dto.metodo_pago ?? 1,

      // IVA coherente
      importe_neto: dto.importe_neto ?? Number(netoCalculado),
      importe_iva: Number(iva),
      importe_total_concepto: dto.importe_total_concepto ?? 0.0,
      importe_exento: dto.importe_exento ?? 0.0,
      importe_tributos: dto.importe_tributos ?? 0.0,

      alicuotas_iva: alicuotas,

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
      importe_total: String(
        (payload as any).importe_total?.toFixed?.(2) ??
          Number((payload as any).importe_total).toFixed(2),
      ),
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
    let response: any | undefined;
    let attempts = 0;

    try {
      const headers = this.buildHeaders(dto);

      while (attempts < 2) {
        attempts++;

        response = await this.axiosClient.post(url, payload, { headers });

        if (response?.status >= 200 && response?.status < 300) {
          // OK
          break;
        }

        // No-2xx: logueo y decido si reintento
        this.logAxiosError(`facturar:intento_${attempts}`, response);

        const isTransient =
          !response?.status ||
          (response.status >= 500 && response.status <= 599);

        if (attempts < 2 && isTransient) {
          await this.sleep(attempts * 500); // backoff 0.5s, 1s
          continue;
        }

        // Guardar log en error y lanzar
        const msg =
          (typeof response?.data === 'string'
            ? response.data
            : response?.data?.message) ||
          `HTTP ${response?.status}`;

        await this.facturaLogRepo.update(log.id, {
          status: 'error',
          attempts,
          duration_ms: Date.now() - started,
          error_message: String(msg),
          response_payload: {
            status: response?.status ?? null,
            headers: response?.headers ?? null,
            data:
              typeof response?.data === 'string'
                ? response.data
                : (response?.data ?? null),
          },
        });

        throw new Error(`Error al facturar: ${msg}`);
      }

      if (!response || !(response.status >= 200 && response.status < 300)) {
        await this.facturaLogRepo.update(log.id, {
          status: 'error',
          attempts,
          duration_ms: Date.now() - started,
          error_message: 'Sin respuesta válida de la API de facturación.',
        });
        throw new Error('Sin respuesta válida de la API de facturación.');
      }

      // === Persistir Factura “cruda” como antes
      const { cae, vencimiento, nro_comprobante, fecha, qr_url } = response.data as FacturaApiResponse;

      const factura = this.facturaRepo.create({
        cae,
        vencimiento,
        nro_comprobante: Number(nro_comprobante),
        fecha,
        qr_url,
        empresa,
        ventas_ids: dto.ventas_ids ?? null,
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
          factura_snapshot: {
            id: facturaSaved.id,
            cae: facturaSaved.cae,
            vencimiento: facturaSaved.vencimiento,
            nro_comprobante: facturaSaved.nro_comprobante,
            fecha: facturaSaved.fecha,
            qr_url: facturaSaved.qr_url,
          },
        },
        factura_id: facturaSaved.id, // setear FK
      };

      await this.facturaLogRepo.save(partial);

      return facturaSaved;
    } catch (e: any) {
      // Si el throw vino de Axios con response (network u otro), registramos acá también
      if (e?.response) {
        this.logAxiosError('facturar:catch', e);
        await this.facturaLogRepo.update(log.id, {
          status: 'error',
          attempts,
          duration_ms: Date.now() - started,
          error_message: String(
            e?.response?.data?.message ?? e.message ?? 'Error desconocido al facturar',
          ),
          response_payload: {
            status: e.response.status,
            headers: e.response.headers,
            data:
              typeof e.response.data === 'string'
                ? e.response.data
                : (e.response.data ?? null),
          },
        });
      }
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
