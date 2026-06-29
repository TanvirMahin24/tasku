import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';
  const port = parseInt(process.env.PORT || '4000', 10);

  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    }),
  );

  await app.listen(port);
  Logger.log(`Tasku API listening on http://localhost:${port}/api/v1`, 'Bootstrap');
}

void bootstrap();
