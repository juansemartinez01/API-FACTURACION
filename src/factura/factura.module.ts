// factura.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Factura } from './factura.entity';
import { FacturaService } from './factura.service';
import { FacturaController } from './factura.controller';
import { EmpresaModule } from 'src/empresa/empresa.module';

@Module({
  imports: [TypeOrmModule.forFeature([Factura]),
  EmpresaModule],
  providers: [FacturaService],
  controllers: [FacturaController],
  exports: [FacturaService],
})
export class FacturaModule {}
