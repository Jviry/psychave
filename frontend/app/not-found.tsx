import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment px-6 py-16">
      <div className="max-w-md w-full text-center space-y-6 rounded-xl border border-mist bg-surface-raised p-8 shadow-subtle">
        <p className="text-xs font-semibold uppercase tracking-widest text-sage">
          404 · Page Not Found
        </p>
        <h1 className="font-heading text-3xl font-medium text-pine">
          We couldn&apos;t find that page
        </h1>
        <p className="text-sm text-pine/75 leading-relaxed">
          The page you are looking for may have moved or no longer exists.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-pine px-5 py-2.5 text-sm font-medium text-parchment hover:bg-pine/90 transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
