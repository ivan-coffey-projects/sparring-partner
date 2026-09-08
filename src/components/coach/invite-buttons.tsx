"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createInviteAction } from "@/app/coach/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteButtons() {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function mint(role: "rep" | "trainer") {
    startTransition(async () => {
      const { token } = await createInviteAction(role);
      const inviteUrl = `${window.location.origin}/join/${token}`;
      setUrl(inviteUrl);
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Invite link copied to clipboard");
      } catch {
        toast("Invite link ready — copy it below");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => mint("rep")}
        >
          New rep invite
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => mint("trainer")}
        >
          New trainer invite
        </Button>
      </div>
      {url ? (
        <Input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="max-w-xl font-mono text-xs"
        />
      ) : null}
    </div>
  );
}
