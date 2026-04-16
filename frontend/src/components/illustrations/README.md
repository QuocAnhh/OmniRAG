# Doodle Illustration Kit

Hand-drawn SVG illustrations + sketch primitives for the hybrid Claude-warm × Doodle design language.

## Philosophy

These illustrations add **human warmth** to emotional moments (empty states, onboarding success, errors). They are **NOT** decoration for every UI element — use sparingly.

- Use `currentColor` — parent sets the hue via `text-*` Tailwind class.
- Default stroke tone: `text-primary` (terracotta) or `text-warm-stone` for muted contexts.
- Accent fill is `#fbe1d6` (muted sketch-fill) — soft enough to co-exist with parchment bg.

## When to use

| Component | Illustration |
|-----------|--------------|
| Bot list with 0 bots | `<EmptyBots />` |
| Chat message list with 0 messages | `<EmptyChat />` |
| BotWizard final step after create | `<SuccessCelebration />` |
| 404 catch-all page | `<Error404 />` |
| LandingPage section breaks | `<SquigglyDivider />` |
| Active nav link, link hover | `<WavyUnderline />` |

## When NOT to use

- ❌ Standard UI buttons, form fields, cards — these stay Claude-warm editorial.
- ❌ Data-dense views (DebugPanel, KnowledgeGraph canvas body) — serious/functional only.
- ❌ Error dialogs for destructive actions — use clear iconography, not playful.
- ❌ Loading states — skeleton is the standard, don't replace.

## Accessibility

- Pass `title` prop when illustration carries meaning. Otherwise it's `aria-hidden="true"`.
- Don't rely on illustration alone for critical info — pair with heading + description text.

## Adding new illustrations

1. Follow naming: `{Context}{State}.tsx` (e.g., `EmptyDocuments.tsx`, `OnboardingWelcome.tsx`).
2. Export via `index.ts`.
3. Implement `IllustrationProps` contract (`className`, `title`, `size`).
4. Use `currentColor` for strokes, muted terracotta variants for fills (`#fbe1d6`, `#fce7d6`).
5. ViewBox typically `0 0 200 200` (or `240 200` for wider 404).
6. Hand-drawn feel: slight path imperfections, quadratic curves, organic shapes — not geometric.
7. Avoid teal, blue, green — stay in warm palette.

## Deferred illustrations (add on demand)

- `EmptyDocuments`, `EmptySearch`, `Error500`, `OnboardingWelcome`, `SketchArrow`, `SketchCircle`
