/**
 * Helpers for the chat input ("composer") on AI sites. Sites use either a
 * <textarea> or a rich contenteditable editor (ProseMirror, Lexical, Quill…),
 * so insertion goes through the events those editors already listen to.
 */

const EDITABLE = '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';

export function editableFrom(el: EventTarget | null): HTMLElement | null {
  if (el instanceof HTMLTextAreaElement) return el;
  if (el instanceof HTMLElement) return el.closest<HTMLElement>(EDITABLE);
  return null;
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 40 && r.height > 10 && getComputedStyle(el).visibility !== 'hidden';
}

/** The focused composer, else the last visible input on the page (chat inputs sit at the bottom). */
export function findComposer(): HTMLElement | null {
  const focused = editableFrom(document.activeElement);
  if (focused) return focused;
  const all = [...document.querySelectorAll<HTMLElement>(`textarea, ${EDITABLE}`)].filter(isVisible);
  return all.at(-1) ?? null;
}

export function getText(el: HTMLElement): string {
  return el instanceof HTMLTextAreaElement ? el.value : el.innerText;
}

export interface SavedCaret {
  range: Range | null;
}

export function saveCaret(el: HTMLElement): SavedCaret {
  if (el instanceof HTMLTextAreaElement) return { range: null };
  const sel = window.getSelection();
  const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  return { range: range && el.contains(range.commonAncestorContainer) ? range.cloneRange() : null };
}

function selectAllIn(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/**
 * Inserts text into the composer. With `replaceAll` the current content
 * (the `/快捷词` that opened the palette) is replaced.
 */
export function insertIntoComposer(el: HTMLElement, text: string, replaceAll: boolean, caret?: SavedCaret): void {
  el.focus();
  if (el instanceof HTMLTextAreaElement) {
    const start = replaceAll ? 0 : el.selectionStart;
    const end = replaceAll ? el.value.length : el.selectionEnd;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    // React-controlled textareas ignore direct `.value =` writes; use the native setter.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(el, next);
    el.setSelectionRange(start + text.length, start + text.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if (replaceAll) selectAllIn(el);
  else if (caret?.range) {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(caret.range);
  }

  // Rich editors handle paste (including multi-line text) themselves; if none
  // took it, fall back to the browser's own text insertion.
  const data = new DataTransfer();
  data.setData('text/plain', text);
  const paste = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
  const handled = !el.dispatchEvent(paste);
  if (!handled) document.execCommand('insertText', false, text);
}

const SEND_SELECTORS = [
  'button[data-testid="send-button"]',
  '#composer-submit-button',
  'button[aria-label*="Send" i]',
  'button[aria-label*="发送"]',
  'button[type="submit"]',
];

/** Clicks the site's send button; falls back to pressing Enter in the composer. */
export function submitComposer(el: HTMLElement): void {
  const scope: ParentNode = el.closest('form') ?? document;
  for (const sel of SEND_SELECTORS) {
    const btn = [...scope.querySelectorAll<HTMLButtonElement>(sel)].find((b) => !b.disabled && isVisible(b));
    if (btn) {
      btn.click();
      return;
    }
  }
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
}
