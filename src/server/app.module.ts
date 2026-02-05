import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module.js';
import { SkillsModule } from './skills/skills.module.js';
import { ConfigModule } from './config/config.module.js';

@Module({
    imports: [
        AgentsModule,
        SkillsModule,
        ConfigModule,
    ],
})
export class AppModule { }
