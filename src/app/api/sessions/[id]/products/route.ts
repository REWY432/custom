import { db } from "@/db";
import { products, sessionItems } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const filter = searchParams.get("filter") ?? "all"; // all | uncounted | counted | discrepancy
  const category = searchParams.get("category")?.trim() ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 60), 200);
  const offset = Number(searchParams.get("offset") ?? 0);

  const conditions = [eq(products.archived, false)];

  if (q) {
    const like = `%${q}%`;
    conditions.push(
      sql`(${products.name} ILIKE ${like} OR ${products.article} ILIKE ${like} OR ${products.code} ILIKE ${like} OR ${products.barcodes}::text ILIKE ${like})`,
    );
  }

  if (category) {
    conditions.push(eq(products.pathName, category));
  }

  if (filter === "uncounted") {
    conditions.push(sql`${sessionItems.id} is null`);
  } else if (filter === "counted") {
    conditions.push(sql`${sessionItems.id} is not null`);
  } else if (filter === "discrepancy") {
    conditions.push(sql`${sessionItems.id} is not null and ${sessionItems.countedQuantity} != ${products.systemStock}`);
  }

  const rows = await db
    .select({
      id: products.id,
      msId: products.msId,
      name: products.name,
      code: products.code,
      article: products.article,
      barcodes: products.barcodes,
      pathName: products.pathName,
      uom: products.uom,
      salePrice: products.salePrice,
      systemStock: products.systemStock,
      countedQuantity: sessionItems.countedQuantity,
      lastCountedBy: sessionItems.lastCountedBy,
      lastCountedAt: sessionItems.lastCountedAt,
    })
    .from(products)
    .leftJoin(
      sessionItems,
      and(eq(sessionItems.productId, products.id), eq(sessionItems.sessionId, sessionId)),
    )
    .where(and(...conditions))
    .orderBy(asc(products.name))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .leftJoin(
      sessionItems,
      and(eq(sessionItems.productId, products.id), eq(sessionItems.sessionId, sessionId)),
    )
    .where(and(...conditions));

  return Response.json({
    items: rows.map((r) => ({
      ...r,
      isCounted: r.countedQuantity !== null,
      countedQuantity: r.countedQuantity ?? 0,
      diff: r.countedQuantity !== null ? r.countedQuantity - r.systemStock : null,
    })),
    total,
  });
}
