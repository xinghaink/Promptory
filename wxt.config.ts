import { defineConfig } from 'wxt';
import { AI_SITE_MATCHES } from './src/lib/sites';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Promptory',
    description: '本地优先、跨 AI 平台的个人提示词库',
    permissions: ['storage', 'unlimitedStorage', 'contextMenus', 'scripting', 'activeTab', 'clipboardRead'],
    host_permissions: AI_SITE_MATCHES,
    action: { default_title: '打开 Promptory' },
    commands: {
      'open-palette': {
        suggested_key: { default: 'Alt+P' },
        description: '在 AI 网站输入框中唤起 Promptory',
      },
      'save-selection': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: '保存当前网页选中的文本',
      },
    },
  },
});
