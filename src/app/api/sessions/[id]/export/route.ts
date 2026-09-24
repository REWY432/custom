import { db } from "@/db";
import { inventorySessions, products, sessionItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",;\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);

  const [session] = await db.select().from(inventorySessions).where(eq(inventorySessions.id, sessionId)).limit(1);

  const rows = await db
    .select({
      name: products.name,
      code: products.code,
      article: products.article,
      pathName: products.pathName,
      uom: products.uom,
      salePrice: products.salePrice,
      systemStock: products.systemStock,
      countedQuantity: sessionItems.countedQuantity,
      lastCountedBy: sessionItems.lastCountedBy,
    })
    .from(sessionItems)
    .innerJoin(products, eq(products.id, sessionItems.productId))
    .where(eq(sessionItems.sessionId, sessionId))
    .orderBy(products.pathName, products.name);

  const header = [
    "Категория",
    "Наименование",
    "Артикул",
    "Код",
    "Ед.",
    "Учтено в МойСклад",
    "Посчитано факт",
    "Отклонение",
    "Цена",
    "Сумма отклонения",
    "Кто считал",
  ];

  const lines = [header.map(csvEscape).join(";")];

  for (const r of rows) {
    const diff = r.countedQuantity - r.systemStock;
    const diffValue = diff * (r.salePrice ?? 0);
    lines.push(
      [
        r.pathName ?? "",
        r.name,
        r.article ?? "",
        r.code ?? "",
        r.uom ?? "",
        r.systemStock,
        r.countedQuantity,
        diff,
        r.salePrice ?? "",
        diffValue.toFixed(2),
        r.lastCountedBy ?? "",
      ]
        .map(csvEscape)
        .join(";"),
    );
  }

  const csv = "\uFEFF" + lines.join("\n");
  const filename = `inventory_${session?.name?.replace(/[^\p{L}\p{N}_-]+/gu, "_") ?? sessionId}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
