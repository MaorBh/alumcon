import { describe, it, expect, beforeEach } from "vitest";
import { login, logout, getCurrentUser, SCAN_USERS } from "@/scan/scanAuth";

function clearStorage() { localStorage.removeItem("scan-current-user"); }

describe("scanAuth.ts — scan login system", () => {
  beforeEach(() => clearStorage());

  it("SCAN_USERS contains one entry per station", () => {
    const stationUsers = SCAN_USERS.filter(u => u.role === "station");
    expect(stationUsers.length).toBe(6); // 6 stations
  });

  it("each station user has a matching stationId", () => {
    SCAN_USERS.filter(u => u.role === "station").forEach(u => {
      expect(u.stationId).toBeTruthy();
    });
  });

  it("QC users have role=qc and no stationId", () => {
    SCAN_USERS.filter(u => u.role === "qc").forEach(u => {
      expect(u.stationId).toBeUndefined();
    });
  });

  describe("login", () => {
    it("returns user for valid credentials", () => {
      const u = login("cnc", "1234");
      expect(u).not.toBeNull();
      expect(u!.role).toBe("station");
      expect(u!.stationId).toBe("cnc");
    });

    it("returns null for wrong password", () => {
      expect(login("cnc", "wrong")).toBeNull();
    });

    it("returns null for unknown username", () => {
      expect(login("ghost", "1234")).toBeNull();
    });

    it("is case-insensitive for username", () => {
      expect(login("QC1", "1234")).not.toBeNull();
    });

    it("saves user to localStorage", () => {
      login("qc1", "1234");
      expect(localStorage.getItem("scan-current-user")).not.toBeNull();
    });
  });

  describe("getCurrentUser", () => {
    it("returns null when not logged in", () => {
      expect(getCurrentUser()).toBeNull();
    });

    it("returns correct user after login", () => {
      login("qc1", "1234");
      const u = getCurrentUser();
      expect(u).not.toBeNull();
      expect(u!.username).toBe("qc1");
    });
  });

  describe("logout", () => {
    it("clears localStorage", () => {
      login("qc1", "1234");
      logout();
      expect(localStorage.getItem("scan-current-user")).toBeNull();
    });

    it("getCurrentUser returns null after logout", () => {
      login("qc1", "1234");
      logout();
      expect(getCurrentUser()).toBeNull();
    });
  });
});