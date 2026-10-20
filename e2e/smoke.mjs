// End-to-end smoke test: loads the built extension into Chromium and drives
// the main flows. AI sites are replaced by local stand-in pages via routing.
//   npm run build && npm run e2e
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ext = resolve('.output/chrome-mv3');
const shots = process.env.SHOTS_DIR;
const failures = [];

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

const TEXTAREA_SITE = `<!doctype html><html><body style="margin:0;font-family:sans-serif">
<main style="height:100vh;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:24px">
<p id="sent"></p>
<form style="width:700px;display:flex;gap:8px" onsubmit="return false">
<textarea id="prompt-textarea" rows="3" style="flex:1"></textarea>
<button type="button" data-testid="send-button" onclick="document.getElementById('sent').textContent=document.getElementById('prompt-textarea').value">Send</button>
</form></main></body></html>`;

const EDITABLE_SITE = `<!doctype html><html><body style="margin:0;font-family:sans-serif">
<main style="height:100vh;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:24px">
<p>Some page text to select.</p>
<div id="editor" contenteditable="true" style="width:700px;min-height:60px;border:1px solid #999;padding:8px"></div>
</main></body></html>`;

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'promptory-')), {
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  viewport: { width: 1440, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
await context.route('https://chatgpt.com/**', (r) => r.fulfill({ contentType: 'text/html', body: TEXTAREA_SITE }));
await context.route('https://claude.ai/**', (r) => r.fulfill({ contentType: 'text/html', body: EDITABLE_SITE }));

try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extId = new URL(worker.url()).host;
  const appUrl = `chrome-extension://${extId}/app.html`;

  // ---- First run: samples are seeded and the welcome page opens.
  const app = await context.newPage();
  await app.goto(`${appUrl}#/welcome`);
  await app.getByText('欢迎使用 Promptory').waitFor();
  const cards = await app.locator('.card').count();
  check('首次安装预置 3 个示例', cards === 3, `${cards} 张卡片`);
  if (shots) await app.screenshot({ path: `${shots}/1-library.png` });

  // ---- Use dialog: fill variables and copy.
  await app.locator('.card', { hasText: '周报生成器' }).click();
  await app.getByRole('button', { name: '使用', exact: true }).click();
  await app.getByLabel('姓名').fill('小王');
  await app.getByRole('radio', { name: '正式' }).click();
  await app.getByLabel('工作要点').fill('- 完成重构');
  const preview = await app.locator('.preview-box').innerText();
  check('使用弹窗实时预览', preview.includes('为 小王 撰写一份 正式 风格') && preview.includes('- 完成重构'));
  if (shots) await app.screenshot({ path: `${shots}/2-use.png` });
  await app.getByRole('button', { name: '复制到剪贴板' }).click();
  const clip = await app.evaluate(() => navigator.clipboard.readText());
  check('复制填好的提示词', clip.includes('为 小王 撰写一份 正式 风格的周报'), clip.split('\n')[1]);
  await app.getByRole('region', { name: '使用反馈' }).getByRole('button', { name: '好用', exact: true }).click();
  await app.getByText('好用 1 / 不好用 0').first().waitFor();
  check('使用后反馈记录到版本', true);

  // ---- Editor: change content, save v2, the recommendation follows.
  await app.getByRole('button', { name: '编辑', exact: true }).click();
  const editor = app.getByLabel('提示词内容');
  await editor.fill(`${await editor.inputValue()}\n4. 结尾附上 {{补充说明}}`);
  await app.getByText('草稿已自动保存，尚未生成版本').waitFor();
  check('编辑时识别新变量', (await app.locator('.var-row .name').allInnerTexts()).includes('补充说明'));
  if (shots) await app.screenshot({ path: `${shots}/3-editor.png` });
  await app.getByRole('button', { name: /保存为 v2/ }).click();
  await app.getByText('已是最新版本 v2').waitFor();
  check('保存生成 v2', true);

  // ---- History: diff and pin v1 as recommended.
  await app.getByRole('link', { name: '版本历史' }).click();
  await app.locator('.diff-line.add', { hasText: '补充说明' }).waitFor();
  check('版本对比显示新增行', true);
  await app.locator('.version', { hasText: 'v1' }).click();
  await app.getByRole('button', { name: '设为推荐版本' }).click();
  await app.locator('.version', { hasText: 'v1 · ★ 推荐' }).waitFor();
  check('把旧版本设为推荐', true);
  if (shots) await app.screenshot({ path: `${shots}/4-history.png` });

  // ---- ⌘K palette + quick save by paste.
  await app.goto(`${appUrl}#/`);
  await app.keyboard.press('Control+k');
  await app.getByLabel('搜索提示词或命令').fill('xhs');
  const firstHit = await app.locator('.palette-item').first().innerText();
  check('⌘K 按快捷词搜索', firstHit.includes('小红书标题生成'));
  if (shots) await app.screenshot({ path: `${shots}/5-search.png` });
  await app.keyboard.press('Escape');

  // ---- Content script on a textarea site: "/zb" opens the palette.
  const chat = await context.newPage();
  await chat.goto('https://chatgpt.com/');
  const ta = chat.locator('#prompt-textarea');
  await ta.click();
  await ta.pressSequentially('/xhs');
  const palette = chat.locator('promptory-palette .palette');
  await palette.waitFor();
  check('输入 /xhs 唤起面板', (await palette.locator('.item.active').innerText()).includes('小红书标题生成'));
  await chat.keyboard.press('Enter'); // has empty variables → moves focus to the form
  await chat.keyboard.type('降噪耳机');
  await chat.keyboard.press('Tab');
  await chat.keyboard.type('续航 40 小时');
  if (shots) await chat.screenshot({ path: `${shots}/6-inline.png` });
  await chat.keyboard.press('Enter');
  const inserted = await ta.inputValue();
  check('填写变量后插入输入框（替换 /xhs）', inserted.startsWith('你是一名资深电商文案。请为 降噪耳机 写') && inserted.includes('突出 续航 40 小时'), inserted.slice(0, 40));
  check('插入后显示反馈提示', await chat.locator('promptory-palette .notice').isVisible());

  // ⌘↵ inserts and sends; prompt without missing values inserts directly.
  await ta.fill('');
  await ta.pressSequentially('/cr');
  await palette.waitFor();
  await chat.keyboard.press('Control+Enter');
  await chat.waitForFunction(() => document.getElementById('sent').textContent.length > 0);
  const sent = await chat.locator('#sent').innerText();
  check('⌘↵ 插入并发送', sent.includes('资深 TypeScript 工程师'), sent.slice(0, 30));

  // Escape keeps the typed text.
  await ta.fill('');
  await ta.pressSequentially('/zb');
  await palette.waitFor();
  await chat.keyboard.press('Escape');
  check('Esc 关闭面板并保留文字', !(await palette.isVisible()) && (await ta.inputValue()) === '/zb');

  // ---- Content script on a contenteditable site.
  const claude = await context.newPage();
  await claude.goto('https://claude.ai/');
  const ed = claude.locator('#editor');
  await ed.click();
  await claude.keyboard.type('/zb');
  await claude.locator('promptory-palette .palette').waitFor();
  // Values remembered from the earlier use are filled in, so Enter inserts directly.
  await claude.keyboard.press('Enter');
  const edText = await ed.innerText();
  check('contenteditable 输入框插入（带入上次填写）', edText.includes('为 小王 撰写') && !edText.includes('/zb'), edText.split('\n')[1]);

  // ---- Capture window (what the context menu opens).
  await worker.evaluate(() =>
    chrome.storage.session.set({
      pendingCapture: { text: '请把下面的文字翻译成「英文」：保持术语准确。', url: 'https://example.com/post' },
    }),
  );
  const cap = await context.newPage();
  await cap.setViewportSize({ width: 480, height: 680 });
  await cap.goto(`chrome-extension://${extId}/capture.html`);
  await cap.getByText('发现 1 处可替换内容').waitFor();
  check('收藏时识别可替换内容', true);
  check('收藏时建议标签', (await cap.locator('.tags-input .chip').allInnerTexts()).some((t) => t.includes('翻译')));
  if (shots) await cap.screenshot({ path: `${shots}/7-capture.png` });
  await cap.getByRole('button', { name: /^保存 ⌘/ }).click();
  await cap.getByText('已保存').waitFor();

  await app.goto(`${appUrl}#/inbox`);
  await app.locator('.card', { hasText: '把下面的文字翻译成' }).waitFor();
  await app.locator('.card').first().click();
  const content = await app.locator('.prompt-box').innerText();
  check('收藏进入收件箱并转为变量', content.includes('翻译成{{英文}}'), content);

  // ---- Export / import round trip.
  await app.getByRole('button', { name: '导入 / 导出' }).click();
  const [download] = await Promise.all([app.waitForEvent('download'), app.getByRole('button', { name: '导出 JSON 备份' }).click()]);
  const backupPath = await download.path();
  await app.getByLabel('选择要导入的文件').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: (await import('node:fs')).readFileSync(backupPath) });
  await app.getByText('识别到 4 条').waitFor();
  await app.getByRole('button', { name: '导入 4 条' }).click();
  await app.getByText('已导入 4 条提示词').waitFor();
  await app.goto(`${appUrl}#/`);
  await app.locator('.card').nth(7).waitFor({ timeout: 5000 }).catch(() => undefined);
  const total = await app.locator('.card').count();
  check('导出后再导入', total === 8, `${total} 条`);
} catch (e) {
  failures.push(String(e));
  console.error(e);
} finally {
  await context.close();
}

console.log(failures.length ? `\n${failures.length} 项失败` : '\n全部通过');
process.exit(failures.length ? 1 : 0);
