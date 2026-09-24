import { db } from "@/db";
import { inventorySessions, products, sessionItems } from "@/db/schema";
import { requireApiToken } from "@/lib/settings";
import { createInventoryDocument } from "@/lib/moysklad";
import { eq } from "drizzle-orm";
import type { MsMeta } from "@/lib/ms-types";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  const body = await req.json().catch(() => ({}));
  const applicable = body.applicable !== false;

  const [session] = await db.select().from(inventorySessions).where(eq(inventorySessions.id, sessionId)).limit(1);
  if (!session) {
    return Response.json({ error: "Сессия не найдена" }, { status: 404 });
  }
  if (!session.organizationMeta || !session.storeMeta) {
    return Response.json({ error: "Для сессии не указаны организация и склад МойСклад" }, { status: 400 });
  }

  const rows = await db
    .select({ meta: products.meta, countedQuantity: sessionItems.countedQuantity })
    .from(sessionItems)
    .innerJoin(products, eq(products.id, sessionItems.productId))
    .where(eq(sessionItems.sessionId, sessionId));

  if (rows.length === 0) {
    return Response.json({ error: "В сессии нет посчитанных товаров" }, { status: 400 });
  }

  try {
    const token = await requireApiToken();
    const doc = await createInventoryDocument(token, {
      organizationMeta: session.organizationMeta as MsMeta,
      storeMeta: session.storeMeta as MsMeta,
      name: session.name,
      description: `Создано сервисом инвентаризации. Товаров учтено: ${rows.length}.`,
      applicable,
      positions: rows.map((r) => ({ assortmentMeta: r.meta as MsMeta, quantity: r.countedQuantity })),
    });

    const [updated] = await db
      .update(inventorySessions)
      .set({ pushedAt: new Date(), pushedDocId: doc.id, pushedDocName: doc.name })
      .where(eq(inventorySessions.id, sessionId))
      .returning();

    return Response.json({ ok: true, doc, session: updated });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Не удалось создать документ в МойСклад" },
      { status: 500 },
    );
  }
}
