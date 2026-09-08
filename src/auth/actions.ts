"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { invites, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/auth/password";
import { isPasswordlessLoginEnabled } from "@/auth/passwordless";
import {
  createSessionForUser,
  destroySession,
  requireUser,
} from "@/auth/session";
import { newId } from "@/lib/ids";

export interface AuthFormState {
  error: string | null;
}

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
});

const passwordSchema = z.string().min(8, "Password must be at least 8 characters.");

const credentialsSchema = z.object({
  email: emailSchema.shape.email,
  password: passwordSchema,
});

const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(80, "Name is too long.");

function homeFor(role: "trainer" | "rep"): string {
  return role === "trainer" ? "/coach" : "/";
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const passwordless = isPasswordlessLoginEnabled();
  const parsedEmail = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsedEmail.success) {
    return { error: parsedEmail.error.issues[0]?.message ?? "Invalid input." };
  }
  const parsedPassword = passwordless
    ? null
    : passwordSchema.safeParse(formData.get("password"));
  if (parsedPassword && !parsedPassword.success) {
    return {
      error: parsedPassword.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const user = db
    .select()
    .from(users)
    .where(eq(users.email, parsedEmail.data.email))
    .get();
  if (
    !user ||
    (parsedPassword &&
      !verifyPassword(parsedPassword.data, user.passwordHash))
  ) {
    return { error: "Wrong email or password." };
  }
  await createSessionForUser(user.id);
  redirect(homeFor(user.role));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

function userCount(): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(users).get();
  return row?.n ?? 0;
}

export async function hasAnyUsers(): Promise<boolean> {
  return userCount() > 0;
}

/** First-boot: create the initial trainer account. Only valid while no users exist. */
export async function setupFirstTrainer(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (userCount() > 0) {
    return { error: "Setup has already been completed." };
  }
  const passwordless = isPasswordlessLoginEnabled();
  const parsedEmail = emailSchema.safeParse({ email: formData.get("email") });
  const parsedPassword = passwordless
    ? null
    : passwordSchema.safeParse(formData.get("password"));
  const name = nameSchema.safeParse(formData.get("name"));
  if (!parsedEmail.success || (parsedPassword && !parsedPassword.success) || !name.success) {
    return {
      error:
        parsedEmail.error?.issues[0]?.message ??
        parsedPassword?.error?.issues[0]?.message ??
        name.error?.issues[0]?.message ??
        "Invalid input.",
    };
  }
  const id = newId();
  db.insert(users)
    .values({
      id,
      email: parsedEmail.data.email,
      name: name.data,
      passwordHash: hashPassword(
        parsedPassword?.data ?? randomBytes(32).toString("hex"),
      ),
      role: "trainer",
      createdAt: Date.now(),
    })
    .run();
  await createSessionForUser(id);
  redirect("/coach");
}

/** Register through a one-time invite link. */
export async function joinWithInvite(
  token: string,
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const invite = db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.usedByUserId)))
    .get();
  if (!invite || invite.expiresAt < Date.now()) {
    return { error: "This invite link is invalid or has expired." };
  }
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const name = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success || !name.success) {
    return {
      error:
        parsed.error?.issues[0]?.message ??
        name.error?.issues[0]?.message ??
        "Invalid input.",
    };
  }
  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .get();
  if (existing) {
    return { error: "An account with this email already exists." };
  }
  const id = newId();
  db.insert(users)
    .values({
      id,
      email: parsed.data.email,
      name: name.data,
      passwordHash: hashPassword(parsed.data.password),
      role: invite.role,
      createdAt: Date.now(),
    })
    .run();
  db.update(invites)
    .set({ usedByUserId: id })
    .where(eq(invites.id, invite.id))
    .run();
  await createSessionForUser(id);
  redirect(homeFor(invite.role));
}

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** Trainer-only: mint a one-time invite link for a rep (or another trainer). */
export async function createInvite(role: "trainer" | "rep"): Promise<string> {
  const trainer = await requireUser("trainer");
  const token = randomBytes(24).toString("hex");
  const now = Date.now();
  db.insert(invites)
    .values({
      id: newId(),
      token,
      role,
      createdBy: trainer.id,
      usedByUserId: null,
      expiresAt: now + INVITE_TTL_MS,
      createdAt: now,
    })
    .run();
  return token;
}
