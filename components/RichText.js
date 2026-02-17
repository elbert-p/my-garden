'use client';
import styles from './RichText.module.css';

/**
 * Parses inline formatting: **bold**, *italic*
 */
function parseInline(text, keyPrefix = '') {
  if (!text) return [text || ''];
  const parts = [];
  let k = 0;

  // Split on bold first
  const boldParts = text.split(/\*\*(.+?)\*\*/g);
  for (let i = 0; i < boldParts.length; i++) {
    if (i % 2 === 1) {
      parts.push(<strong key={`${keyPrefix}b${k++}`}>{boldParts[i]}</strong>);
    } else {
      // Check for italic in non-bold segments
      const italicParts = boldParts[i].split(/\*(.+?)\*/g);
      for (let j = 0; j < italicParts.length; j++) {
        if (j % 2 === 1) {
          parts.push(<em key={`${keyPrefix}i${k++}`}>{italicParts[j]}</em>);
        } else if (italicParts[j]) {
          parts.push(italicParts[j]);
        }
      }
    }
  }
  return parts;
}

/**
 * Parses text with simple formatting into structured blocks:
 * - Line breaks preserved as paragraphs
 * - `## text` → heading
 * - `- text` or `• text` → bullet list
 * - `**bold**` and `*italic*` inline
 */
function parseBlocks(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const blocks = [];
  let currentList = [];
  let currentPara = [];

  const flushPara = () => {
    if (currentPara.length > 0) {
      blocks.push({ type: 'paragraph', lines: [...currentPara] });
      currentPara = [];
    }
  };
  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push({ type: 'list', items: [...currentList] });
      currentList = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushPara(); flushList();
      blocks.push({ type: 'heading', text: line.slice(3) });
    } else if (/^[-•] /.test(line)) {
      flushPara();
      currentList.push(line.slice(2));
    } else if (line.trim() === '') {
      flushPara(); flushList();
    } else {
      flushList();
      currentPara.push(line);
    }
  }
  flushPara(); flushList();
  return blocks;
}

/**
 * RichText - Renders formatted text from simple markdown-like syntax.
 * Supports **bold**, *italic*, ## headings, - bullet lists, and line breaks.
 */
export default function RichText({ content, className }) {
  if (!content) return null;
  const blocks = parseBlocks(content);

  return (
    <div className={`${styles.richText} ${className || ''}`}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return <h3 key={i} className={styles.heading}>{parseInline(block.text, `h${i}`)}</h3>;
          case 'list':
            return (
              <ul key={i} className={styles.list}>
                {block.items.map((item, j) => (
                  <li key={j}>{parseInline(item, `l${i}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'paragraph':
            return (
              <p key={i} className={styles.paragraph}>
                {block.lines.map((line, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    {parseInline(line, `p${i}-${j}`)}
                  </span>
                ))}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}