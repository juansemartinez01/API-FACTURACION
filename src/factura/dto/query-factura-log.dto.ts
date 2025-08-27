import { Type, Transform } from 'class-transformer';
import {
  IsInt, IsOptional, IsIn, IsBoolean, IsNumber, Min, Max, IsString, MaxLength
} from 'class-validator';

export class QueryFacturaLogDto {
  // Multi-tenant / filtro principal
  @Type(() => Number)
  @IsInt()
  @Min(1)
  empresaId!: number;

  // Filtros comunes
  @IsOptional()
  @IsIn(['pending', 'success', 'error'])
  status?: 'pending' | 'success' | 'error';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cuit?: string; // cuit_emisor

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  punto_venta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  factura_tipo?: number;

  @IsOptional()
  @Transform(({ value }) => String(value).toLowerCase() === 'true')
  @IsBoolean()
  has_factura?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Transform(({ value }) => String(value).toLowerCase() === 'true')
  @IsBoolean()
  used_password_login?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  attemptsMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  attemptsMax?: number;

  // Búsqueda en mensaje de error
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string; // buscar en error_message (ILIKE)

  // Rango por fecha de creación
  @IsOptional()
  @IsString()
  from?: string; // 'YYYY-MM-DD' o ISO

  @IsOptional()
  @IsString()
  to?: string; // 'YYYY-MM-DD' o ISO

  // Rango por importe_total
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minImporte?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxImporte?: number;

  // Orden
  @IsOptional()
  @IsIn(['created_at', 'importe_total', 'attempts', 'status'])
  sortBy?: 'created_at' | 'importe_total' | 'attempts' | 'status' = 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortDir?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'DESC';

  // Paginación
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 20;
}
