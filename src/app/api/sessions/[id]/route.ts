import { db } from "@/db";
import { inventorySessions, products, sessionItems } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function loadSession(id: number) {
  const rows = await db.select().from(inventorySessions).where(eq(inventorySessions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  const session = await loadSession(sessionId);
  if (!session) {
    return Response.json({ error: "Сессия не найдена" }, { status: 404 });
  }

  const [{ totalProducts }] = await db
    .select({ totalProducts: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.archived, false));

  const [{ countedProducts, totalCountedQty, discrepancies }] = await db
    .select({
      countedProducts: sql<number>`count(*)::int`,
      totalCountedQty: sql<number>`coalesce(sum(${sessionItems.countedQuantity}), 0)`,
      discrepancies: sql<number>`count(*) filter (where ${sessionItems.countedQuantity} != ${products.systemStock})::int`,
    })
    .from(sessionItems)
    .innerJoin(products, eq(products.id, sessionItems.productId))
    .where(eq(sessionItems.sessionId, sessionId));

  return Response.json({
    session,
    stats: {
      totalProducts,
      countedProducts,
      remainingProducts: totalProducts - countedProducts,
      totalCountedQty,
      discrepancies,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  if (body.status === "completed") {
    patch.status = "completed";
    patch.completedAt = new Date();
  } else if (body.status === "cancelled") {
    patch.status = "cancelled";
  } else if (body.status === "active") {
    patch.status = "active";
    patch.completedAt = null;
  }
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim();
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Нет изменений" }, { status: 400 });
  }

  const [updated] = await db
    .update(inventorySessions)
    .set(patch)
    .where(eq(inventorySessions.id, sessionId))
    .returning();

  return Response.json({ session: updated });
}
