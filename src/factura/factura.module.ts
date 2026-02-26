// factura.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Factura } from './factura.entity';
import { FacturaLog } from './factura-log.entity';

import { FacturaService } from './factura.service';
import { FacturaController } from './factura.controller';

import { EmpresaModule } from 'src/empresa/empresa.module';
import { AuthModule } from 'src/auth/auth.module';

// ✅ NUEVO
import { CondicionIvaController } from './condicion-iva.controller';
import { CondicionIvaService } from './condicion-iva.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Factura, FacturaLog]),
    EmpresaModule,
    AuthModule,
  ],
  providers: [
    FacturaService,
    CondicionIvaService, // ✅ NUEVO
  ],
  controllers: [
    FacturaController,
    CondicionIvaController, // ✅ NUEVO
  ],
  exports: [
    FacturaService,
    CondicionIvaService, // ✅ opcional (solo si otro módulo lo usa)
  ],
})
export class FacturaModule {}
