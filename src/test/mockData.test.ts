import { describe, it, expect, beforeEach } from "vitest";
import {
  PROJECTS, PROJECT_ITEMS, STATIONS, addProject,
  updateItemStatus, getStationStats,
} from "@/data/mockData";

// ─── STATIONS ────────────────────────────────────────────────────────────────
describe("STATIONS", () => {
  it("has 6 production stations in correct order", () => {
    expect(STATIONS).toHaveLength(6);
    expect(STATIONS.map(s => s.id)).toEqual(["cnc","frames","glazing","finishes","windows","vitrines"]);
  });

  it("each station has id, name and order", () => {
    STATIONS.forEach(s => {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(typeof s.order).toBe("number");
    });
  });

  it("orders are sequential starting from 1", () => {
    const orders = STATIONS.map(s => s.order);
    expect(orders).toEqual([1,2,3,4,5,6]);
  });
});

// ─── PROJECTS ────────────────────────────────────────────────────────────────
describe("PROJECTS", () => {
  it("has at least 2 initial projects", () => {
    expect(PROJECTS.length).toBeGreaterThanOrEqual(2);
  });

  it("every project has required fields", () => {
    PROJECTS.forEach(p => {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.sides).toBeInstanceOf(Array);
      expect(p.floors).toBeInstanceOf(Array);
      expect(p.totalItems).toBeGreaterThan(0);
      expect(p.completedItems).toBeGreaterThanOrEqual(0);
      expect(p.completedItems).toBeLessThanOrEqual(p.totalItems);
    });
  });

  it("project status is one of the valid values", () => {
    const valid = ["active","completed","on_hold"];
    PROJECTS.forEach(p => expect(valid).toContain(p.status));
  });
});

// ─── PROJECT_ITEMS ────────────────────────────────────────────────────────────
describe("PROJECT_ITEMS", () => {
  it("each project has items", () => {
    PROJECTS.forEach(p => {
      const items = PROJECT_ITEMS[p.id];
      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThan(0);
    });
  });

  it("item count matches project.totalItems", () => {
    PROJECTS.forEach(p => {
      expect(PROJECT_ITEMS[p.id].length).toBe(p.totalItems);
    });
  });

  it("all barcodes are unique within a project", () => {
    PROJECTS.forEach(p => {
      const barcodes = PROJECT_ITEMS[p.id].map(i => i.barcode);
      expect(new Set(barcodes).size).toBe(barcodes.length);
    });
  });

  it("barcodes follow ALM-XXX-NNNNN pattern", () => {
    const pattern = /^ALM-[A-Z]{3}-\d{5}$/;
    PROJECTS.forEach(p => {
      PROJECT_ITEMS[p.id].forEach(item => {
        expect(item.barcode).toMatch(pattern);
      });
    });
  });

  it("item status is one of valid values", () => {
    const valid = ["pending","in_progress","completed","rejected"];
    PROJECTS.forEach(p => {
      PROJECT_ITEMS[p.id].forEach(item => {
        expect(valid).toContain(item.status);
      });
    });
  });

  it("completed items have qcApproved=true", () => {
    PROJECTS.forEach(p => {
      PROJECT_ITEMS[p.id]
        .filter(i => i.status === "completed")
        .forEach(i => expect(i.qcApproved).toBe(true));
    });
  });

  it("items have valid floor and unit numbers", () => {
    PROJECTS.forEach(p => {
      const project = PROJECTS.find(pr => pr.id === p.id)!;
      PROJECT_ITEMS[p.id].forEach(item => {
        expect(project.floors).toContain(item.floor);
        expect(item.unit).toBeGreaterThanOrEqual(1);
      });
    });
  });

  it("station history contains only valid station IDs", () => {
    const stationIds = STATIONS.map(s => s.id);
    PROJECTS.forEach(p => {
      PROJECT_ITEMS[p.id].forEach(item => {
        item.stationHistory.forEach(h => {
          expect(stationIds).toContain(h.station);
          expect(["pass","fail"]).toContain(h.result);
        });
      });
    });
  });
});

