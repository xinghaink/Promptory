import { beforeEach, describe, expect, it } from 'vitest';
import { applyCandidates, findVariableCandidates, suggestTags, suggestTitle } from './capture';
import { PromptoryDB } from './db';
import { diffLines, diffStats } from './diff';
import { createRepo, type Repo } from './repo';
import { searchPrompts } from './search';
import { convertRaycast, exportBackup, exportMarkdown, importItems, parseCsv, parseImport } from './transfer';
import {
  builtinValues,
  extractBuiltinNames,
  extractVariableNames,
  initialValues,
  renderTemplate,
  syncVariables,
} from './variables';

describe('variables', () => {
  const tpl = '为 {{姓名}} 写 {{ 风格 }} 周报，日期 {{@今天}}，再提 {{姓名}}';

  it('extracts user and built-in variables in order without duplicates', () => {
    expect(extractVariableNames(tpl)).toEqual(['姓名', '风格']);
    expect(extractBuiltinNames(tpl)).toEqual(['今天']);
  });

  it('renders values and keeps tokens that have no value', () => {
    const out = renderTemplate(tpl, { 姓名: '小王' }, builtinValues({ now: new Date(2026, 9, 20) }));
    expect(out).toBe('为 小王 写 {{ 风格 }} 周报，日期 2026-10-20，再提 小王');
  });

  it('keeps existing variable settings when syncing', () => {
    const synced = syncVariables('{{风格}} {{新变量}}', [
      { name: '风格', type: 'select', default: '', options: ['简洁', '正式'] },
      { name: '已删除', type: 'text', default: '', options: [] },
    ]);
    expect(synced.map((v) => v.name)).toEqual(['风格', '新变量']);
    expect(synced[0].type).toBe('select');
    expect(synced[1].type).toBe('text');
  });

  it('prefers remembered values, then defaults, then the first option', () => {
    const values = initialValues(
      [
        { name: 'a', type: 'text', default: 'da', options: [] },
        { name: 'b', type: 'select', default: '', options: ['x', 'y'] },
        { name: 'c', type: 'text', default: 'dc', options: [] },
      ],
      { c: 'remembered' },
    );
    expect(values).toEqual({ a: 'da', b: 'x', c: 'remembered' });
  });
});

describe('diff', () => {
  it('finds added and removed lines', () => {
    const lines = diffLines('a\nb\nc', 'a\nB\nc\nd');
    expect(lines.map((l) => `${l.kind}:${l.text}`)).toEqual(['same:a', 'del:b', 'add:B', 'same:c', 'add:d']);
    expect(diffStats(lines)).toEqual({ added: 2, removed: 1 });
  });

  it('treats empty text as no lines', () => {
    expect(diffLines('', 'a\nb').map((l) => l.kind)).toEqual(['add', 'add']);
  });
});

describe('capture rules', () => {
  const text = '你是一名资深电商文案。请为「降噪蓝牙耳机」写 5 条小红书风格的标题，突出「续航 40 小时」这个卖点。';

  it('suggests a title without the role prefix', () => {
    expect(suggestTitle(text)).toBe('为「降噪蓝牙耳机」写 5 条小红…');
  });

  it('suggests tags from keywords', () => {
    expect(suggestTags(text)).toEqual(expect.arrayContaining(['小红书', '营销', '角色扮演']));
  });

  it('turns quoted phrases into variables', () => {
    const candidates = findVariableCandidates(text);
    expect(candidates.map((c) => c.text)).toEqual(['降噪蓝牙耳机', '续航 40 小时']);
    expect(candidates[1].name).toBe('变量2');
    const out = applyCandidates(text, [
      { text: '降噪蓝牙耳机', name: '产品' },
      { text: '续航 40 小时', name: '卖点' },
    ]);
    expect(out).toContain('请为{{产品}}写');
    expect(extractVariableNames(out)).toEqual(['产品', '卖点']);
  });
});

