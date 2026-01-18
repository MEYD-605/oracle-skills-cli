import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { $ } from 'bun';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { agents, detectInstalledAgents, getAgentNames } from '../src/agents';

const TEST_DIR = join(tmpdir(), `oracle-skills-test-${Date.now()}`);

describe('agents', () => {
  it('should have 14 agents defined', () => {
    expect(Object.keys(agents).length).toBe(14);
  });

  it('should return agent names', () => {
    const names = getAgentNames();
    expect(names).toContain('claude-code');
    expect(names).toContain('opencode');
    expect(names).toContain('cursor');
  });

  it('should detect installed agents', () => {
    const detected = detectInstalledAgents();
    expect(Array.isArray(detected)).toBe(true);
    // At least one agent should be detected in most dev environments
  });

  it('should have valid agent config structure', () => {
    for (const [key, config] of Object.entries(agents)) {
      expect(config.displayName).toBeDefined();
      expect(config.skillsDir).toBeDefined();
      expect(config.globalSkillsDir).toBeDefined();
      expect(typeof config.detectInstalled).toBe('function');
    }
  });
});

describe('CLI', () => {
  it('should show version', async () => {
    const result = await $`bun run src/index.ts --version`.text();
    expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should show help', async () => {
    const result = await $`bun run src/index.ts --help`.text();
    expect(result).toContain('oracle-skills');
    expect(result).toContain('install');
    expect(result).toContain('uninstall');
    expect(result).toContain('agents');
  });

  it('should list agents', async () => {
    const result = await $`bun run src/index.ts agents`.text();
    expect(result).toContain('claude-code');
    expect(result).toContain('opencode');
    expect(result).toContain('Supported agents');
  });
});

describe('installer', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should clone repo with sparse checkout', async () => {
    const { cloneRepo, cleanup } = await import('../src/installer');
    
    const repoPath = await cloneRepo();
    expect(existsSync(repoPath)).toBe(true);
    expect(existsSync(join(repoPath, 'oracle-skills'))).toBe(true);
    
    await cleanup(repoPath);
    expect(existsSync(repoPath)).toBe(false);
  }, 30000); // 30s timeout for clone

  it('should discover skills from repo', async () => {
    const { cloneRepo, discoverSkills, cleanup } = await import('../src/installer');
    
    const repoPath = await cloneRepo();
    const skills = await discoverSkills(repoPath);
    
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some(s => s.name === 'rrr')).toBe(true);
    expect(skills.some(s => s.name === 'recap')).toBe(true);
    
    await cleanup(repoPath);
  }, 30000);
});
