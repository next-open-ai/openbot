import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) { }

    @Post('sessions')
    async createSession(
        @Body() body: { workspace?: string; provider?: string; model?: string; title?: string },
    ) {
        try {
            const session = await this.agentsService.createSession(body);
            return {
                success: true,
                data: session,
            };
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to create session',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('sessions')
    getSessions() {
        const sessions = this.agentsService.getSessions();
        return {
            success: true,
            data: sessions,
        };
    }

    @Get('sessions/:id')
    getSession(@Param('id') id: string) {
        const session = this.agentsService.getSession(id);
        if (!session) {
            throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
        }
        return {
            success: true,
            data: session,
        };
    }

    @Delete('sessions/:id')
    async deleteSession(@Param('id') id: string) {
        const deleted = await this.agentsService.deleteSession(id);
        if (!deleted) {
            throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
        }
        return {
            success: true,
            message: 'Session deleted',
        };
    }

    @Post('sessions/:id/message')
    async sendMessage(
        @Param('id') id: string,
        @Body() body: { message: string },
    ) {
        try {
            await this.agentsService.sendMessage(id, body.message);
            return {
                success: true,
                message: 'Message sent',
            };
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to send message',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('sessions/:id/history')
    getHistory(@Param('id') id: string) {
        const history = this.agentsService.getMessageHistory(id);
        return {
            success: true,
            data: history,
        };
    }
}
