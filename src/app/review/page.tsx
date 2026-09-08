import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/auth/session";
import { db } from "@/db/client";
import { reviews } from "@/db/schema";
import { AppFrame } from "@/components/app-frame";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { channelLabel } from "@/lib/labels";

export const metadata = { title: "Reviews" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function ReviewListPage() {
  const user = await requireUser();
  const homeHref = user.role === "trainer" ? "/coach" : "/";

  const rows = db
    .select()
    .from(reviews)
    .where(eq(reviews.userId, user.id))
    .orderBy(desc(reviews.createdAt))
    .limit(50)
    .all();

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader user={user} homeHref={homeHref} />
      <AppFrame className="mx-auto max-w-3xl space-y-8">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-micro text-muted-foreground">The tape room</p>
            <h1 className="mt-2 text-3xl font-normal tracking-display">
              Review real work
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Paste a real call transcript, email thread, text exchange, or DM
              conversation. The grader scores it against a playbook — and every
              point it makes must quote your artifact verbatim, or it&apos;s
              thrown out.
            </p>
          </div>
          <Button asChild>
            <Link href="/review/new">New review</Link>
          </Button>
        </section>

        <section>
          {rows.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nothing reviewed yet. Paste your first real conversation and
                see where the needle actually moves.
              </CardContent>
            </Card>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-[22px] border bg-background">
              {rows.map((review) => (
                <Link
                  key={review.id}
                  href={`/review/${review.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-foreground/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {review.title}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-foreground/50">
                      {new Date(review.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">
                      {channelLabel(review.channel)}
                    </Badge>
                    {review.status === "ready" &&
                    review.overallScore !== null ? (
                      <Badge variant="outline">
                        {review.overallScore.toFixed(1)}/5
                      </Badge>
                    ) : (
                      <Badge
                        variant={
                          review.status === "failed" ? "destructive" : "outline"
                        }
                      >
                        {review.status}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </AppFrame>
    </div>
  );
}
