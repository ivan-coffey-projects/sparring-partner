import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-6 pt-3 md:px-4 md:pb-8 md:pt-4">
      <div
        className={cn(
          "min-h-[calc(100dvh-5.75rem)] rounded-[28px] border border-foreground/25 bg-card px-4 py-6 text-card-foreground md:px-8 md:py-8",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
