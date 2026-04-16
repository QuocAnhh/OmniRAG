# Frontend Token Migration Cheatsheet

Mapping từ inline `[#hex]` → semantic Tailwind classes. Dùng khi refactor page/component.

## Nguyên tắc

1. **Không dùng** `bg-[#XXXXXX]`, `text-[#XXXXXX]`, `border-[#XXXXXX]` trong JSX.
2. **Không dùng** inline `style={{ background: '#...' }}` trừ dynamic value không thể biết trước compile-time.
3. Khi cần JS runtime value (vd: chart color, SVG stroke), import từ `src/lib/design-tokens.ts`.

## Color mapping

### Backgrounds (bg-*)
| Hex | Token | Role |
|-----|-------|------|
| `#f5f4ed` | `bg-background` hoặc `bg-warm-parchment` | Page canvas |
| `#faf9f5` | `bg-card` hoặc `bg-warm-ivory` | Card, elevated surface |
| `#e8e6dc` | `bg-secondary` hoặc `bg-warm-sand` | Button secondary, chip |
| `#f0eee6` | `bg-muted` hoặc `bg-warm-cream` | Subtle background, accent |
| `#ffffff` | `bg-popover` hoặc `bg-white` | Popover, dropdown |
| `#30302e` | `bg-warm-dark` | Dark surface container |
| `#141413` | `bg-foreground` hoặc `bg-warm-near-black` | Dark theme bg |
| `#c96442` | `bg-primary` hoặc `bg-brand-terracotta` | Primary CTA |
| `#d97757` | `bg-terracotta-light` hoặc `bg-brand-coral` | Primary hover |
| `#b53333` | `bg-destructive` hoặc `bg-brand-crimson` | Error |

### Text (text-*)
| Hex | Token | Role |
|-----|-------|------|
| `#141413` | `text-foreground` hoặc `text-text-primary` | Primary body |
| `#4d4c48` | `text-warm-charcoal` | Button text on light |
| `#5e5d59` | `text-text-secondary` hoặc `text-warm-olive` | Secondary body |
| `#87867f` | `text-muted-foreground` hoặc `text-text-tertiary` | Meta, hints |
| `#3d3d3a` | `text-[#3d3d3a]` — KHÔNG có token, giữ nếu rare | Dark warm variant |
| `#b0aea5` | `text-warm-silver` hoặc `text-text-muted` | Text on dark bg |
| `#faf9f5` | `text-text-inverse` hoặc `text-warm-ivory` | Text on dark surface |
| `#c96442` | `text-primary` hoặc `text-text-link` | Link, brand text |

### Borders (border-*)
| Hex | Token | Role |
|-----|-------|------|
| `#f0eee6` | `border-border-subtle` | Softest container |
| `#e8e6dc` | `border-border` hoặc `border-border-warm` | Standard |
| `#30302e` | `border-border-dark` | Dark surface |
| `#3898ec` | `border-border-focus` | Focus ring (cool, intentional) |
| `#c96442` | `border-primary` | Brand accent |

### Sketch accents (Doodle layer)
| Use | Token |
|-----|-------|
| SVG illustration stroke | `text-sketch-stroke` (dùng `currentColor` trong SVG) |
| Illustration fill | `fill-sketch-fill` hoặc `bg-sketch-fill` |
| Highlight / spotlight | `text-sketch-highlight` |

## Shadow mapping

| Visual | Old inline | New |
|--------|-----------|-----|
| Border-like ring | `shadow-[0px_0px_0px_1px_#e8e6dc]` | `shadow-ring` |
| Subtle ring | `shadow-[0px_0px_0px_1px_#f0eee6]` | `shadow-ring-subtle` |
| Hover ring | `shadow-[0px_0px_0px_1px_#d1cfc5]` | `shadow-ring-hover` |
| Active ring | `shadow-[0px_0px_0px_1px_#c2c0b6]` | `shadow-ring-active` |
| Primary ring | `shadow-[0px_0px_0px_1px_#c96442]` | `shadow-ring-primary` |
| Small floating | `shadow-[0px_2px_8px_rgba(0,0,0,0.04)]` | `shadow-whisper-sm` |
| Standard floating | `shadow-[rgba(0,0,0,0.05)_0px_4px_24px]` | `shadow-whisper` |
| Large floating | `shadow-[0px_8px_32px_rgba(0,0,0,0.06)]` | `shadow-whisper-lg` |

## Radius mapping

| Value | Token | Role |
|-------|-------|------|
| 4px | `rounded-sharp` | Minimal inline, chip edges |
| 6px | `rounded-subtle` | Small button, secondary |
| 8px | `rounded-comfort` hoặc `rounded-lg` | Standard button, card |
| 12px | `rounded-generous` | Primary button, input |
| 16px | `rounded-feature` | Featured container |
| 24px | `rounded-tag` | Highlighted tag |
| 32px | `rounded-hero` | Hero container, embed media |

## Khi nào KHÔNG refactor

- SVG `fill="#..."` / `stroke="#..."` khi là constant inline value không share palette — OK giữ nguyên.
- Third-party library style props (react-sigma node color, react-pdf render) không support Tailwind — import từ `design-tokens.ts`.
- Framer Motion `animate={{ backgroundColor: '#...' }}` — dùng token import.

## Workflow khi refactor file

1. `grep "\[#" FILE` list tất cả inline hex.
2. Map mỗi hex → token theo bảng trên.
3. Test visual thẳng trong dev server.
4. Commit theo scope nhỏ (1 component / page / commit).
