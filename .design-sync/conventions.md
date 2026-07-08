# Grindset Design System — Component Conventions

## The Styling Idiom: CSS Custom Properties

Every component in this design system uses **CSS custom properties** (CSS variables) for styling. The root tokens live in `apps/web/src/index.css` under `:root` and are inherited by every child component.

### Token Categories

**Surfaces (backgrounds, panels, borders):**
```css
--bg-primary: #0b0b12        /* Main background */
--bg-secondary: #13131f      /* Elevated background */
--bg-panel: #111118          /* Card/panel background */
--bg-hover: #1a1a2e          /* Hover state */
--bg-active: #1f1f35         /* Active/selected state */
--border: #24243d            /* Standard borders */
--border-light: #3a3a5c      /* Subtle borders */
```

**Text (foreground colors):**
```css
--text-primary: #eceefb      /* Main text */
--text-secondary: #8a93d2    /* Secondary/dimmed text */
--text-muted: #565d8f        /* Muted/help text */
```

**Brand & Accent:**
```css
--accent: #7c4dff            /* Primary purple */
--accent-hover: #9c6fff      /* Hover variant */
--accent-soft: rgba(124, 77, 255, 0.12)  /* 12% opacity for backgrounds */
--accent-glow: rgba(124, 77, 255, 0.35)  /* Glow effects */
--accent-grad: linear-gradient(135deg, #8b5cff 0%, #6a3dff 100%)  /* Gradient */
```

**Status (semantic colors):**
```css
--easy: #1fe0a4      /* Success/easy (teal) */
--medium: #ffa94d    /* Warning/medium (orange) */
--hard: #ff5470      /* Danger/hard (red) */
--green: #00c896     /* Primary green accent */
```

**Scale & Spacing:**
```css
--radius-sm: 7px     /* Small border radius */
--radius: 11px       /* Default border radius */
--radius-lg: 16px    /* Large border radius */
```

**Shadows:**
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3)
--shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.55)
--shadow-glow: 0 0 0 1px var(--accent-soft), 0 10px 30px -12px var(--accent-glow)
```

**Animation (easing & timing):**
```css
--ease: cubic-bezier(0.22, 1, 0.36, 1)   /* Custom ease curve */
--t-fast: 0.13s var(--ease)              /* Quick transitions */
--t: 0.22s var(--ease)                   /* Standard transitions */
```

**Typography:**
```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
--font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace
```

## How to Use These Tokens

**In component CSS**, reference them as `var(--token-name)`:

```css
.button {
  background: var(--accent-grad);
  color: white;
  padding: 12px 24px;
  border-radius: var(--radius);
  border: none;
  font-family: var(--font-sans);
  font-weight: 600;
  transition: box-shadow var(--t-fast);
}

.button:hover {
  box-shadow: var(--shadow-glow);
}

.card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow);
}

.error-text {
  color: var(--hard);
  font-size: 13px;
}

.input {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
}
```

## No Wrapping Required

Components in this design system are **self-contained**. They do not require a provider wrapper or theme context — tokens are globally inherited via CSS. Build them standalone, compose them in any layout.

## Component Styling Checklist

When building with these components, verify:

1. **Tokens used, not hardcoded colors** — cross-check component CSS against the token list above. No `color: #fff` or `background: #333`; always `var(--token)`.
2. **Spacing follows the scale** — use multiples of 4px (`--radius` + padding, gaps) or tokens like `--shadow` for consistent rhythm.
3. **Hover & active states** — use `--accent-hover`, `--bg-hover`, `--bg-active` for interactive states.
4. **Dark palette throughline** — backgrounds are the `--bg-*` family, text is `--text-*`, accents are `--accent-*` or status colors. No light backgrounds or bright white text.

## Example: Building a Button

```jsx
// Button.tsx
export function Button({ children, variant = "primary", ...props }) {
  return (
    <button className={`btn btn-${variant}`} {...props}>
      {children}
    </button>
  );
}
```

```css
/* Button.css */
.btn {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  border: none;
  transition: background var(--t-fast), box-shadow var(--t-fast);
  cursor: pointer;
}

.btn-primary {
  background: var(--accent-grad);
  color: white;
}

.btn-primary:hover {
  box-shadow: var(--shadow-glow);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.btn-ghost:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
```

Every design the agent builds with these components will inherit this dark, purple-accented aesthetic — and the tokens ensure consistency across all screens.
