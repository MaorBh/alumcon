import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  login, logout, getCurrentUser, listUsers,
  createUser, updateUser, deleteUser, AppUser,
} from "@/auth/users";

// localStorage is available in jsdom

function clearStorage() {
  localStorage.removeItem("app-users");
  localStorage.removeItem("app-current-user");
}

describe("users.ts — auth system", () => {
  beforeEach(() => clearStorage());
  afterEach(() => clearStorage());

  // ─── Default users ──────────────────────────────────────────────────────
  describe("listUsers", () => {
    it("seeds default users when storage is empty", () => {
      const users = listUsers();
      expect(users.length).toBeGreaterThanOrEqual(3);
    });

    it("default admin user exists", () => {
      const users = listUsers();
      expect(users.find(u => u.username === "admin")).toBeTruthy();
    });

    it("all default users have required fields", () => {
      listUsers().forEach(u => {
        expect(u.id).toBeTruthy();
        expect(u.username).toBeTruthy();
        expect(u.displayName).toBeTruthy();
        expect(["admin","qc","worker"]).toContain(u.role);
        expect(typeof u.active).toBe("boolean");
      });
    });
  });

  // ─── login ──────────────────────────────────────────────────────────────
  describe("login", () => {
    it("returns user on valid credentials", () => {
      const u = login("admin", "admin");
      expect(u).not.toBeNull();
      expect(u!.username).toBe("admin");
    });

    it("returns null for wrong password", () => {
      expect(login("admin", "wrongpassword")).toBeNull();
    });

    it("returns null for non-existent user", () => {
      expect(login("doesnotexist", "any")).toBeNull();
    });

    it("is case-insensitive for username", () => {
      const u = login("ADMIN", "admin");
      expect(u).not.toBeNull();
    });

    it("trims whitespace from username", () => {
      const u = login("  admin  ", "admin");
      expect(u).not.toBeNull();
    });

    it("stores session in localStorage", () => {
      login("admin", "admin");
      expect(localStorage.getItem("app-current-user")).toBeTruthy();
    });

    it("returns null for inactive user", () => {
      const users = listUsers();
      const admin = users.find(u => u.username === "admin")!;
      updateUser(admin.id, { active: false });
      expect(login("admin", "admin")).toBeNull();
      updateUser(admin.id, { active: true }); // restore
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────────
  describe("logout", () => {
    it("clears session from localStorage", () => {
      login("admin", "admin");
      logout();
      expect(localStorage.getItem("app-current-user")).toBeNull();
    });

    it("getCurrentUser returns null after logout", () => {
      login("admin", "admin");
      logout();
      expect(getCurrentUser()).toBeNull();
    });
  });

  // ─── getCurrentUser ──────────────────────────────────────────────────────
  describe("getCurrentUser", () => {
    it("returns null when not logged in", () => {
      expect(getCurrentUser()).toBeNull();
    });

    it("returns user after login", () => {
      login("admin", "admin");
      const u = getCurrentUser();
      expect(u).not.toBeNull();
      expect(u!.username).toBe("admin");
    });
  });

  // ─── createUser ──────────────────────────────────────────────────────────
  describe("createUser", () => {
    it("adds a new user", () => {
      const before = listUsers().length;
      createUser({ username: "newuser", password: "pass", displayName: "New User", role: "worker", active: true });
      expect(listUsers().length).toBe(before + 1);
    });

    it("new user can log in", () => {
      createUser({ username: "testworker", password: "secret", displayName: "Test", role: "worker", active: true });
      expect(login("testworker", "secret")).not.toBeNull();
    });

    it("throws on duplicate username", () => {
      expect(() => createUser({ username: "admin", password: "x", displayName: "Dup", role: "worker", active: true }))
        .toThrow("שם משתמש כבר קיים");
    });

    it("username uniqueness is case-insensitive", () => {
      expect(() => createUser({ username: "ADMIN", password: "x", displayName: "Dup", role: "worker", active: true }))
        .toThrow();
    });
  });

  // ─── updateUser ──────────────────────────────────────────────────────────
  describe("updateUser", () => {
    it("updates displayName", () => {
      const admin = listUsers().find(u => u.username === "admin")!;
      updateUser(admin.id, { displayName: "Super Admin" });
      const updated = listUsers().find(u => u.id === admin.id)!;
      expect(updated.displayName).toBe("Super Admin");
    });

    it("can deactivate a user", () => {
      const admin = listUsers().find(u => u.username === "admin")!;
      updateUser(admin.id, { active: false });
      expect(listUsers().find(u => u.id === admin.id)!.active).toBe(false);
    });
  });

  // ─── deleteUser ──────────────────────────────────────────────────────────
  describe("deleteUser", () => {
    it("removes user from list", () => {
      createUser({ username: "todelete", password: "x", displayName: "Del", role: "worker", active: true });
      const u = listUsers().find(u => u.username === "todelete")!;
      deleteUser(u.id);
      expect(listUsers().find(u => u.username === "todelete")).toBeUndefined();
    });

    it("deleted user cannot log in", () => {
      createUser({ username: "willbegone", password: "abc", displayName: "Gone", role: "worker", active: true });
      const u = listUsers().find(u => u.username === "willbegone")!;
      deleteUser(u.id);
      expect(login("willbegone", "abc")).toBeNull();
    });
  });
});