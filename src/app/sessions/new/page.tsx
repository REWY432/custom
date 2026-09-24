"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MsRef {
  id: string;
  name: string;
  meta: unknown;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [orgs, setOrgs] = useState<MsRef[]>([]);
  const [stores, setStores] = useState<MsRef[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [metaRes, settingsRes] = await Promise.all([
          fetch("/api/moysklad/meta"),
          fetch("/api/settings"),
        ]);
        const meta = await metaRes.json();
        const settings = await settingsRes.json();
        if (metaRes.ok) {
          setOrgs(meta.organizations ?? []);
          setStores(meta.stores ?? []);
        }
        if (settings.organizationId) setSelectedOrg(settings.organizationId);
        if (settings.storeId) setSelectedStore(settings.storeId);
        setName(`Инвентаризация от ${new Date().toLocaleDateString("ru-RU")}`);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const org = orgs.find((o) => o.id === selectedOrg);
      const store = stores.find((s) => s.id === selectedStore);
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          note,
          organizationId: org?.id,
          organizationName: org?.name,
          organizationMeta: org?.meta,
          storeId: store?.id,
          storeName: store?.name,
          storeMeta: store?.meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось создать сессию");
        return;
      }
      router.push(`/sessions/${data.session.id}`);
    } catch {
      setError("Ошибка запроса");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900">Новая инвентаризация</h1>
      <p className="mt-2 text-sm text-slate-600">
        Организация и склад нужны только для того, чтобы в конце можно было отправить результат документом
        «Инвентаризация» в МойСклад — их можно указать позже.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Загрузка...</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div>
            <label className="text-xs font-medium text-slate-600">Название сессии</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Организация</label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— не выбрана —</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Склад</label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— не выбран —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Комментарий (необязательно)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {submitting ? "Создание..." : "Начать инвентаризацию"}
          </button>
        </form>
      )}
    </div>
  );
}
