import { Fragment } from 'react';
import { parseTemplate } from '@/lib/variables';

interface Props {
  content: string;
  /** When given, filled variables show their value instead of the token. */
  values?: Record<string, string>;
  builtins?: Partial<Record<string, string>>;
}

/** Shows a template with variables marked; with values it doubles as the live preview. */
export function Highlighted({ content, values, builtins }: Props) {
  return (
    <>
      {parseTemplate(content).map((seg, i) => {
        if (seg.kind === 'text') return <Fragment key={i}>{seg.text}</Fragment>;
        const value = values ? (seg.builtin ? builtins?.[seg.name] : values[seg.name]) : undefined;
        if (value) return <mark key={i} className="filled">{value}</mark>;
        return (
          <mark key={i} className={seg.builtin ? 'builtin' : 'var'}>
            {seg.raw}
          </mark>
        );
      })}
    </>
  );
}
