import AeroLogo from '@/components/aero/AeroLogo';
import { aeroBrand, aeroSwitcher } from '@/lib/aero/brands';
import { AERO_URLS, BRAND_STAGE } from '@/lib/aero/stage';

/** Ecosystem strip at the foot of every Aero app. */
export default function AeroFooter() {
  const others = aeroSwitcher('birdbrains', BRAND_STAGE, AERO_URLS).filter((i) => !i.current);
  const aeroUrl = AERO_URLS.aero || aeroBrand('aero', BRAND_STAGE).url || '/';
  return (
    <footer className="no-print mx-auto max-w-7xl border-t border-line px-4 pb-28 pt-5 sm:px-6 lg:px-8">
      <div className="aero-foot">
        <AeroLogo brand="aero" />
        <span>BirdBrains by Aero</span>
        <span className="aero-foot__sep" aria-hidden>
          /
        </span>
        <a href={aeroUrl}>Aero overview</a>
        <span className="aero-foot__sep" aria-hidden>
          /
        </span>
        <span>Also from Aero:</span>
        {others.map((o) => (
          <a key={o.key} href={o.href}>
            {o.name}
          </a>
        ))}
        <span className="aero-coord ml-auto" aria-hidden>
          SYS-00 · AERO.SUITE
        </span>
      </div>
    </footer>
  );
}
