import { InputHTMLAttributes, ReactNode } from "react";

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  children?: ReactNode;
}

export function FormField(props: FormFieldProps): JSX.Element;
