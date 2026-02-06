import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module.js';
import { SkillsModule } from './skills/skills.module.js';
import { ConfigModule } from './config/config.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';

@Module({
    imports: [
        AgentsModule,
        SkillsModule,
        ConfigModule,
        WorkspaceModule,
    ],
})
export class AppModule { }
