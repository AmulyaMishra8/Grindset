# Grindset Design System

A dark-themed, purple-accented design system for building cohesive web interfaces. Every component inherits from a unified token palette defined in CSS custom properties.

## Quick Start

All components use the same tokens. Build anything with these 5 primitives:

### Primitives

- **Alert** — Success/error/warning notification banners
- **FormField** — Labeled inputs with validation errors
- **VoteControl** — Up/down voting widget (Reddit style)

### Layouts

- **TopBar** — Sticky navigation header with logo and nav links
- **AuthLayout** — Centered card for login/signup screens

## Token System

The entire design system is built on **39 CSS custom properties** defined once in `:root`. Every component references tokens, never hardcoded colors.

### Core Tokens

**Colors:**
- Backgrounds: `--bg-primary`, `--bg-secondary`, `--bg-panel`, `--bg-hover`, `--bg-active`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`
- Accent: `--accent`, `--accent-hover`, `--accent-soft`, `--accent-glow`, `--accent-grad`
- Status: `--easy` (green), `--medium` (orange), `--hard` (red)

**Scale:**
- Radius: `--radius-sm` (7px), `--radius` (11px), `--radius-lg` (16px)
- Shadows: `--shadow-sm`, `--shadow`, `--shadow-glow`
- Animation: `--t-fast` (0.13s), `--t` (0.22s)

**Typography:**
- `--font-sans` — Inter with fallbacks
- `--font-mono` — JetBrains Mono with fallbacks

## How It Works

1. **Import styles.css** — brings in tokens + fonts + component CSS
2. **Use components** — they automatically inherit all tokens
3. **Change a token value** — all components update everywhere

Example:
```jsx
import { Alert, FormField, TopBar } from '@grindset/design';
import '@grindset/design/styles.css';

export function App() {
  return (
    <div>
      <TopBar />
      <Alert kind="success">Welcome</Alert>
      <FormField label="Email" type="email" />
    </div>
  );
}
```

## Design Principles

- **Dark-first:** All components assume dark backgrounds; text is light
- **Token-driven:** No hardcoded colors; everything is a token
- **Self-contained:** Components work standalone; no provider wrapper needed
- **Accessible:** Sufficient contrast, keyboard support, semantic HTML

## Building with These Components

The design agent uses these components to build new interfaces. Because all styling goes through the same token system, every design is on-brand and consistent.

For extending this system, add new component folders under `components/group-name/ComponentName/`, following the pattern:
- `ComponentName.html` — preview with `<!-- @dsCard -->` marker
- `ComponentName.d.ts` — TypeScript interface
- `ComponentName.prompt.md` — usage documentation
