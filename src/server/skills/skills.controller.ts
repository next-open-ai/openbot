import { Controller, Get, Post, Delete, Param, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { SkillsService } from './skills.service.js';

@Controller('skills')
export class SkillsController {
    constructor(private readonly skillsService: SkillsService) {}

    @Get()
    async getSkills(@Query('workspace') workspace?: string) {
        const skills = workspace
            ? await this.skillsService.getSkillsForWorkspace(workspace)
            : await this.skillsService.getSkills();
        return { success: true, data: skills };
    }

    @Get(':name')
    async getSkill(@Param('name') name: string) {
        const skill = await this.skillsService.getSkill(name);
        if (!skill) {
            throw new HttpException('Skill not found', HttpStatus.NOT_FOUND);
        }
        return { success: true, data: skill };
    }

    @Get(':name/content')
    async getSkillContent(
        @Param('name') name: string,
        @Query('workspace') workspace?: string,
    ) {
        const content = workspace
            ? await this.skillsService.getSkillContentForWorkspace(workspace, name)
            : await this.skillsService.getSkillContent(name);
        if (!content) {
            throw new HttpException('Skill not found', HttpStatus.NOT_FOUND);
        }
        return { success: true, data: { content } };
    }

    @Post()
    async addSkill(
        @Body() body: { workspace: string; name: string; description?: string; content?: string },
    ) {
        const { workspace, name, description, content } = body;
        if (!workspace || !name) {
            throw new HttpException('workspace and name are required', HttpStatus.BAD_REQUEST);
        }
        const skill = await this.skillsService.addSkill(workspace, name, {
            description,
            content,
        });
        return { success: true, data: skill };
    }

    @Delete(':name')
    async deleteSkill(@Param('name') name: string, @Query('workspace') workspace?: string) {
        if (!workspace) {
            throw new HttpException('workspace query is required', HttpStatus.BAD_REQUEST);
        }
        await this.skillsService.deleteSkill(workspace, name);
        return { success: true };
    }
}
