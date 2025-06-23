// factura.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Factura } from './factura.entity';
import { FacturaService } from './factura.service';
import { FacturaController } from './factura.controller';
import { EmpresaModule } from 'src/empresa/empresa.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Factura]),
  EmpresaModule,
  AuthModule],
  providers: [FacturaService],
  controllers: [FacturaController],
  exports: [FacturaService],
})
export class FacturaModule {}
