import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Factura } from '../factura/factura.entity';

@Entity()
export class Empresa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ unique: true })
  cuit: string;

  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @OneToMany(() => Factura, factura => factura.empresa)
  facturas: Factura[];
}