describe('transfer', () => {
  it('parses CSV with quotes and newlines', () => {
    expect(parseCsv('title,prompt\n"A, b","line1\nline2 ""q"""\n')).toEqual([
      ['title', 'prompt'],
      ['A, b', 'line1\nline2 "q"'],
    ]);
  });

  it('imports AIPRM-style CSV columns', () => {
    const items = parseImport('Title,Teaser,Prompt,Topic\nSEO 标题,一句话,写 [KEYWORD] 的标题,SEO\n', 'aiprm.csv');
    expect(items).toEqual([
      { title: 'SEO 标题', content: '写 [KEYWORD] 的标题', description: '一句话', tags: ['SEO'], folderName: undefined },
    ]);
  });

  it('converts Raycast placeholders', () => {
    expect(convertRaycast('Translate {selection | trim} to {argument name="语言"} {clipboard}')).toBe(
      'Translate {{@选中文本}} to {{语言}} {{@剪贴板}}',
    );
    const items = parseImport(JSON.stringify([{ title: 'T', prompt: 'Fix {selection}', creativity: 'low' }]), 'r.json');
    expect(items[0].content).toBe('Fix {{@选中文本}}');
  });

  it('parses Markdown sections', () => {
    const md = '# x\n\n## 甲\n\n> 描述\n\n标签：#a #b · 快捷词：/jia\n\n````text\n内容 {{v}}\n````\n\n## 乙\n普通正文\n';
    const items = parseImport(md, 'p.md');
    expect(items[0]).toMatchObject({ title: '甲', content: '内容 {{v}}', description: '描述', tags: ['a', 'b'], shortcut: 'jia' });
    expect(items[1]).toMatchObject({ title: '乙', content: '普通正文' });
  });
});

