// User management store (localStorage-backed mock).
// Three roles: admin, qc, worker.

export type AppRole = "admin" | "qc" | "worker";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "מנהל",
  qc: "בקר איכות",
  worker: "עובד",
};

export interface AppUser {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: AppRole;
  active: boolean;
  createdAt: string;
}

const STORAGE_KEY = "app-users";
const SESSION_KEY = "app-current-user";

const DEFAULT_USERS: AppUser[] = [
  {
    id: "u-admin",
    username: "admin",
    password: "admin",
    displayName: "מנהל המערכת",
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-qc1",
    username: "qc1",
    password: "1234",
    displayName: "בקר איכות 1",
    role: "qc",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-worker1",
    username: "worker1",
    password: "1234",
    displayName: "עובד ייצור",
    role: "worker",
    active: true,
    createdAt: new Date().toISOString(),
  },
];

function load(): AppUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    return JSON.parse(raw) as AppUser[];
  } catch {
    return DEFAULT_USERS;
  }
}

function save(users: AppUser[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  window.dispatchEvent(new Event("app-users-changed"));
}

export function listUsers(): AppUser[] {
  return load();
}

export function createUser(input: Omit<AppUser, "id" | "createdAt">): AppUser {
  const users = load();
  if (users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
    throw new Error("שם משתמש כבר קיים");
  }
  const user: AppUser = {
    ...input,
    id: `u-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  save([...users, user]);
  return user;
}

export function updateUser(id: string, patch: Partial<Omit<AppUser, "id" | "createdAt">>) {
  const users = load();
  const next = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
  save(next);
}

export function deleteUser(id: string) {
  const users = load().filter((u) => u.id !== id);
  save(users);
}

export function login(username: string, password: string): AppUser | null {
  const users = load();
  const u = users.find(
    (x) =>
      x.username.toLowerCase() === username.toLowerCase().trim() &&
      x.password === password &&
      x.active,
  );
  if (!u) return null;
  localStorage.setItem(SESSION_KEY, u.id);
  window.dispatchEvent(new Event("app-auth-changed"));
  return u;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("app-auth-changed"));
}

export function getCurrentUser(): AppUser | null {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return load().find((u) => u.id === id) ?? null;
}
