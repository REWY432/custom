import { db } from "@/db";
import { products } from "@/db/schema";
import { isNotNull, sql, and, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .selectDistinct({ pathName: products.pathName })
    .from(products)
    .where(and(isNotNull(products.pathName), ne(products.pathName, "")))
    .orderBy(sql`${products.pathName} asc`);

  return Response.json({ categories: rows.map((r) => r.pathName).filter(Boolean) });
}
