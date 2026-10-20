import { createRoot, type Root } from 'react-dom/client';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { AI_SITE_MATCHES } from '@/lib/sites';
import { PaletteHost } from './PaletteHost';
import './palette.css';

export default defineContentScript({
  matches: AI_SITE_MATCHES,
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'promptory-palette',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount(container, _shadow, host) {
        // Keep keystrokes typed into the palette away from the site's own
        // "type anywhere to focus the input" handlers.
        for (const type of ['keydown', 'keyup', 'keypress', 'input', 'paste', 'copy']) {
          host.addEventListener(type, (e) => e.stopPropagation());
        }
        const root = createRoot(container);
        root.render(<PaletteHost host={host} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
