import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/app.css';
import { App } from '@/entrypoints/app/App';
import { db } from '@/lib/db';
import { repo } from '@/lib/repo';
import { seedSamples } from '@/lib/samples';

const SEEDED = 'promptory.seeded';

function seededBefore(): boolean {
  try {
    return localStorage.getItem(SEEDED) === '1';
  } catch {
    return false;
  }
}

/** Standalone web app: same UI as the extension's management page, seeded on first visit. */
async function boot() {
  try {
    if (!seededBefore() && (await db.prompts.count()) === 0) {
      await seedSamples(repo);
      try {
        localStorage.setItem(SEEDED, '1');
      } catch {
        // Without storage we may seed again next time the library is empty; harmless.
      }
      location.hash = '#/welcome';
    }
  } catch (e) {
    console.error('Promptory: could not prepare sample prompts', e);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
