import { redirect } from "next/navigation";
import { hasAnyUsers, login } from "@/auth/actions";
import { getCurrentUser } from "@/auth/session";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { isPasswordlessLoginEnabled } from "@/auth/passwordless";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await hasAnyUsers())) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect(user.role === "trainer" ? "/coach" : "/");
  const passwordless = isPasswordlessLoginEnabled();
  return (
    <AuthShell
      title="Step into the ring"
      subtitle={
        passwordless
          ? "Enter your email to start drilling."
          : "Sign in to start drilling."
      }
    >
      <AuthForm
        action={login}
        submitLabel="Sign in"
        fields={[
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
                  autoComplete: "current-password",
                },
              ]),
        ]}
      />
    </AuthShell>
  );
}
