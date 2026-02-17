'use client';
import { useRef } from 'react';
import styles from './RichTextEditor.module.css';

/**
 * RichTextEditor - A textarea with a formatting toolbar.
 * Supports bold (**), italic (*), bullet (- ), and heading (## ).
 */
export default function RichTextEditor({ value, onChange, placeholder, minRows = 3, className }) {
  const ref = useRef(null);

  const applyFormat = (format) => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value: v } = ta;
    const sel = v.slice(s, e);
    let nv, ns, ne;

    if (format === 'bold') {
      nv = v.slice(0, s) + `**${sel}**` + v.slice(e);
      ns = s + 2; ne = e + 2;
    } else if (format === 'italic') {
      nv = v.slice(0, s) + `*${sel}*` + v.slice(e);
      ns = s + 1; ne = e + 1;
    } else {
      // Line-prefix formats (bullet, heading)
      const lineStart = v.lastIndexOf('\n', s - 1) + 1;
      const prefix = format === 'bullet' ? '- ' : '## ';
      const len = prefix.length;
      if (v.slice(lineStart, lineStart + len) === prefix) {
        nv = v.slice(0, lineStart) + v.slice(lineStart + len);
        ns = Math.max(s - len, lineStart);
        ne = Math.max(e - len, lineStart);
      } else {
        nv = v.slice(0, lineStart) + prefix + v.slice(lineStart);
        ns = s + len; ne = e + len;
      }
    }

    onChange(nv);
    requestAnimationFrame(() => {
      ta.selectionStart = ns;
      ta.selectionEnd = ne;
      ta.focus();
    });
  };

  return (
    <div className={`${styles.editor} ${className || ''}`}>
      <div className={styles.toolbar}>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => applyFormat('bold')} className={styles.toolButton} title="Bold">
          <strong>B</strong>
        </button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => applyFormat('italic')} className={styles.toolButton} title="Italic">
          <em>I</em>
        </button>
        <div className={styles.toolDivider} />
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => applyFormat('heading')} className={styles.toolButton} title="Heading">
          H
        </button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => applyFormat('bullet')} className={styles.toolButton} title="Bullet list">
          •
        </button>
      </div>
      <textarea
        ref={ref}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        className={styles.textarea}
      />
    </div>
  );
}