# TopBar Component

Sticky navigation header with logo, nav links, and user avatar.

## Props

- **children** — ReactNode — Additional content (typically navigation link list).

## Usage

```jsx
<TopBar>
  <NavLink to="/problems">Problems</NavLink>
  <NavLink to="/discuss">Discuss</NavLink>
</TopBar>
```

## Styling

- Background: `--bg-secondary` with blur backdrop
- Border: `--border`
- Nav items: `--text-secondary`, hover → `--bg-hover`, active → `--accent-soft`
- Avatar: `--accent-grad` background, white text

Position: sticky top with z-index 10.
