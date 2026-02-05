import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentsGateway } from './agents.gateway';

@Module({
    controllers: [AgentsController],
    providers: [AgentsService, AgentsGateway],
    exports: [AgentsService],
})
export class AgentsModule { }