// ─── updateItemStatus ─────────────────────────────────────────────────────────
describe("updateItemStatus", () => {
  it("changes the item status", () => {
    const projectId = PROJECTS[0].id;
    const item = PROJECT_ITEMS[projectId][0];
    const originalStatus = item.status;
    const newStatus = originalStatus === "completed" ? "pending" : "completed";
    updateItemStatus(projectId, item.id, newStatus);
    expect(item.status).toBe(newStatus);
    // restore
    updateItemStatus(projectId, item.id, originalStatus);
  });

  it("sets qcApproved=true when status is completed", () => {
    const projectId = PROJECTS[0].id;
    const item = PROJECT_ITEMS[projectId][0];
    updateItemStatus(projectId, item.id, "completed");
    expect(item.qcApproved).toBe(true);
  });

  it("sets qcApproved=false when status is rejected", () => {
    const projectId = PROJECTS[0].id;
    const item = PROJECT_ITEMS[projectId][0];
    updateItemStatus(projectId, item.id, "rejected");
    expect(item.qcApproved).toBe(false);
  });

  it("updates project completedItems count", () => {
    const projectId = PROJECTS[0].id;
    const project = PROJECTS.find(p => p.id === projectId)!;
    const pendingItem = PROJECT_ITEMS[projectId].find(i => i.status === "pending");
    if (!pendingItem) return; // skip if no pending items
    const before = project.completedItems;
    updateItemStatus(projectId, pendingItem.id, "completed");
    expect(project.completedItems).toBeGreaterThan(before);
    // restore
    updateItemStatus(projectId, pendingItem.id, "pending");
  });

  it("does nothing for unknown projectId", () => {
    expect(() => updateItemStatus("non-existent-project", "any-id", "completed")).not.toThrow();
  });

  it("does nothing for unknown itemId", () => {
    const projectId = PROJECTS[0].id;
    expect(() => updateItemStatus(projectId, "non-existent-item", "completed")).not.toThrow();
  });
});

// ─── addProject ───────────────────────────────────────────────────────────────
describe("addProject", () => {
  it("creates a project and adds it to PROJECTS", () => {
    const before = PROJECTS.length;
    addProject({
      name: "Test Tower",
      description: "Test",
      sides: ["S-South","S-North"],
      floors: [1,2,3],
      unitsPerFloor: { "S-South": 5, "S-North": 3 },
    });
    expect(PROJECTS.length).toBe(before + 1);
  });

  it("generates the correct number of items", () => {
    const p = addProject({
      name: "Item Count Test",
      description: "",
      sides: ["S-East"],
      floors: [1,2],
      unitsPerFloor: { "S-East": 4 },
    });
    // 1 side × 2 floors × 4 units = 8 items
    expect(PROJECT_ITEMS[p.id].length).toBe(8);
    expect(p.totalItems).toBe(8);
  });

  it("new project items have status=pending", () => {
    const p = addProject({
      name: "Status Test",
      description: "",
      sides: ["S-West"],
      floors: [5],
      unitsPerFloor: { "S-West": 2 },
    });
    PROJECT_ITEMS[p.id].forEach(item => {
      expect(item.status).toBe("pending");
      expect(item.qcApproved).toBe(false);
      expect(item.stationHistory).toHaveLength(0);
    });
  });
});

// ─── getStationStats ──────────────────────────────────────────────────────────
describe("getStationStats", () => {
  it("returns stats for all stations", () => {
    const stats = getStationStats();
    expect(stats).toHaveLength(STATIONS.length);
  });

  it("active + completed + rejected are non-negative", () => {
    const stats = getStationStats();
    stats.forEach(s => {
      expect(s.active).toBeGreaterThanOrEqual(0);
      expect(s.completed).toBeGreaterThanOrEqual(0);
      expect(s.rejected).toBeGreaterThanOrEqual(0);
    });
  });
});