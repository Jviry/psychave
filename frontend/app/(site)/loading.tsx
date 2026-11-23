export default function SiteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="py-16 flex flex-col items-center justify-center gap-3 text-pine/70"
    >
      <div className="h-8 w-8 rounded-full border-2 border-sage border-t-transparent animate-spin" />
      <p className="text-sm font-medium">Loading…</p>
    </div>
  );
}
