import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.use(cookieParser());

  // Trust proxy for Render deployment
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // CORS
  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:5173'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters
  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new ResponseTimeInterceptor());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Brightloop SubFlow API')
    .setDescription('Subscription Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('customers')
    .addTag('products')
    .addTag('plans')
    .addTag('taxes')
    .addTag('subscriptions')
    .addTag('invoices')
    .addTag('billing')
    .addTag('payments')
    .addTag('discounts')
    .addTag('reports')
    .addTag('audit')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`\n🚀 SubFlow API running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs\n`);
}
bootstrap();
