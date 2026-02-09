/**
 * OpenBot Desktop 后端入口（NestJS HTTP API，前缀 server-api）。
 * 与 WebSocket Gateway（src/gateway/）是不同进程；Gateway 可拉本进程并代理 /server-api。
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        cors: true,
    });

    // Set global prefix
    app.setGlobalPrefix('server-api');

    // Enable CORS for frontend
    app.enableCors({
        origin: ['http://localhost:5173', 'http://localhost:38081'],
        credentials: true,
    });

    const port = process.env.PORT || 38081;
    await app.listen(port);

    console.log(`🚀 OpenBot Desktop Server running on http://localhost:${port}`);
}

bootstrap();
