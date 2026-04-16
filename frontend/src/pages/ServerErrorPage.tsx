import { Link } from 'react-router-dom';

export default function ServerErrorPage() {
  return (
    <div className="min-h-screen bg-warm-parchment flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="size-40 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[64px] text-rose-500/60">cloud_off</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold font-serif text-text-primary tracking-tight mb-3">
          Server error
        </h1>
        <p className="text-text-tertiary text-base leading-relaxed mb-8">
          Something went wrong on our end. Please try again in a moment.
          If the problem persists, contact support.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-comfort transition-all shadow-ring-primary flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Retry
          </button>
          <Link
            to="/"
            className="px-6 py-3 bg-warm-cream hover:bg-warm-sand border border-border-warm text-warm-olive hover:text-text-primary text-sm font-medium rounded-comfort transition-all"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
