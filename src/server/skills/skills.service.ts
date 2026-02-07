import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DEFAULT_AGENT_ID } from '../agent-config/agent-config.service.js';
import { readdir, readFile, stat, mkdir, writeFile, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

export interface Skill {
    name: string;
    description: string;
    path: string;
    category?: string;
    source?: 'system' | 'global' | 'workspace';
    metadata?: any;
}

/** 工作区技能名仅允许英文、数字、下划线、连字符 */
const SKILL_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

/** 技能目录与来源：全局=~/.freebot/agent/skills，系统=项目根/skills，工作区=~/.freebot/workspace/xxx/skills */
@Injectable()
export class SkillsService {
    /** 待扫描的目录列表 */
    private skillPaths: Array<{ path: string; source: 'system' | 'global' | 'workspace' }> = [];

    constructor() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
        const cwd = process.cwd();
        const workspaceName = process.env.FREEBOT_WORKSPACE || 'default';

        // 全局技能：~/.freebot/agent/skills
        const globalSkillsDir = resolve(homeDir, '.freebot', 'agent', 'skills');
        // 系统技能：当前项目代码根目录下的 skills
        const systemSkillsDir = resolve(cwd, 'skills');
        // 工作区技能：~/.freebot/workspace/<name>/skills
        const workspaceSkillsDir = resolve(homeDir, '.freebot', 'workspace', workspaceName, 'skills');

        if (existsSync(globalSkillsDir)) {
            this.skillPaths.push({ path: globalSkillsDir, source: 'global' });
        }
        if (existsSync(systemSkillsDir)) {
            this.skillPaths.push({ path: systemSkillsDir, source: 'system' });
        }
        if (existsSync(workspaceSkillsDir)) {
            this.skillPaths.push({ path: workspaceSkillsDir, source: 'workspace' });
        }
    }

    /** 指定工作区的 skills 目录绝对路径 */
    getWorkspaceSkillsDir(workspaceName: string): string {
        const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
        return resolve(homeDir, '.freebot', 'workspace', workspaceName, 'skills');
    }

    async getSkills(): Promise<Skill[]> {
        const skills: Skill[] = [];

        for (const { path: skillPath, source } of this.skillPaths) {
            try {
                const entries = await readdir(skillPath);

                for (const entry of entries) {
                    const fullPath = join(skillPath, entry);
                    const stats = await stat(fullPath);

                    if (stats.isDirectory()) {
                        const skillMdPath = join(fullPath, 'SKILL.md');
                        if (existsSync(skillMdPath)) {
                            const content = await readFile(skillMdPath, 'utf-8');
                            const skill = this.parseSkillFile(entry, content, fullPath, source);
                            skills.push(skill);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading skills from ${skillPath}:`, error);
            }
        }

        return skills;
    }

    async getSkill(name: string): Promise<Skill | null> {
        const skills = await this.getSkills();
        return skills.find(s => s.name === name) || null;
    }

    async getSkillContent(name: string): Promise<string | null> {
        const skill = await this.getSkill(name);
        if (!skill) return null;

        try {
            const skillMdPath = join(skill.path, 'SKILL.md');
            return await readFile(skillMdPath, 'utf-8');
        } catch (error) {
            console.error(`Error reading skill content for ${name}:`, error);
            return null;
        }
    }

    /** 仅返回指定工作区下的技能（文件目录管理，不涉及 SQLite） */
    async getSkillsForWorkspace(workspaceName: string): Promise<Skill[]> {
        const skillPath = this.getWorkspaceSkillsDir(workspaceName);
        if (!existsSync(skillPath)) return [];

        const skills: Skill[] = [];
        try {
            const entries = await readdir(skillPath);
            for (const entry of entries) {
                const fullPath = join(skillPath, entry);
                const stats = await stat(fullPath);
                if (stats.isDirectory()) {
                    const skillMdPath = join(fullPath, 'SKILL.md');
                    if (existsSync(skillMdPath)) {
                        const content = await readFile(skillMdPath, 'utf-8');
                        skills.push(this.parseSkillFile(entry, content, fullPath, 'workspace'));
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading workspace skills from ${skillPath}:`, error);
        }
        return skills;
    }

    async getSkillContentForWorkspace(workspaceName: string, name: string): Promise<string | null> {
        const skillPath = this.getWorkspaceSkillsDir(workspaceName);
        const fullPath = join(skillPath, name);
        const skillMdPath = join(fullPath, 'SKILL.md');
        if (!existsSync(skillMdPath)) return null;
        try {
            return await readFile(skillMdPath, 'utf-8');
        } catch {
            return null;
        }
    }

    /** 在工作区下新增技能（创建目录 + SKILL.md） */
    async addSkill(
        workspaceName: string,
        name: string,
        options?: { description?: string; content?: string },
    ): Promise<Skill> {
        if (!name || !SKILL_NAME_REGEX.test(name)) {
            throw new BadRequestException('技能名必须为英文、数字、下划线或连字符');
        }
        const skillDir = join(this.getWorkspaceSkillsDir(workspaceName), name);
        if (existsSync(skillDir)) {
            throw new ConflictException('该技能名已存在');
        }
        await mkdir(skillDir, { recursive: true });
        const description = options?.description ?? 'No description available';
        const body = options?.content ?? '';
        const content = `---\ndescription: ${description}\n---\n\n${body}`;
        await writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8');
        return this.parseSkillFile(name, content, skillDir, 'workspace');
    }

    /** 删除工作区下的技能目录；主智能体（default）下的 Skill 不可删除 */
    async deleteSkill(workspaceName: string, name: string): Promise<void> {
        if (workspaceName === DEFAULT_AGENT_ID) {
            throw new BadRequestException('主智能体下的 Skill 不可删除');
        }
        const skillDir = join(this.getWorkspaceSkillsDir(workspaceName), name);
        if (!existsSync(skillDir)) {
            throw new NotFoundException('技能不存在');
        }
        await rm(skillDir, { recursive: true });
    }

    private parseSkillFile(name: string, content: string, path: string, source: 'system' | 'global' | 'workspace' = 'system'): Skill {
        // Extract YAML frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        let description = 'No description available';
        let metadata: any = {};

        if (frontmatterMatch) {
            const frontmatter = frontmatterMatch[1];
            const descMatch = frontmatter.match(/description:\s*(.+)/);
            if (descMatch) {
                description = descMatch[1].trim();
            }

            // Parse other metadata
            const categoryMatch = frontmatter.match(/category:\s*(.+)/);
            if (categoryMatch) {
                metadata.category = categoryMatch[1].trim();
            }
        }

        return {
            name,
            description,
            path,
            category: metadata.category,
            source,
            metadata,
        };
    }
}
