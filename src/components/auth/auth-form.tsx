"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthFormState } from "@/auth/actions";

interface FieldSpec {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
}

interface AuthFormProps {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: FieldSpec[];
  submitLabel: string;
}

const INITIAL_STATE: AuthFormState = { error: null };

export function AuthForm({ action, fields, submitLabel }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-1.5">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type={field.type}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            required
          />
        </div>
      ))}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "…" : submitLabel}
      </Button>
    </form>
  );
}
