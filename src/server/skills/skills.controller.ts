import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { SkillsService } from './skills.service.js';

@Controller('skills')
export class SkillsController {
    constructor(private readonly skillsService: SkillsService) { }

    @Get()
    async getSkills() {
        const skills = await this.skillsService.getSkills();
        return {
            success: true,
            data: skills,
        };
    }

    @Get(':name')
    async getSkill(@Param('name') name: string) {
        const skill = await this.skillsService.getSkill(name);
        if (!skill) {
            throw new HttpException('Skill not found', HttpStatus.NOT_FOUND);
        }
        return {
            success: true,
            data: skill,
        };
    }

    @Get(':name/content')
    async getSkillContent(@Param('name') name: string) {
        const content = await this.skillsService.getSkillContent(name);
        if (!content) {
            throw new HttpException('Skill not found', HttpStatus.NOT_FOUND);
        }
        return {
            success: true,
            data: { content },
        };
    }
}
