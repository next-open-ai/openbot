import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { AgentConfigModule } from './agent-config/agent-config.module.js';
import { SkillsModule } from './skills/skills.module.js';
import { ConfigModule } from './config/config.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';

@Module({
    imports: [
        DatabaseModule,
        AgentsModule,
        AgentConfigModule,
        SkillsModule,
        ConfigModule,
        WorkspaceModule,
    ],
})
export class AppModule {}
