import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { MsMeta } from "@/lib/ms-types";

// Настройки интеграции с МойСклад (одна строка на инсталляцию)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  apiToken: text("api_token"),
  accountName: text("account_name"),
  organizationId: text("organization_id"),
  organizationName: text("organization_name"),
  organizationMeta: jsonb("organization_meta").$type<MsMeta | null>(),
  storeId: text("store_id"),
  storeName: text("store_name"),
  storeMeta: jsonb("store_meta").$type<MsMeta | null>(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncCount: integer("last_sync_count"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Локальный кэш ассортимента из МойСклад (товары, модификации, комплекты)
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    msId: text("ms_id").notNull(),
    msType: text("ms_type").notNull(), // product | variant | bundle
    name: text("name").notNull(),
    code: text("code"),
    article: text("article"),
    barcodes: jsonb("barcodes").$type<string[]>().default([]).notNull(),
    pathName: text("path_name"),
    uom: text("uom"),
    salePrice: doublePrecision("sale_price"),
    systemStock: doublePrecision("system_stock").default(0).notNull(),
    archived: boolean("archived").default(false).notNull(),
    meta: jsonb("meta").$type<MsMeta>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("products_ms_id_idx").on(t.msId),
    index("products_name_idx").on(t.name),
    index("products_article_idx").on(t.article),
    index("products_path_name_idx").on(t.pathName),
  ],
);

// Сессия инвентаризации
export const inventorySessions = pgTable("inventory_sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").default("active").notNull(), // active | completed | cancelled
  storeId: text("store_id"),
  storeName: text("store_name"),
  storeMeta: jsonb("store_meta").$type<MsMeta | null>(),
  organizationId: text("organization_id"),
  organizationName: text("organization_name"),
  organizationMeta: jsonb("organization_meta").$type<MsMeta | null>(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  pushedAt: timestamp("pushed_at", { withTimezone: true }),
  pushedDocId: text("pushed_doc_id"),
  pushedDocName: text("pushed_doc_name"),
});

// Текущий подсчитанный итог по товару в рамках сессии
export const sessionItems = pgTable(
  "session_items",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => inventorySessions.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    countedQuantity: doublePrecision("counted_quantity").default(0).notNull(),
    lastCountedBy: text("last_counted_by"),
    lastCountedAt: timestamp("last_counted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("session_items_session_product_idx").on(t.sessionId, t.productId)],
);

// Журнал операций подсчёта (для истории/отмены и работы нескольких считающих одновременно)
export const countLogs = pgTable(
  "count_logs",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => inventorySessions.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    delta: doublePrecision("delta").notNull(),
    resultQuantity: doublePrecision("result_quantity").notNull(),
    type: text("type").notNull(), // increment | set
    source: text("source").notNull(), // scan | manual
    countedBy: text("counted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("count_logs_session_idx").on(t.sessionId), index("count_logs_product_idx").on(t.productId)],
);
