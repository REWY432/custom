import { db } from "@/db";
import { products, sessionItems } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);

  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      code: products.code,
      article: products.article,
      pathName: products.pathName,
      uom: products.uom,
      salePrice: products.salePrice,
      systemStock: products.systemStock,
      countedQuantity: sessionItems.countedQuantity,
      lastCountedBy: sessionItems.lastCountedBy,
      lastCountedAt: sessionItems.lastCountedAt,
    })
    .from(sessionItems)
    .innerJoin(products, eq(products.id, sessionItems.productId))
    .where(eq(sessionItems.sessionId, sessionId))
    .orderBy(products.name);

  const report = rows.map((r) => ({
    ...r,
    diff: r.countedQuantity - r.systemStock,
    diffValue: (r.countedQuantity - r.systemStock) * (r.salePrice ?? 0),
  }));

  const [uncountedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.archived, false));

  const surplus = report.filter((r) => r.diff > 0);
  const shortage = report.filter((r) => r.diff < 0);
  const matched = report.filter((r) => r.diff === 0);

  return Response.json({
    report,
    summary: {
      totalProducts: uncountedRow.count,
      counted: report.length,
      uncounted: uncountedRow.count - report.length,
      surplusCount: surplus.length,
      shortageCount: shortage.length,
      matchedCount: matched.length,
      surplusValue: surplus.reduce((s, r) => s + r.diffValue, 0),
      shortageValue: shortage.reduce((s, r) => s + r.diffValue, 0),
    },
  });
}
