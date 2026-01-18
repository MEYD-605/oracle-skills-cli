import { $ } from 'bun';
import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as p from '@clack/prompts';
import { agents } from './agents.js';
import type { Skill, InstallOptions } from './types.js';

const REPO = 'Soul-Brews-Studio/plugin-marketplace';
const SKILLS_PATH = 'oracle-skills/skills';

export async function cloneRepo(): Promise<string> {
  const spinner = p.spinner();
  spinner.start('Cloning Oracle skills repository');

  const tempDir = join(tmpdir(), `oracle-skills-${Date.now()}`);

  try {
    // Sparse checkout for faster clone
    await $`git clone --depth 1 --filter=blob:none --sparse https://github.com/${REPO}.git ${tempDir}`.quiet();
    await $`git -C ${tempDir} sparse-checkout set ${SKILLS_PATH}`.quiet();
    spinner.stop('Repository cloned');
    return tempDir;
  } catch {
    // Fallback to full clone
    spinner.stop('Sparse clone failed, trying full clone');
    await $`git clone --depth 1 https://github.com/${REPO}.git ${tempDir}`.quiet();
    return tempDir;
  }
}

export async function discoverSkills(repoPath: string): Promise<Skill[]> {
  const skillsPath = join(repoPath, SKILLS_PATH);

  if (!existsSync(skillsPath)) {
    return [];
  }

  const skillDirs = readdirSync(skillsPath, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== '_template')
    .map((d) => d.name);

  const skills: Skill[] = [];

  for (const name of skillDirs) {
    const skillMdPath = join(skillsPath, name, 'SKILL.md');
    if (existsSync(skillMdPath)) {
      const content = await Bun.file(skillMdPath).text();
      const descMatch = content.match(/description:\s*(.+)/);
      skills.push({
        name,
        description: descMatch?.[1]?.trim() || '',
        path: join(skillsPath, name),
      });
    }
  }

  return skills;
}

export async function listSkills(repoPath: string): Promise<void> {
  const skills = await discoverSkills(repoPath);

  if (skills.length === 0) {
    p.log.warn('No skills found');
    return;
  }

  p.log.info(`Found ${skills.length} skills:\n`);

  for (const skill of skills) {
    console.log(`  ${skill.name}`);
    if (skill.description) {
      console.log(`    ${skill.description}\n`);
    }
  }
}

export async function installSkills(
  repoPath: string,
  targetAgents: string[],
  options: InstallOptions
): Promise<void> {
  const allSkills = await discoverSkills(repoPath);

  if (allSkills.length === 0) {
    p.log.error('No skills found to install');
    return;
  }

  // Filter skills if specific ones requested
  let skillsToInstall = allSkills;
  if (options.skills && options.skills.length > 0) {
    skillsToInstall = allSkills.filter((s) => options.skills!.includes(s.name));
    if (skillsToInstall.length === 0) {
      p.log.error(`No matching skills found. Available: ${allSkills.map((s) => s.name).join(', ')}`);
      return;
    }
  }

  // Confirm installation
  if (!options.yes) {
    const agentList = targetAgents.map((a) => agents[a as keyof typeof agents]?.displayName || a).join(', ');
    const confirmed = await p.confirm({
      message: `Install ${skillsToInstall.length} skills to ${agentList}?`,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.log.info('Installation cancelled');
      return;
    }
  }

  const spinner = p.spinner();
  spinner.start('Installing skills');

  for (const agentName of targetAgents) {
    const agent = agents[agentName as keyof typeof agents];
    if (!agent) {
      p.log.warn(`Unknown agent: ${agentName}`);
      continue;
    }

    const targetDir = options.global ? agent.globalSkillsDir : join(process.cwd(), agent.skillsDir);

    // Create target directory using Bun Shell
    await $`mkdir -p ${targetDir}`.quiet();

    // Copy each skill
    for (const skill of skillsToInstall) {
      const destPath = join(targetDir, skill.name);

      // Remove existing if present
      if (existsSync(destPath)) {
        await $`rm -rf ${destPath}`.quiet();
      }

      // Copy skill folder
      await $`cp -r ${skill.path} ${destPath}`.quiet();
    }

    p.log.success(`${agent.displayName}: ${targetDir}`);
  }

  spinner.stop(`Installed ${skillsToInstall.length} skills to ${targetAgents.length} agent(s)`);
}

export async function cleanup(repoPath: string): Promise<void> {
  try {
    await $`rm -rf ${repoPath}`.quiet();
  } catch {
    // Ignore cleanup errors
  }
}
