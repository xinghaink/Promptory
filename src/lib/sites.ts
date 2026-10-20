/** AI chat sites where the `/` palette is available. Keep in sync with host permissions. */
export const AI_SITES = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/', match: 'https://chatgpt.com/*' },
  { name: 'ChatGPT（旧域名）', url: 'https://chat.openai.com/', match: 'https://chat.openai.com/*' },
  { name: 'Claude', url: 'https://claude.ai/new', match: 'https://claude.ai/*' },
  { name: 'Gemini', url: 'https://gemini.google.com/app', match: 'https://gemini.google.com/*' },
  { name: 'DeepSeek', url: 'https://chat.deepseek.com/', match: 'https://chat.deepseek.com/*' },
  { name: '豆包', url: 'https://www.doubao.com/chat/', match: 'https://www.doubao.com/*' },
  { name: 'Kimi', url: 'https://www.kimi.com/', match: 'https://www.kimi.com/*' },
  { name: 'Kimi（旧域名）', url: 'https://kimi.moonshot.cn/', match: 'https://kimi.moonshot.cn/*' },
];

export const AI_SITE_MATCHES = AI_SITES.map((s) => s.match);

/** Sites offered in "复制并打开" — one entry per product. */
export const OPENABLE_SITES = AI_SITES.filter((s) => !s.name.includes('旧域名'));
