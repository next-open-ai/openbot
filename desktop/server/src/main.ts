import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        cors: true,
    });

    // Enable CORS for frontend
    app.enableCors({
        origin: ['http://localhost:5173', 'http://localhost:3001'],
        credentials: true,
    });

    const port = process.env.PORT || 3001;
    await app.listen(port);

    console.log(`🚀 OpenBot Desktop Server running on http://localhost:${port}`);
}

bootstrap();
