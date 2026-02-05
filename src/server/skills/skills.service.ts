import { Injectable } from '@nestjs/common';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface Skill {
    name: string;
    description: string;
    path: string;
    category?: string;
    source?: 'system' | 'global' | 'workspace';
    metadata?: any;
}

@Injectable()
export class SkillsService {
    private skillPaths: string[] = [];

    constructor() {
        // Initialize skill paths
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const freebotAgentDir = join(homeDir, '.freebot', 'agent', 'skills');
        const projectSkillsDir = join(process.cwd(), '..', '..', 'skills');
        // Workspace skills: check for 'skills' folder in current working directory
        const workspaceSkillsDir = join(process.cwd(), 'skills');

        if (existsSync(projectSkillsDir)) {
            this.skillPaths.push(projectSkillsDir);
        }
        if (existsSync(freebotAgentDir)) {
            this.skillPaths.push(freebotAgentDir);
        }
        if (existsSync(workspaceSkillsDir)) {
            this.skillPaths.push(workspaceSkillsDir);
        }
    }

    async getSkills(): Promise<Skill[]> {
        const skills: Skill[] = [];

        for (const skillPath of this.skillPaths) {
            try {
                const entries = await readdir(skillPath);

                for (const entry of entries) {
                    const fullPath = join(skillPath, entry);
                    const stats = await stat(fullPath);

                    if (stats.isDirectory()) {
                        const skillMdPath = join(fullPath, 'SKILL.md');
                        if (existsSync(skillMdPath)) {
                            const content = await readFile(skillMdPath, 'utf-8');
                            // Determine source
                            let source: 'system' | 'global' | 'workspace' = 'system';
                            if (skillPath.includes('.freebot')) {
                                source = 'global';
                            } else if (skillPath === join(process.cwd(), 'skills')) {
                                source = 'workspace';
                            }

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
