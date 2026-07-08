# Alert Component

A dismissible notification banner for success, error, and warning messages.

## Props

- **kind** — `"error" | "success" | "warning"` — Sets the alert color and icon. Defaults to `"error"`.
- **children** — React node — The message text.

## Usage

```jsx
<Alert kind="success">
  Your changes have been saved.
</Alert>

<Alert kind="error">
  Something went wrong. Please try again.
</Alert>
```

## Styling

Uses tokens from the design system:
- Error: `--hard` (#ff5470)
- Success: `--easy` (#1fe0a4)
- Background: `--bg-primary` with transparency

Inherits from `styles.css` and requires Google Fonts (Inter).
