import type { PillarCategory } from '@/types/birdBrains';
import { PILLARS } from '@/lib/pillars';

/**
 * A 4-pillar badge in the Aero telemetry face (JetBrains Mono): a colour swatch plus the pillar code
 * (CON, PRC, FAC, TST), and optionally the short pillar name. The codes are the pipeline's own; do not rename them here.
 */
export default function PillarBadge({
  pillar,
  label = false,
  className,
}: {
  pillar: PillarCategory;
  /** Also print the short name, e.g. "CON · Conceptual". */
  label?: boolean;
  className?: string;
}) {
  const p = PILLARS[pillar];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border bg-white px-1.5 py-[3px] font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em] ${className ?? ''}`}
      style={{ color: p.ink, borderColor: `color-mix(in srgb, ${p.color} 45%, #fff)` }}
      title={p.label}
    >
      <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ backgroundColor: p.color }} aria-hidden />
      {pillar}
      {label && <span className="font-medium normal-case tracking-normal">· {p.short}</span>}
    </span>
  );
}
