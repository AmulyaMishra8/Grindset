import { ReactNode } from "react";

export interface AlertProps {
  kind?: "error" | "success" | "warning";
  children: ReactNode;
}

export function Alert(props: AlertProps): JSX.Element;
