import { useState } from 'react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
}

/** Enter, comma or space adds a tag; Backspace on an empty field removes the last one. */
export function TagsInput({ tags, onChange, label = '添加标签' }: Props) {
  const [text, setText] = useState('');

  const commit = () => {
    const t = text.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setText('');
  };

  return (
    <div className="tags-input">
      {tags.map((t) => (
        <span key={t} className="chip">
          #{t}
          <button type="button" aria-label={`移除标签 ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        aria-label={label}
        placeholder={tags.length ? '' : `${label}…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter' || e.key === ',' || e.key === '，' || e.key === ' ') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !text && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
