import { redirect } from "next/navigation";
import { hasAnyUsers, setupFirstTrainer } from "@/auth/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { isPasswordlessLoginEnabled } from "@/auth/passwordless";

export const metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyUsers()) redirect("/login");
  const passwordless = isPasswordlessLoginEnabled();
  return (
    <AuthShell
      title="Welcome, coach"
      subtitle={
        passwordless
          ? "Create the first trainer account for this local test."
          : "Create the first trainer account for this deployment."
      }
    >
      <AuthForm
        action={setupFirstTrainer}
        submitLabel="Create trainer account"
        fields={[
          { name: "name", label: "Name", type: "text", autoComplete: "name" },
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          ...(passwordless
            ? []
            : [
                {
                  name: "password",
                  label: "Password",
                  type: "password" as const,
                  autoComplete: "new-password",
                  placeholder: "At least 8 characters",
                },
              ]),
        ]}
      />
    </AuthShell>
  );
}
