import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const port = app.get(ConfigService<EnvironmentVariables, true>).get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`Schedule service listening on http://localhost:${port}/graphql`, 'Bootstrap');
}

void bootstrap();
