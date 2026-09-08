import Link from "next/link";
import { logout } from "@/auth/actions";
import type { SessionUser } from "@/auth/session";
import { Button } from "@/components/ui/button";

export function AppHeader({
  user,
  homeHref,
}: {
  user: SessionUser;
  homeHref: string;
}) {
  return (
    <header className="border-b border-foreground/15 bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={homeHref} className="flex items-baseline gap-0.5">
          <span className="text-[19px] font-normal tracking-[-0.065em] text-foreground">
            SPARRING
          </span>
          <span className="text-[10px] text-glow">®</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/review"
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/70 transition-colors hover:text-foreground"
          >
            Reviews
          </Link>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/70 sm:inline">
            {user.name}
          </span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
