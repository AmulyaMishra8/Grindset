# FormField Component

A labeled input field with optional error display. Fully compatible with react-hook-form.

## Props

- **label** — string — Label text shown above the input.
- **error** — string — Error message displayed below the input in red.
- All standard HTML input attributes: `type`, `placeholder`, `disabled`, `required`, etc.

## Usage

```jsx
<FormField
  label="Email"
  type="email"
  placeholder="you@example.com"
  error={emailError}
/>

<FormField
  label="Password"
  type="password"
  placeholder="••••••••"
/>
```

## Styling

- Label: `--text-primary`, bold, 13px
- Input: `--bg-primary` background, `--border` border, `--accent` focus ring
- Error: `--hard` (#ff5470) color

Fully styled from `styles.css`; no scoped CSS needed.
