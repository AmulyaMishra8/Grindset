import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { registerSchema, type RegisterInput } from "@grindset/auth-shared";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { AuthLayout } from "../../components/AuthLayout";
import { FormField } from "../../components/FormField";
import { Alert } from "../../components/Alert";

export function RegisterPage() {
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setFormError("");
    try {
      await authApi.register(values);
      setDone(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (done) {
    return (
      <AuthLayout title="Account created" footer={<Link to="/login">Go to sign in</Link>}>
        <Alert kind="success">
          Your account is ready. You can sign in now.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Start by entering your details"
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <Alert kind="error">{formError}</Alert>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Name" error={errors.displayName?.message} {...register("displayName")} />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <button className="btn mt-16" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
