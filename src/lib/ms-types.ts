// Общие типы для интеграции с МойСклад JSON API 1.2

export interface MsMeta {
  href: string;
  metadataHref?: string;
  type: string;
  mediaType?: string;
  uuidHref?: string;
}

export interface MsMetaWrapper {
  meta: MsMeta;
}
