import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Empresa } from '../empresa/empresa.entity';

@Entity()
export class Factura {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cae: string;

  @Column()
  vencimiento: string;

  @Column()
  nro_comprobante: number;

  @Column()
  fecha: string;

  @Column()
  qr_url: string;

  @ManyToOne(() => Empresa, (empresa) => empresa.facturas)
  empresa: Empresa;

  @Column('int', { array: true, nullable: true, default: null })
  ventas_ids?: number[] | null;
}
