import { describe, it, expect, beforeEach } from "vitest";
import {
  findItemByBarcode, getProjectName, getStationName,
  recordStationScan, recordQcScan, SCAN_LOG,
} from "@/scan/scanData";
import { PROJECT_ITEMS, PROJECTS, STATIONS } from "@/data/mockData";

const firstProject = PROJECTS[0];
const firstItem = PROJECT_ITEMS[firstProject.id][0];
const firstStation = STATIONS[0];

describe("scanData.ts — scan engine", () => {

  // ─── findItemByBarcode ────────────────────────────────────────────────────
  describe("findItemByBarcode", () => {
    it("finds an existing item by barcode", () => {
      const result = findItemByBarcode(firstItem.barcode);
      expect(result).not.toBeNull();
      expect(result!.item.barcode).toBe(firstItem.barcode);
      expect(result!.projectId).toBe(firstProject.id);
    });

    it("returns null for unknown barcode", () => {
      expect(findItemByBarcode("ALM-XXX-99999")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(findItemByBarcode("")).toBeNull();
    });

    it("returns null for whitespace only", () => {
      expect(findItemByBarcode("   ")).toBeNull();
    });

    it("trims whitespace from barcode", () => {
      const result = findItemByBarcode("  " + firstItem.barcode + "  ");
      expect(result).not.toBeNull();
    });
  });

  // ─── getProjectName ────────────────────────────────────────────────────────
  describe("getProjectName", () => {
    it("returns project name for valid id", () => {
      expect(getProjectName(firstProject.id)).toBe(firstProject.name);
    });

    it("returns the id itself for unknown project", () => {
      expect(getProjectName("unknown-id")).toBe("unknown-id");
    });
  });

  // ─── getStationName ────────────────────────────────────────────────────────
  describe("getStationName", () => {
    it("returns station name for valid id", () => {
      expect(getStationName("cnc")).toBe("CNC");
    });

    it("returns '-' for null", () => {
      expect(getStationName(null)).toBe("-");
    });

    it("returns '-' for undefined", () => {
      expect(getStationName(undefined)).toBe("-");
    });
  });

  // ─── recordStationScan (pass) ──────────────────────────────────────────────
  describe("recordStationScan — pass", () => {
    it("adds to stationHistory with result=pass", () => {
      const item = { ...firstItem, stationHistory: [], status: "pending" as const };
      const before = item.stationHistory.length;
      recordStationScan({
        item, projectId: firstProject.id, username: "worker1",
        stationId: firstStation.id, passed: true, photos: [],
      });
      expect(item.stationHistory.length).toBe(before + 1);
      expect(item.stationHistory[item.stationHistory.length - 1].result).toBe("pass");
    });

    it("sets item status to in_progress on pass", () => {
      const item = { ...firstItem, stationHistory: [], status: "pending" as const };
      recordStationScan({
        item, projectId: firstProject.id, username: "w1",
        stationId: firstStation.id, passed: true, photos: [],
      });
      expect(item.status).toBe("in_progress");
    });

    it("adds a SCAN_LOG entry on pass", () => {
      const item = { ...firstItem, stationHistory: [], status: "pending" as const };
      const logBefore = SCAN_LOG.length;
      recordStationScan({
        item, projectId: firstProject.id, username: "w1",
        stationId: firstStation.id, passed: true, photos: [],
      });
      expect(SCAN_LOG.length).toBe(logBefore + 1);
      expect(SCAN_LOG[0].action).toBe("station_pass");
    });
  });

  // ─── recordStationScan (fail) ──────────────────────────────────────────────
  describe("recordStationScan — fail", () => {
    it("sets item status to rejected on fail", () => {
      const item = { ...firstItem, stationHistory: [], status: "in_progress" as const };
      recordStationScan({
        item, projectId: firstProject.id, username: "w1",
        stationId: firstStation.id, passed: false, photos: ["data:image/png;base64,abc"],
      });
      expect(item.status).toBe("rejected");
    });

    it("adds history with result=fail", () => {
      const item = { ...firstItem, stationHistory: [], status: "in_progress" as const };
      recordStationScan({
        item, projectId: firstProject.id, username: "w1",
        stationId: firstStation.id, passed: false, photos: [],
      });
      expect(item.stationHistory[item.stationHistory.length - 1].result).toBe("fail");
    });

    it("includes notes in the history record when provided", () => {
      const item = { ...firstItem, stationHistory: [], status: "in_progress" as const };
      recordStationScan({
        item, projectId: firstProject.id, username: "w1",
        stationId: firstStation.id, passed: false, photos: [],
        notes: "פגם גלוי",
      });
      expect(item.stationHistory[item.stationHistory.length - 1].notes).toBe("פגם גלוי");
    });
  });

  // ─── recordQcScan ─────────────────────────────────────────────────────────
  describe("recordQcScan", () => {
    it("qc_final sets status=completed and qcApproved=true", () => {
      const item = { ...firstItem, status: "in_progress" as const, qcApproved: false, stationHistory: [] };
      recordQcScan({
        item, projectId: firstProject.id, username: "qc1",
        action: "qc_final", photos: [],
      });
      expect(item.status).toBe("completed");
      expect(item.qcApproved).toBe(true);
    });

    it("qc_reject sets status=rejected and qcApproved=false", () => {
      const item = { ...firstItem, status: "in_progress" as const, qcApproved: false, stationHistory: [] };
      recordQcScan({
        item, projectId: firstProject.id, username: "qc1",
        action: "qc_reject", photos: [],
      });
      expect(item.status).toBe("rejected");
      expect(item.qcApproved).toBe(false);
    });

    it("qc_pass sets status=in_progress", () => {
      const item = { ...firstItem, status: "pending" as const, qcApproved: false, stationHistory: [] };
      recordQcScan({
        item, projectId: firstProject.id, username: "qc1",
        action: "qc_pass", photos: [],
      });
      expect(item.status).toBe("in_progress");
    });

    it("qc_reject adds fail entry to stationHistory", () => {
      const item = { ...firstItem, status: "in_progress" as const, qcApproved: false, stationHistory: [] };
      recordQcScan({
        item, projectId: firstProject.id, username: "qc1",
        action: "qc_reject", photos: [],
        notes: "ליקוי בזיגוג",
      });
      const lastHist = item.stationHistory[item.stationHistory.length - 1];
      expect(lastHist.result).toBe("fail");
    });

    it("logs each qc action to SCAN_LOG", () => {
      const item = { ...firstItem, status: "in_progress" as const, qcApproved: false, stationHistory: [] };
      const before = SCAN_LOG.length;
      recordQcScan({ item, projectId: firstProject.id, username: "qc1", action: "qc_final", photos: [] });
      expect(SCAN_LOG.length).toBe(before + 1);
      expect(SCAN_LOG[0].action).toBe("qc_final");
    });
  });
});