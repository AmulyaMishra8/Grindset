# AuthLayout Component

Centered card wrapper for login, signup, and password-reset screens.

## Props

- **title** — string — Card headline (e.g., "Welcome back").
- **subtitle** — string — Card subheading (e.g., "Sign in to your account").
- **footer** — ReactNode — Footer content (e.g., "No account? Create one").
- **children** — ReactNode — Form fields and buttons.

## Usage

```jsx
<AuthLayout
  title="Welcome back"
  subtitle="Sign in to your account"
  footer={<> No account? <Link to="/register">Create one</Link></>}
>
  <FormField label="Email" type="email" />
  <FormField label="Password" type="password" />
  <button>Sign in</button>
</AuthLayout>
```

## Styling

- Card: `--bg-panel` background, `--border` border, `--shadow` drop shadow
- Title: `--text-primary`, 20px, bold
- Subtitle: `--text-secondary`, 14px
- Footer: centered, border-top divider

Centered on screen with max-width 400px.
