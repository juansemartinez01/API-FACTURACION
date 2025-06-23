// factura/dto/crear-factura.dto.ts
export class CrearFacturaDto {
  cuit_emisor: string;
  importe_total: number;
  test: boolean;
  punto_venta: number;
  factura_tipo: number;
  metodo_pago: number;
  empresaId: number; // hasta que tengamos auth con token
}
