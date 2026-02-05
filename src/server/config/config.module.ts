import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller.js';
import { ConfigService } from './config.service.js';

@Module({
    controllers: [ConfigController],
    providers: [ConfigService],
    exports: [ConfigService],
})
export class ConfigModule { }
