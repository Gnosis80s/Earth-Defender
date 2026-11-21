/** Small building blocks for the 16-bit arcade UI (styles live in index.css). */
import React from 'react';
import { PixelTextOptions, usePixelText } from './pixelText';

type FrameTone = 'default' | 'cyan' | 'amber' | 'red' | 'green' | 'dim';
const toneClass = (tone: FrameTone) => (tone === 'default' ? '' : `px-frame--${tone}`);

/** Bevelled panel with stepped pixel corners. */
export function Frame({ tone = 'default', className = '', children, style }: {
  tone?: FrameTone; className?: string; children?: React.ReactNode; style?: React.CSSProperties;
}) {
  return <div className={`px-frame ${toneClass(tone)} ${className}`} style={style}>{children}</div>;
}

/** Framed pixel button. `selected` shows a ▶ cursor, like an arcade menu. */
export function PxButton({ tone = 'default', selected = false, disabled = false, className = '', onClick, title, children }: {
  /** Declared so lists type-check (the project has no @types/react JSX key typing). */
  key?: string | number;
  tone?: FrameTone; selected?: boolean; disabled?: boolean; className?: string;
  onClick?: () => void; title?: string; children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-disabled={disabled}
      aria-pressed={selected}
      onClick={disabled ? undefined : onClick}
      className={`px-frame px-btn ${toneClass(selected ? (tone === 'default' ? 'cyan' : tone) : disabled ? 'dim' : tone)} font-pixel relative ${className}`}
    >
      {selected && <span className="absolute left-[6px] top-1/2 -translate-y-1/2 text-[8px] text-white px-blink">▶</span>}
      {children}
    </button>
  );
}

/**
 * Arcade lettering as a crisp scaled image. `height` is a CSS length for the
 * rendered glyph block; falls back to plain pixel-font text until ready.
 */
export function PixelWord({ text, height, className = '', ...opts }: PixelTextOptions & {
  text: string; height: string; className?: string;
}) {
  const url = usePixelText(text, opts);
  if (!url) {
    return <span className={`font-pixel text-white ${className}`} style={{ fontSize: height, lineHeight: 1 }}>{text}</span>;
  }
  return <img src={url} alt={text} draggable={false} className={`px-img select-none ${className}`} style={{ height }} />;
}
