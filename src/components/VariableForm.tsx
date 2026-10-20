import { BUILTINS, type BuiltinName } from '@/lib/variables';
import type { Variable } from '@/lib/types';

interface Props {
  variables: Variable[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  builtinNames: BuiltinName[];
  builtinValues: Record<string, string>;
  onBuiltinChange: (name: BuiltinName, value: string) => void;
  autoFocus?: boolean;
}

export function VariableForm({
  variables,
  values,
  onChange,
  builtinNames,
  builtinValues,
  onBuiltinChange,
  autoFocus,
}: Props) {
  if (variables.length === 0 && builtinNames.length === 0) {
    return <div className="notice notice-info">这个提示词没有变量，可以直接使用。</div>;
  }
  return (
    <>
      {variables.map((v, i) => {
        const id = `var-${i}`;
        const value = values[v.name] ?? '';
        if (v.type === 'select' && v.options.length > 0 && v.options.length <= 5) {
          return (
            <fieldset key={v.name} className="field" style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend className="label" style={{ paddingBottom: 6 }}>{v.name}</legend>
              <div className="seg" role="radiogroup" aria-label={v.name}>
                {v.options.map((opt, j) => (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={value === opt}
                    className={value === opt ? 'on' : ''}
                    autoFocus={autoFocus && i === 0 && j === 0}
                    onClick={() => onChange(v.name, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </fieldset>
          );
        }
        return (
          <label key={v.name} className="field" htmlFor={id}>
            <span>{v.name}</span>
            {v.type === 'textarea' ? (
              <textarea
                id={id}
                className="textarea"
                rows={5}
                value={value}
                autoFocus={autoFocus && i === 0}
                onChange={(e) => onChange(v.name, e.target.value)}
              />
            ) : v.type === 'select' ? (
              <select id={id} className="select" value={value} onChange={(e) => onChange(v.name, e.target.value)}>
                {v.options.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                className="input"
                value={value}
                autoFocus={autoFocus && i === 0}
                onChange={(e) => onChange(v.name, e.target.value)}
              />
            )}
          </label>
        );
      })}
      {builtinNames.length > 0 && (
        <div className="field">
          <span>内置变量（已自动填充，可修改）</span>
          {builtinNames.map((name) => (
            <label key={name} className="field" style={{ gap: 4 }}>
              <span className="chip chip-builtin" style={{ alignSelf: 'flex-start' }}>
                {BUILTINS[name]}
              </span>
              {name === '剪贴板' || name === '选中文本' ? (
                <textarea
                  className="textarea"
                  rows={3}
                  value={builtinValues[name] ?? ''}
                  placeholder={name === '剪贴板' ? '无法读取剪贴板时，请在这里粘贴' : '在这里粘贴要处理的文本'}
                  onChange={(e) => onBuiltinChange(name, e.target.value)}
                />
              ) : (
                <input className="input" value={builtinValues[name] ?? ''} onChange={(e) => onBuiltinChange(name, e.target.value)} />
              )}
            </label>
          ))}
        </div>
      )}
    </>
  );
}
