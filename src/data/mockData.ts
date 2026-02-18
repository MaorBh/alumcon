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
}

const sides = ['S-South', 'S-East', 'S-North', 'S-West'];
const floors = Array.from({ length: 13 }, (_, i) => 21 + i); // 21-33

function generateItems(projectId: string): ProjectItem[] {
  const items: ProjectItem[] = [];
  let itemIdx = 0;

  for (const side of sides) {
    const unitsPerFloor = side === 'S-South' ? 15 : side === 'S-West' ? 10 : side === 'S-East' ? 12 : 8;
    for (const floor of floors) {
      for (let unit = 1; unit <= unitsPerFloor; unit++) {
        itemIdx++;
        const stationProgress = Math.floor(Math.random() * 7); // 0-6
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

export function addProject(config: {
  name: string;
  description: string;
  sides: string[];
  floors: number[];
  unitsPerFloor: Record<string, number>;
}) {
  const id = config.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
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
  };

  // Generate empty items for the project
  const items: ProjectItem[] = [];
  let idx = 0;
  for (const side of config.sides) {
    const units = config.unitsPerFloor[side] || 1;
    for (const floor of config.floors) {
      for (let unit = 1; unit <= units; unit++) {
        idx++;
        items.push({
          id: `${id}-${idx}`,
          barcode: `ALM-${id.slice(0, 3).toUpperCase()}-${String(idx).padStart(5, '0')}`,
          type: 'חלון',
          floor,
          unit,
          side,
          status: 'pending',
          currentStation: null,
          stationHistory: [],
          qcApproved: false,
        });
      }
    }
  }

  project.totalItems = items.length;
  PROJECT_ITEMS[id] = items;
  PROJECTS.push(project);
  return project;
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
