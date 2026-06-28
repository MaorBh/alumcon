export type StationId = 'cnc' | 'frames' | 'glazing' | 'finishes' | 'windows' | 'vitrines';

export const STATIONS: { id: StationId; name: string; order: number }[] = [
  { id: 'cnc', name: 'CNC', order: 1 },
  { id: 'frames', name: 'מסגרות', order: 2 },
  { id: 'glazing', name: 'זיגוג', order: 3 },
  { id: 'finishes', name: 'פינישים', order: 4 },
  { id: 'windows', name: 'חלונות', order: 5 },
  { id: 'vitrines', name: 'ויטרינות', order: 6 },
];

export type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface ProjectItem {
  id: string;
  barcode: string;
  type: string;
  floor: number;
  unit: number;
  side: string;
  status: ItemStatus;
  currentStation: StationId | null;
  stationHistory: {
    station: StationId;
    timestamp: string;
    result: 'pass' | 'fail';
    notes?: string;
  }[];
  qcApproved: boolean;
  ifcGuid?: string;
  unitName?: string;
  width?: number;
  height?: number;
  unitArea?: string;
  window?: string;
  mashkofUp?: string;
  mashkofDown?: string;
  floorLabel?: string;
  /** Priority full SKU, e.g. "5-0-0042" */
  prioritySku?: string;
  /** 4-digit suffix of Priority SKU (BBBB part of barcode) */
  prioritySuffix?: string;
  /** Unit weight (kg) from Priority catalog */
  priorityWeight?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  status: 'active' | 'completed' | 'on_hold';
  totalItems: number;
  completedItems: number;
  sides: string[];
  floors: number[];
  urn?: string;
  /** Priority project number (AAAA part of barcode), 4-digit zero-padded */
  priorityProjectNumber?: string;
}

/** Row imported from Excel/CSV — all fields optional except ifcGuid */
export interface ImportedItem {
  ifcGuid: string;
  barcode?: string;
  type?: string;
  floor?: number;
  unit?: number;
  side?: string;
  width?: number;
  height?: number;
  unitName?: string;
  unitArea?: string;
  window?: string;
  mashkofUp?: string;
  mashkofDown?: string;
  done?: string;
  floorLabel?: string;
}

/** Row from Priority CSV/XLSX catalog */
export interface PriorityCatalogRow {
  sku: string;          // e.g. "5-0-0042"
  suffix: string;       // last 4 digits, e.g. "0042"
  unitName: string;     // e.g. "WND-R_110_BNY"
  type: string;         // e.g. "WND"
  height?: number;
  width?: number;
  weight?: number;
  count?: number;
}

export const PRIORITY_CATALOG: Record<string, PriorityCatalogRow[]> = {};

function pad(n: string | number, len: number): string {
  return String(n).padStart(len, '0');
}

export function buildBarcode(
  priorityProjectNumber: string | undefined,
  suffix: string | undefined,
  floor: number,
  unit: number,
): string {
  const aaaa = pad((priorityProjectNumber || '0').replace(/\D/g, '') || '0', 4);
  const bbbb = pad((suffix || '0').replace(/\D/g, '') || '0', 4);
  return `${aaaa}-${bbbb}-${pad(floor, 2)}-${pad(unit, 2)}`;
}

function matchPriorityRow(
  catalog: PriorityCatalogRow[],
  unitName?: string,
  type?: string,
): PriorityCatalogRow | undefined {
  if (!catalog.length) return undefined;
  if (unitName) {
    const u = unitName.trim().toLowerCase();
    const exact = catalog.find(r => r.unitName.toLowerCase() === u);
    if (exact) return exact;
  }
  if (type) {
    const t = type.trim().toLowerCase();
    const byType = catalog.find(r => r.type.toLowerCase() === t);
    if (byType) return byType;
  }
  return undefined;
}

