import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // removes extra properties
      forbidNonWhitelisted: true, // throws error for unknown properties
      transform: true, // converts payload to DTO instance
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Agromap API')
    .setDescription('API documentation for my Agromap project')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Server running on http://localhost:3000`);
  console.log(`📘 Swagger docs available at http://localhost:3000/api`);
}
bootstrap();
