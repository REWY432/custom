import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Settings = typeof settings.$inferSelect;

export async function getSettings(): Promise<Settings | null> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return rows[0] ?? null;
}

export async function upsertSettings(patch: Partial<typeof settings.$inferInsert>): Promise<Settings> {
  const existing = await getSettings();
  if (existing) {
    const [updated] = await db
      .update(settings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(settings.id, 1))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(settings)
    .values({ id: 1, ...patch })
    .returning();
  return created;
}

export async function requireApiToken(): Promise<string> {
  const s = await getSettings();
  if (!s?.apiToken) {
    throw new Error("Токен МойСклад не настроен. Перейдите в Настройки.");
  }
  return s.apiToken;
}
