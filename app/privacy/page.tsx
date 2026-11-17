import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy · BirdBrains',
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-indigo-700">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <span className="eyebrow text-indigo-700">Legal &amp; Privacy</span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to home
        </Link>
      </div>

      <div className="card space-y-6 p-6 text-sm leading-relaxed text-slate-700 sm:p-8">
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            BirdBrains Privacy Policy
          </h1>
          <p className="mt-2 text-slate-600">
            BirdBrains looks at photos of a student&apos;s math work and explains where the mistakes came from. This page explains what we collect, why, where it is kept in Canada, and how to delete it.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">The short version</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>We collect as little as we can: an account, photos of math work, and the diagnostics we produce from them.</li>
            <li>Names, dates, classes, and other personal details written on a photo are blurred before the photo is saved or analysed.</li>
            <li>Photos, results, and analysis are stored and processed in Canada (Montréal, <code className="text-xs">northamerica-northeast1</code>).</li>
            <li>Photos are deleted automatically after 90 days.</li>
            <li>We do not sell personal information, show ads, or build advertising profiles.</li>
            <li>You can delete an account and everything in it at any time from <Link href="/account" className="font-semibold text-indigo-600 underline">Account settings</Link>.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">What we collect</h2>
          <p>
            <strong>Account details:</strong> Email address, display name, role (student, parent, or teacher), and for students their course or grade. Parents and students connect using a link code.
          </p>
          <p>
            <strong>Photos of math work:</strong> Before any photo is stored, location and device metadata inside the image file are removed, header fields (name, date, class, period, teacher, student number) are blurred, and other detected names, emails, or phone numbers are redacted. Please do not write personal details in the working area of the page.
          </p>
          <p>
            <strong>Mood and effort signals (Pro plan only):</strong> On Pro, BirdBrains estimates how a piece of work felt (such as confident, struggling, or frustrated) from visible signs on the page like cross-outs so feedback can be gentler. On the Free plan this is not shown and not stored.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Artificial intelligence &amp; Canadian residency</h2>
          <p>
            Analysis runs on Google Cloud Vertex AI (Gemini) in Montréal, Canada. Photos reach the model only after personal-detail blurring and are labelled with a random student code, never a name. Under Google Cloud&apos;s terms, Google does not use this data to train its models.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">How long we keep it &amp; your rights</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Photos:</strong> Deleted automatically 90 days after upload.</li>
            <li><strong>Results, progress, and worksheets:</strong> Kept while the account exists so longitudinal progress can be shown.</li>
            <li><strong>Delete anytime:</strong> &ldquo;Delete my data&rdquo; in Settings permanently removes a student&apos;s photos, results, progress, worksheets, and account. A linked parent can also do this for their child.</li>
            <li><strong>Children and students:</strong> BirdBrains is for grades 3 to 12. Students under 13 may use it only when a parent or guardian creates or approves the account and agrees to this policy on their behalf.</li>
          </ul>
        </section>

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          See also our <Link href="/terms" className="font-semibold text-indigo-600 underline">Terms of Use</Link>.
        </footer>
      </div>
    </article>
  );
}
