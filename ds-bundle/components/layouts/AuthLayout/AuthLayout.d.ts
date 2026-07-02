import { ReactNode } from "react";

export interface AuthLayoutProps {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  children?: ReactNode;
}

export function AuthLayout(props: AuthLayoutProps): JSX.Element;
