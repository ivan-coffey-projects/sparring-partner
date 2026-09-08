import { randomUUID } from "node:crypto";

/** Opaque unique id for database rows. */
export function newId(): string {
  return randomUUID();
}
