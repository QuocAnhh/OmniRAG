import { Link } from 'react-router-dom';
import { Error404 } from '../components/illustrations';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-warm-parchment flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-6">
          <Error404 size="lg" />
        </div>
        <h1 className="text-3xl font-bold font-serif text-text-primary tracking-tight mb-3">
          Page not found
        </h1>
        <p className="text-text-tertiary text-base leading-relaxed mb-8">
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="px-6 py-3 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-comfort transition-all shadow-ring-primary flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Go home
          </Link>
          <Link
            to="/bots"
            className="px-6 py-3 bg-warm-cream hover:bg-warm-sand border border-border-warm text-warm-olive hover:text-text-primary text-sm font-medium rounded-comfort transition-all"
          >
            View agents
          </Link>
        </div>
      </div>
    </div>
  );
}
