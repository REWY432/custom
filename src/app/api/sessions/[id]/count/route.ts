import { db } from "@/db";
import { countLogs, products, sessionItems } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 25), 100);

  const rows = await db
    .select({
      id: countLogs.id,
      productId: countLogs.productId,
      productName: products.name,
      delta: countLogs.delta,
      resultQuantity: countLogs.resultQuantity,
      type: countLogs.type,
      source: countLogs.source,
      countedBy: countLogs.countedBy,
      createdAt: countLogs.createdAt,
    })
    .from(countLogs)
    .innerJoin(products, eq(products.id, countLogs.productId))
    .where(eq(countLogs.sessionId, sessionId))
    .orderBy(desc(countLogs.createdAt))
    .limit(limit);

  return Response.json({ logs: rows });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  const body = await req.json();

  if (body.action === "undo") {
    return handleUndo(sessionId, Number(body.productId));
  }

  const productId = Number(body.productId);
  const mode: "increment" | "set" = body.mode === "set" ? "set" : "increment";
  const value = Number(body.value);
  const countedBy = typeof body.countedBy === "string" && body.countedBy.trim() ? body.countedBy.trim() : "Без имени";
  const source: "scan" | "manual" = body.source === "scan" ? "scan" : "manual";

  if (!productId || Number.isNaN(value)) {
    return Response.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(sessionItems)
      .where(and(eq(sessionItems.sessionId, sessionId), eq(sessionItems.productId, productId)))
      .limit(1);

    const base = existing?.countedQuantity ?? 0;
    const newQuantity = mode === "set" ? value : base + value;
    const delta = newQuantity - base;
    const now = new Date();

    if (existing) {
      await tx
        .update(sessionItems)
        .set({ countedQuantity: newQuantity, lastCountedBy: countedBy, lastCountedAt: now })
        .where(eq(sessionItems.id, existing.id));
    } else {
      await tx.insert(sessionItems).values({
        sessionId,
        productId,
        countedQuantity: newQuantity,
        lastCountedBy: countedBy,
        lastCountedAt: now,
      });
    }

    await tx.insert(countLogs).values({
      sessionId,
      productId,
      delta,
      resultQuantity: newQuantity,
      type: mode,
      source,
      countedBy,
    });

    return newQuantity;
  });

  return Response.json({ ok: true, countedQuantity: result });
}

async function handleUndo(sessionId: number, productId: number) {
  if (!productId) {
    return Response.json({ error: "Не указан товар" }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    const [lastLog] = await tx
      .select()
      .from(countLogs)
      .where(and(eq(countLogs.sessionId, sessionId), eq(countLogs.productId, productId)))
      .orderBy(desc(countLogs.createdAt))
      .limit(1);

    if (!lastLog) {
      return null;
    }

    const revertedQuantity = lastLog.resultQuantity - lastLog.delta;
    await tx.delete(countLogs).where(eq(countLogs.id, lastLog.id));

    const [remaining] = await tx
      .select()
      .from(countLogs)
      .where(and(eq(countLogs.sessionId, sessionId), eq(countLogs.productId, productId)))
      .orderBy(desc(countLogs.createdAt))
      .limit(1);

    if (!remaining && revertedQuantity === 0) {
      await tx
        .delete(sessionItems)
        .where(and(eq(sessionItems.sessionId, sessionId), eq(sessionItems.productId, productId)));
      return { countedQuantity: 0, removed: true };
    }

    await tx
      .update(sessionItems)
      .set({ countedQuantity: revertedQuantity })
      .where(and(eq(sessionItems.sessionId, sessionId), eq(sessionItems.productId, productId)));

    return { countedQuantity: revertedQuantity, removed: false };
  });

  if (!result) {
    return Response.json({ error: "Нет операций для отмены" }, { status: 400 });
  }

  return Response.json({ ok: true, ...result });
}
