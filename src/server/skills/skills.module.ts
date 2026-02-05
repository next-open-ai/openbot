import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller.js';
import { SkillsService } from './skills.service.js';

@Module({
    controllers: [SkillsController],
    providers: [SkillsService],
    exports: [SkillsService],
})
export class SkillsModule { }
