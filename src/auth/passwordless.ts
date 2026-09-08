export function isPasswordlessLoginEnabled(
  env: { SP_PASSWORDLESS_LOGIN?: string } = process.env as {
    SP_PASSWORDLESS_LOGIN?: string;
  },
): boolean {
  return env.SP_PASSWORDLESS_LOGIN === "1";
}
