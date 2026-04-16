import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyBots } from '../illustrations/EmptyBots';
import { EmptyChat } from '../illustrations/EmptyChat';
import { SuccessCelebration } from '../illustrations/SuccessCelebration';
import { Error404 } from '../illustrations/Error404';
import { SquigglyDivider } from '../illustrations/primitives/SquigglyDivider';
import { ErrorBoundary } from '../ErrorBoundary';

describe('EmptyBots', () => {
  it('renders SVG', () => {
    render(<EmptyBots />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with size prop', () => {
    const { container } = render(<EmptyBots size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('EmptyChat', () => {
  it('renders SVG', () => {
    render(<EmptyChat />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});

describe('SuccessCelebration', () => {
  it('renders SVG', () => {
    render(<SuccessCelebration />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});

describe('Error404', () => {
  it('renders SVG with title text', () => {
    render(<Error404 title="Not found" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});

describe('SquigglyDivider', () => {
  it('renders SVG', () => {
    render(<SquigglyDivider />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders fallback UI on error', () => {
    const Throw = () => { throw new Error('boom'); };
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Throw />
      </ErrorBoundary>
    );
    expect(screen.getByText(/có gì đó không ổn/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
