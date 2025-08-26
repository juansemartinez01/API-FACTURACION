import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AlicuotaIvaDto {
  @IsNumber()
  id_iva: number;

  @IsNumber()
  base_imponible: number;

  @IsNumber()
  importe: number;
}

export class CrearFacturaConLoginDto {
  // 🔐 Login automático
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  // 🔑 Token/Sign opcionales
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  sign?: string;

  // 📌 Datos emisor y compra
  @IsString()
  cuit_emisor: string;

  @IsNumber()
  importe_total: number;

  @IsOptional()
  @IsBoolean()
  test?: boolean = true;

  @IsOptional()
  @IsNumber()
  punto_venta?: number = 1;

  // 📌 Datos del receptor
  @IsOptional()
  @IsNumber()
  doc_tipo?: number = 99;

  @IsOptional()
  @IsNumber()
  doc_nro?: number = 0;

  @IsOptional()
  @IsNumber()
  cond_iva_receptor?: number = 5;

  // 📌 Datos de la factura
  @IsOptional()
  @IsNumber()
  factura_tipo?: number = 11;

  @IsOptional()
  @IsNumber()
  metodo_pago?: number = 1;

  @IsOptional()
  @IsNumber()
  importe_neto?: number | null;

  @IsOptional()
  @IsNumber()
  importe_iva?: number = 0.0;

  @IsOptional()
  @IsNumber()
  importe_total_concepto?: number = 0.0;

  @IsOptional()
  @IsNumber()
  importe_exento?: number = 0.0;

  @IsOptional()
  @IsNumber()
  importe_tributos?: number = 0.0;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlicuotaIvaDto)
  alicuotas_iva?: AlicuotaIvaDto[] | null;

  @IsOptional()
  @IsString()
  moneda?: string = 'PES';

  @IsOptional()
  @IsString()
  moneda_pago?: string = 'N';

  @IsOptional()
  @IsString()
  cotizacion?: string = '1';

  @IsOptional()
  @IsNumber()
  concepto?: number = 1;

  // 📌 Nota de crédito / débito
  @IsOptional()
  @IsNumber()
  tipo_comprobante_original?: number | null;

  @IsOptional()
  @IsNumber()
  pto_venta_original?: number | null;

  @IsOptional()
  @IsNumber()
  nro_comprobante_original?: number | null;

  @IsOptional()
  @IsNumber()
  cuit_receptor_comprobante_original?: number | null;

  // 📌 Se setea en el controller
  @IsOptional()
  @IsNumber()
  empresaId?: number;
}
