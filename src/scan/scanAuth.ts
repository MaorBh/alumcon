import { StationId, STATIONS } from "@/data/mockData";

export type ScanRole = "station" | "qc";

export interface ScanUser {
  username: string;
  password: string;
  displayName: string;
  role: ScanRole;
  stationId?: StationId; // only for role=station
}

// Mock users - one per station + QC users
export const SCAN_USERS: ScanUser[] = [
  ...STATIONS.map<ScanUser>((s) => ({
    username: s.id,
    password: "1234",
    displayName: `מפעיל ${s.name}`,
    role: "station",
    stationId: s.id,
  })),
  { username: "qc1", password: "1234", displayName: "בקר איכות 1", role: "qc" },
  { username: "qc2", password: "1234", displayName: "בקר איכות 2", role: "qc" },
];

const STORAGE_KEY = "scan-current-user";

export function getCurrentUser(): ScanUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScanUser;
  } catch {
    return null;
  }
}

export function login(username: string, password: string): ScanUser | null {
  const u = SCAN_USERS.find(
    (x) => x.username.toLowerCase() === username.toLowerCase().trim() && x.password === password,
  );
  if (!u) return null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  return u;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}
