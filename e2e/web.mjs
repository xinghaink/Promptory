// Smoke test for the standalone web build.
//   npm run build:web && npm run e2e:web
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve('dist-web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try {
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const shots = process.env.SHOTS_DIR;
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.getByText('欢迎使用 Promptory').waitFor();
  check('首次打开预置示例', (await page.locator('.card').count()) === 3);
  check('网页版提示文案', await page.getByText('网页版', { exact: true }).isVisible());
  if (shots) await page.screenshot({ path: `${shots}/web-light.png` });

  await page.locator('.card', { hasText: '周报生成器' }).click();
  await page.getByRole('button', { name: '使用', exact: true }).click();
  await page.getByLabel('姓名').fill('小王');
  await page.getByRole('button', { name: '复制到剪贴板' }).click();
  check('复制填好的提示词', (await page.evaluate(() => navigator.clipboard.readText())).includes('为 小王 撰写'));

  // Two-step delete instead of confirm().
  await page.getByRole('button', { name: '移到回收站' }).click();
  await page.getByRole('link', { name: /^回收站/ }).click();
  await page.locator('.card').first().click();
  await page.getByRole('button', { name: '彻底删除' }).click();
  await page.getByRole('button', { name: /再点一次确认/ }).click();
  await page.getByText('回收站是空的').waitFor();
  check('两步确认彻底删除', true);

  // Reload keeps data and does not re-seed.
  await page.goto(url);
  await page.locator('.card').first().waitFor();
  check('刷新后数据保留且不重复预置', (await page.locator('.card').count()) === 2);

  const dark = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const dp = await dark.newPage();
  await dp.goto(url);
  await dp.locator('.card').first().waitFor();
  const bg = await dp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('深色模式', bg === 'rgb(18, 18, 20)', bg);
  if (shots) await dp.screenshot({ path: `${shots}/web-dark.png` });

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await phone.newPage();
  await pp.goto(url);
  await pp.locator('.card').first().waitFor();
  const overflow = await pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('手机宽度无横向滚动', overflow <= 0, `${overflow}px`);
  check('没有脚本错误', errors.length === 0, errors.join('; '));
} catch (e) {
  failures.push(String(e));
  console.error(e);
} finally {
  await browser.close();
  server.close();
}
console.log(failures.length ? `\n${failures.length} 项失败` : '\n全部通过');
process.exit(failures.length ? 1 : 0);
