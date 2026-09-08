import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { invites } from "@/db/schema";
import { joinWithInvite } from "@/auth/actions";
import { isExpired } from "@/lib/freshness";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = { title: "Join" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.usedByUserId)))
    .get();
  const valid = invite !== undefined && !isExpired(invite.expiresAt);

  if (!valid) {
    return (
      <AuthShell
        title="Invite not valid"
        subtitle="This invite link has expired or was already used."
      >
        <p className="text-center text-sm text-muted-foreground">
          Ask your trainer for a fresh link.
        </p>
      </AuthShell>
    );
  }

  const joinAction = joinWithInvite.bind(null, token);
  return (
    <AuthShell
      title={invite.role === "trainer" ? "Join as a trainer" : "Join the gym"}
      subtitle="Create your account to start taking calls."
    >
      <AuthForm
        action={joinAction}
        submitLabel="Create account"
        fields={[
          { name: "name", label: "Name", type: "text", autoComplete: "name" },
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "new-password",
            placeholder: "At least 8 characters",
          },
        ]}
      />
    </AuthShell>
  );
}
