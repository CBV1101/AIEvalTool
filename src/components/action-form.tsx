"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/types";

export function ActionForm({
  action,
  children,
  className = "stack",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      {children}
    </form>
  );
}
