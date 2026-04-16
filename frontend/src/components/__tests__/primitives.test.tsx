import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Alert } from '../ui/Alert';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { GradientText } from '../ui/GradientText';

describe('Button', () => {
  it('renders children and handles click', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button', { name: /click me/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows loading spinner when isLoading', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders all variants without crash', () => {
    const variants = ['primary', 'secondary', 'outline', 'danger', 'ghost', 'sketch'] as const;
    for (const v of variants) {
      const { unmount } = render(<Button variant={v}>{v}</Button>);
      expect(screen.getByText(v)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('Badge', () => {
  it('renders text content', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders all variants without crash', () => {
    const variants = ['default', 'primary', 'success', 'warning', 'danger', 'outline', 'sketch'] as const;
    for (const v of variants) {
      const { unmount } = render(<Badge variant={v}>{v}</Badge>);
      expect(screen.getByText(v)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('Input', () => {
  it('renders and accepts value', () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(<Input error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('renders with sub-components', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    );
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders all variants without crash', () => {
    const variants = ['flat', 'contained', 'ring', 'whisper', 'sketch'] as const;
    for (const v of variants) {
      const { unmount } = render(<Card variant={v}>{v}</Card>);
      expect(screen.getByText(v)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('Alert', () => {
  it('renders with message', () => {
    render(<Alert variant="info">Info message</Alert>);
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('renders all variants without crash', () => {
    const variants = ['info', 'success', 'warning', 'danger'] as const;
    for (const v of variants) {
      const { unmount } = render(<Alert variant={v}>{v}</Alert>);
      expect(screen.getByText(v)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('EmptyState', () => {
  it('renders illustration + title', () => {
    render(
      <EmptyState
        illustration={<div data-testid="illust">🎨</div>}
        title="Nothing here"
        description="Try again later"
      />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try again later')).toBeInTheDocument();
    expect(screen.getByTestId('illust')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('renders with role=status', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders all variants without crash', () => {
    const variants = ['block', 'text', 'circle'] as const;
    for (const v of variants) {
      const { unmount } = render(<Skeleton variant={v} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('GradientText', () => {
  it('renders children', () => {
    render(<GradientText>Gradient</GradientText>);
    expect(screen.getByText('Gradient')).toBeInTheDocument();
  });
});
