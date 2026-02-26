import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import axios from 'axios';
import {
  ConsultarCondicionIvaDto,
  CondicionIvaOutDto,
} from './dto/consultar-condicion-iva.dto';

@Injectable()
export class CondicionIvaService {
  // Axios preconfigurado igual que FacturaService
  private axiosClient = axios.create({
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
    },
    validateStatus: () => true, // no throw por status
  });

  private safeJson(data: any) {
    try {
      return typeof data === 'string' ? data : JSON.stringify(data);
    } catch {
      return '[unserializable]';
    }
  }

  private logAxios(ctx: string, resOrErr: any) {
    const res: any = resOrErr?.response ?? resOrErr;
    const req: any = resOrErr?.config ?? res?.config;

    console.error(`[${ctx}]`, {
      method: req?.method?.toUpperCase?.(),
      url: req?.url,
      requestData: this.safeJson(req?.data),
      status: res?.status,
      statusText: res?.statusText,
      responseData: this.safeJson(res?.data),
    });
  }

  async consultarCondicionIva(
    dto: ConsultarCondicionIvaDto,
  ): Promise<CondicionIvaOutDto> {
    // Validación extra por seguridad (aunque DTO ya valida)
    const c1 = Number(dto.cuit_consulta);
    const c2 = Number(dto.cuit_computador);
    const c3 = Number(dto.cuit_representado);

    if (![c1, c2, c3].every((x) => Number.isInteger(x) && x > 0)) {
      throw new BadRequestException('Los CUIT deben ser enteros positivos');
    }

    // ✅ Igual que facturas: URL hardcodeada (podés pasarlo a env)
    const url =
      'https://facturador-production.up.railway.app/consultar-condicion-iva';

    const payload = {
      cuit_consulta: c1,
      cuit_computador: c2,
      cuit_representado: c3,
    };

    const res = await this.axiosClient.post(url, payload);

    // Si OK
    if (res.status >= 200 && res.status < 300) {
      // FastAPI responde { consulta: int, condicion_iva: str }
      return res.data as CondicionIvaOutDto;
    }

    // No OK: log + map a error útil
    this.logAxios('consultar-condicion-iva', res);

    // Si viene body con detalle, lo devolvemos
    const msg =
      (typeof res.data === 'string'
        ? res.data
        : (res.data as any)?.detail || (res.data as any)?.message) ?? `HTTP ${res.status}`;

    // 👇 Acá decidís: si querés devolver 502 como proxy o 400 si es validación remota
    // Yo recomiendo:
    // - si es 4xx -> BadRequest (porque el payload no es válido)
    // - si es 5xx o sin status -> BadGateway
    if (res.status >= 400 && res.status < 500) {
      throw new BadRequestException(`Facturador rechazó la solicitud: ${msg}`);
    }

    throw new BadGatewayException(`Error comunicando con facturador: ${msg}`);
  }
}
