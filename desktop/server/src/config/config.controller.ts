import { Controller, Get, Put, Body } from '@nestjs/common';
import { ConfigService, AppConfig } from './config.service';

@Controller('config')
export class ConfigController {
    constructor(private readonly configService: ConfigService) { }

    @Get()
    async getConfig() {
        const config = await this.configService.getConfig();
        return {
            success: true,
            data: config,
        };
    }

    @Put()
    async updateConfig(@Body() updates: Partial<AppConfig>) {
        const config = await this.configService.updateConfig(updates);
        return {
            success: true,
            data: config,
        };
    }

    @Get('providers')
    async getProviders() {
        const providers = await this.configService.getProviders();
        return {
            success: true,
            data: providers,
        };
    }

    @Get('providers/:provider/models')
    async getModels(@Body('provider') provider: string) {
        const models = await this.configService.getModels(provider);
        return {
            success: true,
            data: models,
        };
    }
}
