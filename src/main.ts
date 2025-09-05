import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as crypto from 'crypto';

// @ts-ignore
if (!global.crypto) {
  // @ts-ignore
  global.crypto = crypto;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3001','http://localhost:3000','https://jagger.up.railway.app','https://intelligent-bravery-pruebas-desarrollo.up.railway.app'], // o true para permitir todos los orígenes (no recomendado en producción)
    credentials: true, // si usas cookies o autenticación con tokens en headers
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
