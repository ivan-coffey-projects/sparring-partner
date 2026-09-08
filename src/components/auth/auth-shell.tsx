import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-8 text-[19px] tracking-[-0.065em] text-foreground">
          SPARRING<span className="text-glow">®</span>
        </p>
        <p className="label-micro text-foreground/55">Trainer-authored live drills</p>
        <h1 className="mt-3 max-w-[16ch] text-[clamp(40px,8vw,72px)] font-normal leading-[0.92] tracking-[-0.07em] text-foreground">
          {title}
        </h1>
        <p className="mt-4 max-w-md text-base text-foreground/75">{subtitle}</p>
        <div className="mt-8 rounded-[24px] border border-foreground/20 bg-card p-6 text-card-foreground">
          {children}
        </div>
        <p className="mt-6 max-w-md text-xs leading-relaxed text-foreground/45">
          Self-hosted training only. This deployment never contacts real leads,
          live inboxes, or a CRM.
        </p>
      </div>
    </main>
  );
}