describe('repo', () => {
  let db: PromptoryDB;
  let repo: Repo;

  beforeEach(async () => {
    db = new PromptoryDB(`test-${crypto.randomUUID()}`);
    repo = createRepo(db);
  });

  it('creates v1 as recommended and the recommendation follows new versions', async () => {
    const p = await repo.createPrompt({ title: ' 周报 ', content: '为 {{姓名}}', shortcut: '/ZB ', tags: ['#职场', '职场'] });
    expect(p).toMatchObject({ title: '周报', shortcut: 'zb', tags: ['职场'], recommendedVersion: 1 });
    await repo.saveVersion(p.id, { content: '为 {{姓名}} 和 {{风格}}', variables: [], note: '加风格' });
    const latest = await repo.getWithVersion(p.id);
    expect(latest?.prompt.recommendedVersion).toBe(2);
    expect(latest?.version.variables.map((v) => v.name)).toEqual(['姓名', '风格']);
  });

  it('keeps a pinned older recommendation when saving', async () => {
    const p = await repo.createPrompt({ title: 'x', content: 'v1' });
    await repo.saveVersion(p.id, { content: 'v2', variables: [] });
    await repo.setRecommended(p.id, 1);
    await repo.saveVersion(p.id, { content: 'v3', variables: [] });
    const got = await repo.getWithVersion(p.id);
    expect(got?.version.content).toBe('v1');
    expect(got?.prompt.latestVersion).toBe(3);
  });

  it('restores an old version as a new one', async () => {
    const p = await repo.createPrompt({ title: 'x', content: 'old' });
    await repo.saveVersion(p.id, { content: 'new', variables: [] });
    const restored = await repo.restoreVersion(p.id, 1);
    expect(restored).toMatchObject({ number: 3, content: 'old', note: '恢复自 v1' });
    expect((await repo.listVersions(p.id)).map((v) => v.number)).toEqual([3, 2, 1]);
  });

  it('records use, remembered values and feedback per version', async () => {
    const p = await repo.createPrompt({ title: 'x', content: '{{a}}' });
    await repo.recordUse(p.id, 1, { a: '1' }, true);
    await repo.recordUse(p.id, 1, { a: '2' }, false);
    await repo.giveFeedback(p.id, 1, true);
    const got = await repo.getWithVersion(p.id);
    expect(got?.prompt).toMatchObject({ useCount: 2, lastValues: { a: '1' } });
    expect(got?.version).toMatchObject({ useCount: 2, goodCount: 1, badCount: 0 });
  });

  it('trashes, purges expired items and finds shortcut conflicts', async () => {
    const a = await repo.createPrompt({ title: 'a', content: 'a', shortcut: 'zb' });
    expect((await repo.findByShortcut('ZB'))?.id).toBe(a.id);
    expect(await repo.findByShortcut('zb', a.id)).toBeUndefined();
    await repo.moveToTrash(a.id);
    expect(await repo.listActiveWithVersions()).toHaveLength(0);
    expect(await repo.purgeExpired(Date.now() + 31 * 86_400_000)).toBe(1);
    expect(await db.versions.count()).toBe(0);
  });

  it('round-trips a backup with versions, folders and recommendation', async () => {
    const folder = await repo.createFolder('写作');
    const p = await repo.createPrompt({ title: '周报', content: 'v1 {{a}}', folderId: folder.id, shortcut: 'zb' });
    await repo.saveVersion(p.id, {
      content: 'v2 {{a}}',
      variables: [{ name: 'a', type: 'select', default: '', options: ['x'] }],
    });
    await repo.saveVersion(p.id, { content: 'v3 {{a}}', variables: [] });
    await repo.setRecommended(p.id, 2);
    const backup = await exportBackup(db);
    expect(await exportMarkdown(db)).toContain('v2 {{a}}');

    const other = new PromptoryDB(`test-${crypto.randomUUID()}`);
    const otherRepo = createRepo(other);
    const n = await importItems(otherRepo, parseImport(JSON.stringify(backup), 'backup.json'));
    expect(n).toBe(1);
    const [imported] = await otherRepo.listActiveWithVersions();
    expect(imported.prompt).toMatchObject({ title: '周报', shortcut: 'zb', latestVersion: 3, recommendedVersion: 2 });
    expect(imported.version.variables[0].type).toBe('select');
    expect((await otherRepo.listFolders())[0].name).toBe('写作');
  });
});

describe('search', () => {
  const make = (title: string, extra: Partial<{ shortcut: string; tags: string[]; useCount: number }> = {}, content = '') => ({
    prompt: {
      id: title, title, description: '', folderId: null, tags: extra.tags ?? [], models: [], shortcut: extra.shortcut ?? '',
      isFavorite: false, inInbox: false, sourceUrl: '', draft: null, recommendedVersion: 1, latestVersion: 1,
      lastValues: {}, useCount: extra.useCount ?? 0, lastUsedAt: null, createdAt: 0, updatedAt: 0, deletedAt: null,
    },
    content,
  });

  it('ranks shortcut, then title, then content matches', () => {
    const items = [make('会议纪要', {}, '可粘贴进周报'), make('月度周报'), make('周报生成器', { shortcut: 'zb' })];
    expect(searchPrompts(items, 'zb').map((h) => h.item.prompt.title)).toEqual(['周报生成器']);
    expect(searchPrompts(items, '周报').map((h) => h.item.prompt.title)).toEqual(['周报生成器', '月度周报', '会议纪要']);
    expect(searchPrompts(items, '周报')[2].snippet).toContain('周报');
  });

  it('requires all terms and orders empty queries by usage', () => {
    const items = [make('a', { useCount: 1 }), make('b', { useCount: 10 })];
    expect(searchPrompts(items, '').map((h) => h.item.prompt.title)).toEqual(['b', 'a']);
    expect(searchPrompts([make('周报 生成', { tags: ['职场'] })], '周报 职场')).toHaveLength(1);
    expect(searchPrompts([make('周报')], '周报 不存在')).toHaveLength(0);
  });
});
