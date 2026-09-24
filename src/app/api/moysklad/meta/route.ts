import { requireApiToken } from "@/lib/settings";
import { listOrganizations, listStores } from "@/lib/moysklad";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await requireApiToken();
    const [organizations, stores] = await Promise.all([listOrganizations(token), listStores(token)]);
    return Response.json({ organizations, stores });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Ошибка запроса к МойСклад" },
      { status: 400 },
    );
  }
}
