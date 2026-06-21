import { z } from "zod";

// ===== sheet =====
const cellOut = z.object({ attr: z.string(), value: z.string(), visible: z.number() });

export const sheetGetIn = z.object({ entity: z.string(), attr: z.string() }).strict();
export const sheetGetOut = z.object({ value: z.string().nullable(), visible: z.number() });

export const sheetListIn = z
  .object({
    entity: z.string(),
    prefix: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(100),
    offset: z.number().int().min(0).default(0),
  })
  .strict();
export const sheetListOut = z.object({
  cells: z.array(cellOut),
  has_more: z.boolean(),
  next_offset: z.number().optional(),
  truncated: z.boolean(),
});

const mutation = z.object({
  attr: z.string(),
  op: z.enum(["+", "-", "="]),
  expr: z.string(),
  visible: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
});
export const sheetUpdateIn = z.object({ entity: z.string(), mutations: z.array(mutation).min(1) }).strict();
const appliedOut = z.object({
  attr: z.string(),
  op: z.enum(["+", "-", "="]),
  kind: z.enum(["rolled", "set"]),
  old: z.string().nullable(),
  rolls: z.array(z.number()).optional(),
  delta: z.number().optional(),
  new: z.string(),
});
export const sheetUpdateOut = z.object({
  entity: z.string(),
  applied: z.array(appliedOut),
  fired_watchers: z.array(z.object({ id: z.number(), payload: z.string() })).optional(),
  event_id: z.number(),
  reminders: z.array(z.string()).optional(),
});
