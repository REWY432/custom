export interface SessionProductItem {
  id: number;
  msId: string;
  name: string;
  code: string | null;
  article: string | null;
  barcodes: string[];
  pathName: string | null;
  uom: string | null;
  salePrice: number | null;
  systemStock: number;
  countedQuantity: number;
  isCounted: boolean;
  diff: number | null;
  lastCountedBy: string | null;
  lastCountedAt: string | null;
}

export interface SessionInfo {
  id: number;
  name: string;
  status: "active" | "completed" | "cancelled";
  storeId: string | null;
  storeName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  createdAt: string;
  completedAt: string | null;
  pushedAt: string | null;
  pushedDocId: string | null;
  pushedDocName: string | null;
  note: string | null;
}

export interface SessionStats {
  totalProducts: number;
  countedProducts: number;
  remainingProducts: number;
  totalCountedQty: number;
  discrepancies: number;
}
