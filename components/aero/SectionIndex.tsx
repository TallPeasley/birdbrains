/** Monospace section index in the Aero blueprint style, e.g. [QK-01]. Decorative: screen readers skip it. */
export default function SectionIndex({ n, code = 'QK', className }: { n: number | string; code?: string; className?: string }) {
  const id = typeof n === 'number' ? String(n).padStart(2, '0') : n;
  return (
    <span className={`aero-index${className ? ` ${className}` : ''}`} aria-hidden>
      [{code}-{id}]
    </span>
  );
}
