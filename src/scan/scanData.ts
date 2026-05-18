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

// Seed sample scan photos for demo so users can see the gallery UI.
const DEMO_PHOTOS = [
  "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565793979206-6d144d6b5fb6?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1597844808175-3a7e0bf2b3b9?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&auto=format&fit=crop",
];

(function seedDemoScans() {
  let seeded = 0;
  for (const projectId of Object.keys(PROJECT_ITEMS)) {
    const items = PROJECT_ITEMS[projectId];
    if (!items || items.length === 0) continue;
    const targets = items.slice(0, 2);
    targets.forEach((item, idx) => {
      const baseTime = Date.now() - (seeded + 1) * 3600_000;
      SCAN_LOG.push({
        id: `demo-${projectId}-${item.id}-1`,
        itemId: item.id,
        projectId,
        barcode: item.barcode,
        username: "מפעיל הדגמה",
        action: "station_pass",
        stationId: STATIONS[0].id,
        notes: "סריקת תחילת תהליך",
        photos: [DEMO_PHOTOS[(seeded * 2) % DEMO_PHOTOS.length], DEMO_PHOTOS[(seeded * 2 + 1) % DEMO_PHOTOS.length]],
        timestamp: new Date(baseTime).toISOString(),
      });
      if (idx === 0) {
        SCAN_LOG.push({
          id: `demo-${projectId}-${item.id}-2`,
          itemId: item.id,
          projectId,
          barcode: item.barcode,
          username: "בקר איכות",
          action: "qc_pass",
          stationId: STATIONS[1]?.id,
          notes: "בדיקת איכות עברה בהצלחה",
          photos: [DEMO_PHOTOS[(seeded + 2) % DEMO_PHOTOS.length]],
          timestamp: new Date(baseTime + 1800_000).toISOString(),
        });
      }
      seeded++;
    });
  }
})();

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
