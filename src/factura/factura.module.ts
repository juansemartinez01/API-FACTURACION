// factura.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Factura } from './factura.entity';
import { FacturaService } from './factura.service';
import { FacturaController } from './factura.controller';
import { EmpresaModule } from 'src/empresa/empresa.module';
import { AuthModule } from 'src/auth/auth.module';
import { FacturaLog } from './factura-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Factura,FacturaLog]),
  EmpresaModule,
  AuthModule],
  providers: [FacturaService],
  controllers: [FacturaController],
  exports: [FacturaService],
})
export class FacturaModule {}
