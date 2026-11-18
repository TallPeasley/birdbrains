import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-12">
      <div className="card max-w-xl p-8">
        <span className="aero-badge aero-badge--accent">HTTP 404 · NOT FOUND</span>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">
          This page isn&rsquo;t on the <em className="font-serif font-normal text-brand">grid.</em>
        </h1>
        <p className="mt-3 text-slate-600">
          The page you requested doesn&rsquo;t exist or has moved. Return to the BirdBrains home page or open a dashboard.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="aero-btn aero-btn--primary">
            Back to Home
          </Link>
          <Link href="/plans" className="aero-btn">
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
