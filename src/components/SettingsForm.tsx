"use client";

import { useEffect, useState } from "react";
import SyncButton from "@/components/SyncButton";

interface MsRef {
  id: string;
  name: string;
  meta: unknown;
}

interface SettingsState {
  configured: boolean;
  accountName?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  lastSyncAt?: string | null;
  lastSyncCount?: number | null;
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [token, setToken] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [orgs, setOrgs] = useState<MsRef[]>([]);
  const [stores, setStores] = useState<MsRef[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);

  async function loadSettings() {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setSettings(data);
    setSelectedOrg(data.organizationId ?? "");
    setSelectedStore(data.storeId ?? "");
  }

  async function loadMeta() {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const res = await fetch("/api/moysklad/meta");
      const data = await res.json();
      if (!res.ok) {
        setMetaError(data.error ?? "Не удалось получить список складов/организаций");
        return;
      }
      setOrgs(data.organizations);
      setStores(data.stores);
    } catch {
      setMetaError("Ошибка запроса");
    } finally {
      setMetaLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings?.configured) {
      loadMeta();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.configured]);

  async function handleSaveToken(e: React.FormEvent) {
    e.preventDefault();
    setTokenSaving(true);
    setTokenMessage(null);
    setTokenError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken: token }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setTokenError(data.error ?? "Не удалось сохранить токен");
      } else {
        setTokenMessage(`Подключено: ${data.accountName}`);
        setToken("");
        await loadSettings();
      }
    } catch {
      setTokenError("Ошибка запроса");
    } finally {
      setTokenSaving(false);
    }
  }

  async function handleSaveMeta() {
    setSavingMeta(true);
    try {
      const org = orgs.find((o) => o.id === selectedOrg);
      const store = stores.find((s) => s.id === selectedStore);
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: org ? { id: org.id, name: org.name, meta: org.meta } : undefined,
          store: store ? { id: store.id, name: store.name, meta: store.meta } : undefined,
        }),
      });
      await loadSettings();
    } finally {
      setSavingMeta(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <form onSubmit={handleSaveToken} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <label className="text-sm font-semibold text-slate-800">API токен МойСклад</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={settings?.configured ? "Токен сохранён, введите новый чтобы заменить" : "Вставьте токен"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={tokenSaving || !token.trim()}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {tokenSaving ? "Проверка..." : "Сохранить и проверить"}
          </button>
        </div>
        {tokenMessage && <p className="mt-2 text-xs font-medium text-emerald-600">{tokenMessage}</p>}
        {tokenError && <p className="mt-2 text-xs font-medium text-red-600">{tokenError}</p>}
        {settings?.configured && (
          <p className="mt-3 text-xs text-slate-500">
            Текущий аккаунт: <b>{settings.accountName}</b>
          </p>
        )}
      </form>

      {settings?.configured && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Организация и склад по умолчанию</h2>
          <p className="mt-1 text-xs text-slate-500">
            Склад используется для расчёта остатков при синхронизации и как склад документа «Инвентаризация».
            Организация нужна для создания документа в МойСклад.
          </p>

          {metaLoading && <p className="mt-3 text-sm text-slate-500">Загрузка списков...</p>}
          {metaError && <p className="mt-3 text-sm text-red-600">{metaError}</p>}

          {!metaLoading && !metaError && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          )}

          <button
            onClick={handleSaveMeta}
            disabled={savingMeta}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {savingMeta ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      )}

      {settings?.configured && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Синхронизация ассортимента</h2>
          <p className="mt-1 text-xs text-slate-500">
            Загружает все товары, модификации и комплекты из МойСклад вместе с остатками по выбранному складу
            (2000+ позиций синхронизируются за один запуск).
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Последняя синхронизация:{" "}
            <b>{settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString("ru-RU") : "не выполнялась"}</b>
            {settings.lastSyncCount ? ` · ${settings.lastSyncCount} товаров` : ""}
          </p>
          <div className="mt-3">
            <SyncButton />
          </div>
        </div>
      )}
    </div>
  );
}
