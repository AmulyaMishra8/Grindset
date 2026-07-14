import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginSchema, type LoginInput } from "@grindset/auth-shared";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { AuthLayout } from "../../components/AuthLayout";
import { FormField } from "../../components/FormField";
import { Alert } from "../../components/Alert";
import { SocialButtons } from "../../components/SocialButtons";

// A shared, deliberately public account for people reviewing the project. It is
// a normal user with no special privileges — anything it can reach, any signed-up
// user can reach. Treat everything it does as public.
const DEMO = { email: "demo@grindset.dev", password: "grindset-demo-2026" };

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  // If an OAuth attempt bounced back with ?error=, show a friendly message.
  const oauthError = params.get("error")
    ? "Social login didn't complete. Please try again."
    : "";
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Fill the form with the shared demo account, so someone reviewing the project
  // can get in without inventing an account. It's an ordinary user — this only
  // types into the fields, it doesn't bypass anything.
  function fillDemo() {
    setValue("email", DEMO.email, { shouldValidate: true });
    setValue("password", DEMO.password, { shouldValidate: true });
  }

  async function onSubmit(values: LoginInput) {
    setFormError("");
    try {
      const res = await authApi.login(values);
      if (res.status === "mfaRequired") {
        // Password OK - go finish with the 6-digit code.
        navigate("/mfa", { state: { mfaToken: res.mfaToken } });
        return;
      }
      await refresh();
      navigate("/problems");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back"
      footer={
        <>
          No account? <Link to="/register">Create one</Link>
        </>
      }
      asideTop={
        <div className="auth-demo">
          <p className="auth-demo-head">Just looking around?</p>
          <dl className="auth-demo-creds">
            <dt>Email</dt>
            <dd>{DEMO.email}</dd>
            <dt>Password</dt>
            <dd>{DEMO.password}</dd>
          </dl>
          <button type="button" className="auth-demo-fill" onClick={fillDemo}>
            Fill in the demo account
          </button>
        </div>
      }
    >
      <Alert kind="error">{formError || oauthError}</Alert>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <button className="btn mt-16" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="divider"><span>or</span></div>
      <SocialButtons />
    </AuthLayout>
  );
}