const sides = ['S-South', 'S-East', 'S-North', 'S-West'];
const floors = Array.from({ length: 13 }, (_, i) => 21 + i);

function generateItems(projectId: string): ProjectItem[] {
  const items: ProjectItem[] = [];
  let itemIdx = 0;

  for (const side of sides) {
    const unitsPerFloor = side === 'S-South' ? 15 : side === 'S-West' ? 10 : side === 'S-East' ? 12 : 8;
    for (const floor of floors) {
      for (let unit = 1; unit <= unitsPerFloor; unit++) {
        itemIdx++;
        const stationProgress = Math.floor(Math.random() * 7);
        const isRejected = stationProgress > 0 && Math.random() < 0.05;
        const status: ItemStatus =
          stationProgress === 0 ? 'pending' :
          isRejected ? 'rejected' :
          stationProgress >= 6 ? 'completed' : 'in_progress';

        const history = STATIONS.slice(0, stationProgress).map((s, i) => ({
          station: s.id,
          timestamp: new Date(2026, 0, 15 + i, 8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60)).toISOString(),
          result: (isRejected && i === stationProgress - 1 ? 'fail' : 'pass') as 'pass' | 'fail',
          notes: isRejected && i === stationProgress - 1 ? 'פגם באיכות - דרוש תיקון' : undefined,
        }));

        items.push({
          id: `${projectId}-${itemIdx}`,
          barcode: `ALM-${projectId.slice(0, 3).toUpperCase()}-${String(itemIdx).padStart(5, '0')}`,
          type: Math.random() > 0.3 ? 'חלון' : 'ויטרינה',
          floor,
          unit,
          side,
          status,
          currentStation: status === 'completed' ? null : status === 'pending' ? null : STATIONS[stationProgress - 1]?.id || null,
          stationHistory: history,
          qcApproved: status === 'completed',
        });
      }
    }
  }
  return items;
}

export const PROJECTS: Project[] = [
  {
    id: 'south-tower',
    name: 'South Tower',
    description: 'מגדל דרומי - 13 קומות, 4 חזיתות',
    createdAt: '2026-01-10',
    status: 'active',
    totalItems: 0,
    completedItems: 0,
    sides,
    floors,
  },
  {
    id: 'north-tower',
    name: 'North Tower',
    description: 'מגדל צפוני - פרויקט חדש',
    createdAt: '2026-02-01',
    status: 'active',
    totalItems: 0,
    completedItems: 0,
    sides,
    floors,
  },
];

export const PROJECT_ITEMS: Record<string, ProjectItem[]> = {};

PROJECTS.forEach(p => {
  const items = generateItems(p.id);
  PROJECT_ITEMS[p.id] = items;
  p.totalItems = items.length;
  p.completedItems = items.filter(i => i.status === 'completed').length;
});

const SAVED_PROJECTS_KEY = 'alumcon-saved-projects';

// Load persisted user projects from localStorage (survives page refresh on same device)
try {
  const saved = localStorage.getItem(SAVED_PROJECTS_KEY);
  if (saved) {
    const { projects, items } = JSON.parse(saved) as {
      projects: Project[];
      items: Record<string, ProjectItem[]>;
    };
    projects.forEach(p => {
      if (!PROJECTS.find(x => x.id === p.id)) {
        PROJECTS.push(p);
        PROJECT_ITEMS[p.id] = items[p.id] || [];
      }
    });
  }
} catch { /* ignore */ }

