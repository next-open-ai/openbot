import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module';
import { SkillsModule } from './skills/skills.module';
import { ConfigModule } from './config/config.module';

@Module({
    imports: [
        AgentsModule,
        SkillsModule,
        ConfigModule,
    ],
})
export class AppModule { }
