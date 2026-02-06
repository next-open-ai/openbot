import { Injectable } from '@nestjs/common';
import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

export interface Skill {
    name: string;
    description: string;
    path: string;
    category?: string;
    source?: 'system' | 'global' | 'workspace';
    metadata?: any;
}

/** 技能目录与来源：全局=~/.freebot/agent/skills，系统=项目根/skills，工作区=~/.freebot/workspace/xxx/skills */
@Injectable()
export class SkillsService {
    /** 待扫描的目录列表 */
    private skillPaths: Array<{ path: string; source: 'system' | 'global' | 'workspace' }> = [];

    constructor() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
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