export function persistUserProjects() {
  try {
    const userProjects = PROJECTS.filter(
      p => p.id !== 'south-tower' && p.id !== 'north-tower'
    );
    if (userProjects.length === 0) return;
    const userItems: Record<string, ProjectItem[]> = {};
    userProjects.forEach(p => {
      userItems[p.id] = (PROJECT_ITEMS[p.id] || []).map(item => ({
        id: item.id,
        barcode: item.barcode,
        type: item.type,
        floor: item.floor,
        unit: item.unit,
        side: item.side,
        status: item.status,
        currentStation: item.currentStation,
        stationHistory: item.stationHistory || [],
        qcApproved: item.qcApproved,
        ifcGuid: item.ifcGuid,
        unitName: item.unitName,
        width: item.width,
        height: item.height,
        unitArea: item.unitArea,
        floorLabel: item.floorLabel,
        prioritySku: item.prioritySku,
        prioritySuffix: item.prioritySuffix,
        priorityWeight: item.priorityWeight,
      }));
    });
    const payload = JSON.stringify({ projects: userProjects, items: userItems });
    localStorage.setItem(SAVED_PROJECTS_KEY, payload);
  } catch (e) {
    console.error('[alumcon] localStorage save failed:', e);
  }
}

export function addProject(config: {
  name: string;
  description: string;
  sides: string[];
  floors: number[];
  unitsPerFloor: Record<string, number>;
  importedItems?: ImportedItem[];   // ← from Excel/CSV
  priorityProjectNumber?: string;   // AAAA — Priority project number
  priorityCatalog?: PriorityCatalogRow[];
}) {
  const id = config.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
  const aaaa = (config.priorityProjectNumber || '').replace(/\D/g, '').padStart(4, '0').slice(-4);
  const catalog = config.priorityCatalog || [];

  const project: Project = {
    id,
    name: config.name,
    description: config.description,
    createdAt: new Date().toISOString().split('T')[0],
    status: 'active',
    totalItems: 0,
    completedItems: 0,
    sides: config.sides,
    floors: config.floors,
    priorityProjectNumber: aaaa,
  };

  PRIORITY_CATALOG[id] = catalog;

  const enrich = (it: ProjectItem) => {
    const row = matchPriorityRow(catalog, it.unitName, it.type);
    if (row) {
      it.prioritySku = row.sku;
      it.prioritySuffix = row.suffix;
      it.priorityWeight = row.weight;
    }
    it.barcode = buildBarcode(aaaa, it.prioritySuffix, it.floor, it.unit);
    return it;
  };

  let items: ProjectItem[];

  if (config.importedItems && config.importedItems.length > 0) {
    items = config.importedItems.map((imp, idx) => enrich({
      id: `${id}-${idx + 1}`,
      barcode: '',
      type: imp.type || 'חלון',
      floor: imp.floor ?? 1,
      unit: imp.unit ?? idx + 1,
      side: imp.side || config.sides[0] || 'S-South',
      status: 'pending',
      currentStation: null,
      stationHistory: [],
      qcApproved: false,
      ifcGuid: imp.ifcGuid,
      unitName: imp.unitName,
      width: imp.width,
      height: imp.height,
      unitArea: imp.unitArea,
      window: imp.window,
      mashkofUp: imp.mashkofUp,
      mashkofDown: imp.mashkofDown,
      floorLabel: imp.floorLabel,
    }));
  } else {
    items = [];
    let idx = 0;
    for (const side of config.sides) {
      const units = config.unitsPerFloor[side] || 1;
      for (const floor of config.floors) {
        for (let unit = 1; unit <= units; unit++) {
          idx++;
          items.push(enrich({
            id: `${id}-${idx}`,
            barcode: '',
            type: 'חלון',
            floor,
            unit,
            side,
            status: 'pending',
            currentStation: null,
            stationHistory: [],
            qcApproved: false,
          }));
        }
      }
    }
  }

  project.totalItems = items.length;
  PROJECT_ITEMS[id] = items;
  PROJECTS.push(project);
  persistUserProjects();
  return project;
}

/** Parse a Priority CSV/XLSX-derived rows-array into PriorityCatalogRow[].
 * Expects a header row containing "מקט" (or "sku") and known columns. */
