// factura/dto/crear-factura-login.dto.ts
export class CrearFacturaConLoginDto {
  email: string;
  password: string;
  cuit_emisor: string;
  importe_total: number;
  test: boolean;
  punto_venta: number;
  factura_tipo: number;
  metodo_pago: number;
}
