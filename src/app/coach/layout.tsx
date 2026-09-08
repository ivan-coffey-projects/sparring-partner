import type { ReactNode } from "react";
import { requireUser } from "@/auth/session";
import { AppFrame } from "@/components/app-frame";
import { AppHeader } from "@/components/app-header";
import { CoachNav } from "@/components/coach/coach-nav";

export default async function CoachLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser("trainer");
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader user={user} homeHref="/coach" />
      <AppFrame>
        <div className="mb-8">
          <CoachNav />
        </div>
        {children}
      </AppFrame>
    </div>
  );
}