export function parsePriorityRows(raw: unknown[][]): PriorityCatalogRow[] {
  if (!raw || raw.length < 2) return [];
  const norm = (v: unknown) => String(v ?? '').trim();
  let headerIdx = -1;
  for (let r = 0; r < Math.min(raw.length, 10); r++) {
    const row = raw[r].map(c => norm(c).toLowerCase());
    if (row.some(c => c === 'מקט' || c === 'sku' || c === 'מק"ט')) { headerIdx = r; break; }
  }
  if (headerIdx < 0) return [];
  const headers = raw[headerIdx].map(c => norm(c).toLowerCase());
  const find = (...keys: string[]) => headers.findIndex(h => keys.includes(h));
  const iSku  = find('מקט', 'מק"ט', 'sku', 'catalog');
  const iName = find('unit_name', 'unitname', 'שם יחידה');
  const iType = find('type', 'סוג');
  const iH    = find('height', 'גובה');
  const iW    = find('width', 'רוחב', 'אורך');
  const iWt   = find('weight', 'משקל');
  const iCnt  = find('count', 'כמות');
  const out: PriorityCatalogRow[] = [];
  for (let r = headerIdx + 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row) continue;
    const sku = iSku >= 0 ? norm(row[iSku]) : '';
    if (!sku) continue;
    const m = sku.match(/(\d{1,4})\s*$/);
    const suffix = (m ? m[1] : '0').padStart(4, '0').slice(-4);
    const wt = iWt >= 0 ? Number(String(row[iWt]).replace(/,/g, '').trim()) : NaN;
    const cnt = iCnt >= 0 ? Number(String(row[iCnt]).replace(/,/g, '').trim()) : NaN;
    out.push({
      sku,
      suffix,
      unitName: iName >= 0 ? norm(row[iName]) : '',
      type: iType >= 0 ? norm(row[iType]) : '',
      height: iH >= 0 ? Number(row[iH]) || undefined : undefined,
      width: iW >= 0 ? Number(row[iW]) || undefined : undefined,
      weight: Number.isFinite(wt) ? wt : undefined,
      count: Number.isFinite(cnt) ? cnt : undefined,
    });
  }
  return out;
}

export function getStationStats() {
  const allItems = Object.values(PROJECT_ITEMS).flat();
  return STATIONS.map(s => ({
    ...s,
    active: allItems.filter(i => i.currentStation === s.id && i.status === 'in_progress').length,
    completed: allItems.filter(i => i.stationHistory.some(h => h.station === s.id && h.result === 'pass')).length,
    rejected: allItems.filter(i => i.stationHistory.some(h => h.station === s.id && h.result === 'fail')).length,
  }));
}

export function updateItemStatus(projectId: string, itemId: string, newStatus: ItemStatus) {
  const items = PROJECT_ITEMS[projectId];
  if (!items) return;
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  item.status = newStatus;
  if (newStatus === 'completed') item.qcApproved = true;
  if (newStatus === 'rejected') item.qcApproved = false;

  const project = PROJECTS.find(p => p.id === projectId);
  if (project) {
    project.completedItems = items.filter(i => i.status === 'completed').length;
  }
  persistUserProjects();
}

export type QcStatus = 'not_checked' | 'approved' | 'failed';

export function updateItemQc(projectId: string, itemId: string, qc: QcStatus) {
  const items = PROJECT_ITEMS[projectId];
  if (!items) return;
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  if (qc === 'approved') {
    item.qcApproved = true;
    item.stationHistory = item.stationHistory.filter(h => h.result !== 'fail');
  } else if (qc === 'failed') {
    item.qcApproved = false;
    if (!item.stationHistory.some(h => h.result === 'fail')) {
      item.stationHistory.push({
        station: item.currentStation || 'cnc',
        timestamp: new Date().toISOString(),
        result: 'fail',
        notes: 'סומן כנכשל ידנית',
      });
    }
  } else {
    item.qcApproved = false;
    item.stationHistory = item.stationHistory.filter(h => h.result !== 'fail');
  }
}