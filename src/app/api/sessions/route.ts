import { db } from "@/db";
import { inventorySessions, products, sessionItems } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      id: inventorySessions.id,
      name: inventorySessions.name,
      status: inventorySessions.status,
      storeName: inventorySessions.storeName,
      organizationName: inventorySessions.organizationName,
      createdAt: inventorySessions.createdAt,
      completedAt: inventorySessions.completedAt,
      pushedAt: inventorySessions.pushedAt,
      countedItems: sql<number>`count(distinct ${sessionItems.productId})::int`,
    })
    .from(inventorySessions)
    .leftJoin(sessionItems, eq(sessionItems.sessionId, inventorySessions.id))
    .groupBy(inventorySessions.id)
    .orderBy(desc(inventorySessions.createdAt));

  const [{ totalProducts }] = await db
    .select({ totalProducts: sql<number>`count(*)::int` })
    .from(products);

  return Response.json({ sessions: rows, totalProducts });
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : `Инвентаризация от ${new Date().toLocaleDateString("ru-RU")}`;

  const [created] = await db
    .insert(inventorySessions)
    .values({
      name,
      status: "active",
      storeId: body.storeId ?? null,
      storeName: body.storeName ?? null,
      storeMeta: body.storeMeta ?? null,
      organizationId: body.organizationId ?? null,
      organizationName: body.organizationName ?? null,
      organizationMeta: body.organizationMeta ?? null,
      note: body.note ?? null,
    })
    .returning();

  return Response.json({ session: created });
}
