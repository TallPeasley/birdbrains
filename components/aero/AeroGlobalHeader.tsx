'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import AeroLogo from '@/components/aero/AeroLogo';
import { aeroBrand, aeroSwitcher, type AeroBrandKey } from '@/lib/aero/brands';
import { AERO_URLS, BRAND_STAGE } from '@/lib/aero/stage';

export interface AeroGlobalHeaderProps {
  /** Which Aero pillar this app is. */
  brand: AeroBrandKey;
  /** Where the brand lockup links to. */
  home?: string;
  /** Monospace coordinate badge at the far right, e.g. "BB-01 / STUDENT". */
  coord?: string;
  /** The app's own primary links (rendered in the nav region). */
  nav?: React.ReactNode;
  /** The app's own controls (rendered in the actions region). */
  children?: React.ReactNode;
  /** On small screens, drop nav and actions to a second row. */
  stack?: boolean;
}

/**
 * The Aero shell header shared by Ascent, BirdBrains and Chirp:
 *   [ecosystem switcher pill] | [logo + brand name + "by Aero"] | nav … actions | [coordinate]
 * The markup and class names match aero-kit/src/aero-shell.js (used by the plain-HTML apps), so all three
 * render from the same stylesheet (app/aero.css).
 */
export default function AeroGlobalHeader({ brand, home = '/', coord, nav, children, stack }: AeroGlobalHeaderProps) {
  const me = aeroBrand(brand, BRAND_STAGE);
  const items = aeroSwitcher(brand, BRAND_STAGE, AERO_URLS);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const links = Array.from(box.current?.querySelectorAll<HTMLAnchorElement>('.aero-switcher__item') ?? []);
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === 'Escape' && open) {
      setOpen(false);
      pill.current?.focus();
    } else if (e.key === 'ArrowDown' && links.length) {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        requestAnimationFrame(() => box.current?.querySelector<HTMLAnchorElement>('.aero-switcher__item')?.focus());
      } else {
        links[(at + 1) % links.length].focus();
      }
    } else if (e.key === 'ArrowUp' && open && links.length) {
      e.preventDefault();
      links[(at - 1 + links.length) % links.length].focus();
    }
  };

  return (
    <header className={`aero-header no-print${stack ? ' aero-header--stack' : ''}`}>
      <div className="aero-header__bar">
        <div
          className="aero-switcher"
          ref={box}
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
          }}
        >
          <button
            ref={pill}
            type="button"
            className="aero-switcher__pill"
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label="Aero ecosystem: switch app"
            onClick={() => setOpen((v) => !v)}
          >
            <AeroLogo brand="aero" />
            <span className="aero-switcher__label">Aero</span>
            <svg className="aero-switcher__chev" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="aero-switcher__menu" id={menuId} hidden={!open}>
            <p className="aero-switcher__head">
              <span>Aero ecosystem</span>
              <span>SYS-00</span>
            </p>
            {items.map((i) => (
              <a
                key={i.key}
                className="aero-switcher__item"
                href={i.current ? home : i.href}
                data-aero-brand={i.paletteKey}
                aria-current={i.current ? 'true' : undefined}
              >
                <AeroLogo brand={i.key} />
                <span>
                  <span className="aero-switcher__name">{i.name}</span>
                  <span className="aero-switcher__role">{i.role}</span>
                </span>
                <span className="aero-switcher__meta">
                  {i.current && <span className="aero-switcher__here">Here</span>}
                  <span>{i.domain}</span>
                </span>
              </a>
            ))}
            <p className="aero-switcher__foot">
              <AeroLogo brand="aero" />
              <span>One system, three tools.</span>
            </p>
          </div>
        </div>

        <Link href={home} className="aero-lockup" aria-label={`${me.name} by Aero, home`}>
          <AeroLogo brand={brand} />
          <span className="aero-lockup__name">{me.name}</span>
          <span className="aero-lockup__by">by Aero</span>
        </Link>

        {nav && (
          <nav className="aero-header__nav" aria-label="Primary">
            {nav}
          </nav>
        )}
        {children && <div className="aero-header__actions">{children}</div>}
        {coord && (
          <span className="aero-header__coord" aria-hidden>
            {coord}
          </span>
        )}
      </div>
    </header>
  );
}
