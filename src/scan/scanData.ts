// In-memory log of scans performed via the mobile scanner app.
// Mirrors the project's mock-data approach.

import { ProjectItem, PROJECT_ITEMS, PROJECTS, STATIONS, StationId, updateItemStatus } from "@/data/mockData";

export type ScanAction = "station_pass" | "station_reject" | "qc_pass" | "qc_reject" | "qc_final";

export interface ScanRecord {
  id: string;
  itemId: string;
  projectId: string;
  barcode: string;
  username: string;
  action: ScanAction;
  stationId?: StationId;
  notes?: string;
  photos: string[]; // data URLs
  timestamp: string;
}

export const SCAN_LOG: ScanRecord[] = [];

export function findItemByBarcode(barcode: string): { item: ProjectItem; projectId: string } | null {
  const code = barcode.trim();
  if (!code) return null;
  for (const projectId of Object.keys(PROJECT_ITEMS)) {
    const item = PROJECT_ITEMS[projectId].find((i) => i.barcode === code);
    if (item) return { item, projectId };
  }
  return null;
}

export function getProjectName(projectId: string): string {
  return PROJECTS.find((p) => p.id === projectId)?.name || projectId;
}

export function getStationName(id?: StationId | null): string {
  if (!id) return "-";
  return STATIONS.find((s) => s.id === id)?.name || id;
}

function nextStation(current: StationId | null): StationId | null {
  if (!current) return STATIONS[0].id;
  const idx = STATIONS.findIndex((s) => s.id === current);
  if (idx === -1 || idx >= STATIONS.length - 1) return null;
  return STATIONS[idx + 1].id;
}

export function recordStationScan(args: {
  item: ProjectItem;
  projectId: string;
  username: string;
  stationId: StationId;
  passed: boolean;
  photos: string[];
  notes?: string;
}) {
  const { item, projectId, username, stationId, passed, photos, notes } = args;
  item.stationHistory.push({
    station: stationId,
    timestamp: new Date().toISOString(),
    result: passed ? "pass" : "fail",
    notes,
  });
  if (passed) {
    item.currentStation = stationId;
    item.status = "in_progress";
  } else {
    item.status = "rejected";
    item.currentStation = stationId;
  }
  SCAN_LOG.unshift({
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: item.id,
    projectId,
    barcode: item.barcode,
    username,
    action: passed ? "station_pass" : "station_reject",
    stationId,
    notes,
    photos,
    timestamp: new Date().toISOString(),
  });
}

export function recordQcScan(args: {
  item: ProjectItem;
  projectId: string;
  username: string;
  action: "qc_pass" | "qc_reject" | "qc_final";
  photos: string[];
  notes?: string;
}) {
  const { item, projectId, username, action, photos, notes } = args;
  if (action === "qc_pass") {
    // Approve the current station - allow item to move forward
    item.status = "in_progress";
  } else if (action === "qc_reject") {
    item.status = "rejected";
    item.qcApproved = false;
    item.stationHistory.push({
      station: item.currentStation || STATIONS[0].id,
      timestamp: new Date().toISOString(),
      result: "fail",
      notes: notes || "נפסל ע״י בקר איכות",
    });
  } else if (action === "qc_final") {
    item.qcApproved = true;
    item.status = "completed";
    item.currentStation = null;
    updateItemStatus(projectId, item.id, "completed");
  }
  SCAN_LOG.unshift({
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: item.id,
    projectId,
    barcode: item.barcode,
    username,
    action,
    stationId: item.currentStation || undefined,
    notes,
    photos,
    timestamp: new Date().toISOString(),
  });
}
