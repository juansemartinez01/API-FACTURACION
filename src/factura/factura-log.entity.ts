// src/factura/factura-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Empresa } from 'src/empresa/empresa.entity';
import { Factura } from './factura.entity';

export type FacturaLogStatus = 'success' | 'error' | 'pending';

@Entity('factura_log')
export class FacturaLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Empresa, { nullable: false })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @Column({ name: 'empresa_id' })
  empresa_id: number;

  // info de login/identificación (no guardes password en claro)
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'boolean', default: false })
  used_password_login: boolean; // true si vino password (pero NO la guardamos)

  // campos normalizados útiles para filtros
  @Column({ type: 'varchar', length: 20 })
  cuit_emisor: string;

  @Column({ type: 'int' })
  punto_venta: number;

  @Column({ type: 'int' })
  factura_tipo: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  importe_total: string; // numeric → string en TypeORM

  // snapshots
  @Column({ type: 'jsonb' })
  request_payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  response_payload: Record<string, any> | null;

  // resultado
  @Column({ type: 'varchar', length: 16 })
  status: FacturaLogStatus; // 'pending' | 'success' | 'error'

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int', nullable: true })
  duration_ms: number | null;

  // link a la factura creada (si salió bien)
  @ManyToOne(() => Factura, { nullable: true })
  @JoinColumn({ name: 'factura_id' })
  factura: Factura | null;

  @Column({ name: 'factura_id', type: 'int', nullable: true })
  factura_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
