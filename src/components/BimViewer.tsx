import { useEffect, useRef, useState, useCallback } from "react";
import { ProjectItem, ItemStatus } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";

declare global {
  interface Window {
    Autodesk: any;
    THREE: any;
  }
}

const STATUS_COLORS: Record<ItemStatus, [number, number, number, number]> = {
  pending:     [0.60, 0.60, 0.60, 1],
  in_progress: [0.98, 0.75, 0.18, 1],
  completed:   [0.28, 0.76, 0.24, 1],
  rejected:    [0.90, 0.22, 0.22, 1],
};

const COLOR_SELECTED: [number, number, number, number] = [0.02, 0.80, 0.95, 1];

const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: "ממתין",
  in_progress: "בתהליך",
  completed: "הושלם",
  rejected: "נפסל",
};

interface BimViewerProps {
  projectId: string;
  items: ProjectItem[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  onStatusChange: (itemId: string, newStatus: ItemStatus) => void;
  activeSide?: string;
  selectedFloor?: number | null;
}

export default function BimViewer({
  projectId,
  items,
  selectedItemId,
  onSelectItem,
  onStatusChange,
  activeSide,
  selectedFloor,
}: BimViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const nameToDbId = useRef<Record<string, number>>({});
  const dbIdToItemId = useRef<Record<number, string>>({});
  const itemIdToDbId = useRef<Record<string, number>>({});

  const [urn, setUrn] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<ProjectItem | null>(null);

  // Load URN for project
  useEffect(() => {
    fetch(`/api/project-urn/${projectId}`)
      .then((r) => r.json())
      .then((d) => { if (d.urn) setUrn(d.urn); })
      .catch(console.error);
  }, [projectId]);

  // Load viewer script + init
  useEffect(() => {
    if (!urn) return;

    function init() {
      if (viewerRef.current) {
        loadModel(urn!);
        return;
      }
      fetch("/api/token")
        .then((r) => r.json())
        .then(({ access_token }) => {
          window.Autodesk.Viewing.Initializer(
            { env: "AutodeskProduction2", api: "streamingV2", accessToken: access_token },
            () => {
              if (!containerRef.current) return;
              const v = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current, {
                extensions: ["Autodesk.DefaultTools.NavTools"],
              });
              v.start();
              v.setBackgroundColor(22, 26, 32, 22, 26, 32);
              viewerRef.current = v;
              loadModel(urn!);
            }
          );
        });
    }

    if (window.Autodesk) {
      init();
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
    script.onload = init;
    document.head.appendChild(script);
  }, [urn]);

  // Re-apply colors when items change
  useEffect(() => {
    if (viewerLoaded && viewerRef.current && modelRef.current) {
      applyColors();
    }
  }, [items, viewerLoaded]);

  // Highlight selected item
  useEffect(() => {
    if (!viewerLoaded || !viewerRef.current || !modelRef.current || !selectedItemId) return;
    const dbId = itemIdToDbId.current[selectedItemId];
    if (dbId) {
      viewerRef.current.setThemingColor(
        dbId,
        new window.THREE.Vector4(...COLOR_SELECTED),
        modelRef.current
      );
      viewerRef.current.fitToView([dbId], modelRef.current);
    }
    const item = items.find((i) => i.id === selectedItemId);
    if (item) setDetailItem(item);
  }, [selectedItemId, viewerLoaded]);

  function loadModel(modelUrn: string) {
    setTranslating(true);
    setMessage("בודק סטטוס המרה...");
    pollTranslation(modelUrn);
  }

  async function pollTranslation(modelUrn: string) {
    try {
      const resp = await fetch(`/api/translate-status/${encodeURIComponent(modelUrn)}`);
      const status = await resp.json();

      if (status.status === "success") {
        setTranslating(false);
        setMessage("");
        startLoadingModel(modelUrn);
      } else if (status.status === "failed") {
        setTranslating(false);
        setMessage("שגיאה בהמרה");
      } else {
        const pct = parseInt(status.progress) || 0;
        setProgress(pct);
        setMessage(`ממיר מודל... ${pct}%`);
        setTimeout(() => pollTranslation(modelUrn), 4000);
      }
    } catch {
      setMessage("שגיאה בבדיקת סטטוס");
      setTranslating(false);
    }
  }

  function startLoadingModel(modelUrn: string) {
    const viewer = viewerRef.current;
    if (!viewer) return;

    window.Autodesk.Viewing.Document.load(
      `urn:${modelUrn}`,
      (doc: any) => {
        const root = doc.getRoot();
        const views3d = root.search({ type: "geometry", role: "3d" });
        const views2d = root.search({ type: "geometry", role: "2d" });
        const view = views3d[0] || views2d[0] || root.getDefaultGeometry();

        viewer.loadDocumentNode(doc, view).then((model: any) => {
          modelRef.current = model;
          viewer.addEventListener(
            window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
            () => {
              buildMappings(viewer, model);
              setViewerLoaded(true);
            }
          );
        });
      },
      (err: any) => {
        console.error("Document load error:", err);
        setMessage("שגיאה בטעינת המודל");
      }
    );
  }

  function buildMappings(viewer: any, model: any) {
    model.getBulkProperties(
      null,
      ["Name", "IfcGUID", "GlobalId", "IFCGuid"],
      (results: any[]) => {
        nameToDbId.current = {};
        dbIdToItemId.current = {};
        itemIdToDbId.current = {};

        const propMap: Record<number, string[]> = {};
        results.forEach(({ dbId, properties }: any) => {
          const vals: string[] = [];
          properties.forEach(({ displayValue }: any) => {
            if (displayValue) {
              const v = String(displayValue).trim();
              nameToDbId.current[v] = dbId;
              vals.push(v);
            }
          });
          propMap[dbId] = vals;
        });

        items.forEach((item) => {
          const searchKeys = [item.barcode, item.id, `${item.side}-${item.floor}-${item.unit}`];
          for (const key of searchKeys) {
            if (nameToDbId.current[key]) {
              const dbId = nameToDbId.current[key];
              dbIdToItemId.current[dbId] = item.id;
              itemIdToDbId.current[item.id] = dbId;
              break;
            }
          }
        });

        console.log(`BIM: mapped ${Object.keys(itemIdToDbId.current).length} items to model elements`);
        applyColors();
        setupClickHandler(viewer);
      },
      (err: any) => console.error("buildMappings error:", err)
    );
  }

  function applyColors() {
    const viewer = viewerRef.current;
    const model = modelRef.current;
    if (!viewer || !model) return;

    viewer.clearThemingColors(model);

    items.forEach((item) => {
      const dbId = itemIdToDbId.current[item.id];
      if (!dbId) return;
      const rgba = STATUS_COLORS[item.status];
      viewer.setThemingColor(dbId, new window.THREE.Vector4(...rgba), model);
    });

    // Re-highlight multi-selected
    multiSelected.forEach((itemId) => {
      const dbId = itemIdToDbId.current[itemId];
      if (dbId) {
        viewer.setThemingColor(dbId, new window.THREE.Vector4(...COLOR_SELECTED), model);
      }
    });
  }

  let _handlerSet = false;
  function setupClickHandler(viewer: any) {
    if (_handlerSet) return;
    _handlerSet = true;

    viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (e: any) => {
      const selected = e.dbIdArray || [];
      if (selected.length === 0) return;

      const itemId = dbIdToItemId.current[selected[0]];
      if (itemId) {
        onSelectItem(itemId);
        const item = items.find((i) => i.id === itemId);
        if (item) setDetailItem(item);
      }
    });
  }

  function toggleMultiSelect(itemId: string) {
    setMultiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function bulkChangeStatus(newStatus: ItemStatus) {
    multiSelected.forEach((itemId) => onStatusChange(itemId, newStatus));
    setMultiSelected(new Set());
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(`מעלה ${file.name}...`);
    setProgress(0);

    const formData = new FormData();
    formData.append("model", file);

    try {
      const xhr = new XMLHttpRequest();
      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.open("POST", `/api/upload-model/${projectId}`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 100);
            setProgress(pct);
            setMessage(`מעלה ${file.name}... ${pct}%`);
          }
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.urn) resolve(data.urn);
            else reject(new Error(data.error || "Upload failed"));
          } catch (err) {
            reject(err);
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });

      const newUrn = await uploadPromise;
      setUrn(newUrn);
      setUploading(false);
      setMessage("הועלה! מתחיל המרה...");
    } catch (err: any) {
      setMessage("שגיאה: " + err.message);
      setUploading(false);
    }
    e.target.value = "";
  }

  // ── No URN: upload prompt ──
  if (!urn) {
    return (
      <div className="glass-card flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-6xl font-bold text-primary/20">BIM</div>
        <h3 className="text-lg font-semibold">אין מודל BIM לפרויקט זה</h3>
        <p className="text-sm text-muted-foreground">
          העלה קובץ RVT, STP או IFC כדי להתחיל
        </p>
        <label className="cursor-pointer bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          {uploading ? message : "העלה קובץ BIM"}
          <input
            type="file"
            accept=".rvt,.stp,.step,.ifc,.dwg,.ipt,.iam"
            className="hidden"
            onChange={handleUpload}
          />
        </label>
        {uploading && (
          <div className="w-64 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Viewer with sidebar ──
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Viewer */}
      <div className="lg:col-span-2">
        <div
          className="glass-card overflow-hidden relative"
          style={{ height: "600px" }}
        >
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

          {/* Translation bar */}
          {(translating || uploading) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur border border-border rounded-lg px-4 py-2 flex items-center gap-3 z-10">
              <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{message}</span>
            </div>
          )}

          {/* Replace model button */}
          <label className="absolute top-3 left-3 cursor-pointer bg-secondary/80 hover:bg-secondary backdrop-blur border border-border rounded-lg px-3 py-1.5 text-xs font-medium transition-colors z-10">
            החלף מודל
            <input
              type="file"
              accept=".rvt,.stp,.step,.ifc,.dwg,.ipt,.iam"
              className="hidden"
              onChange={handleUpload}
            />
          </label>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur border border-border rounded-lg px-3 py-2 z-10">
            <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
              מקרא
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {(Object.entries(STATUS_LABELS) as [ItemStatus, string][]).map(
                ([status, label]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{
                        backgroundColor: `rgba(${STATUS_COLORS[status]
                          .slice(0, 3)
                          .map((c) => Math.round(c * 255))
                          .join(",")}, 1)`,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {label}
                    </span>
                  </div>
                )
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: `rgba(5,204,242,1)` }}
                />
                <span className="text-[10px] text-muted-foreground">נבחר</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Multi select bar */}
        {multiSelected.size > 0 && (
          <div className="glass-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {multiSelected.size} נבחרו
              </span>
              <button
                className="text-xs text-destructive hover:underline"
                onClick={() => setMultiSelected(new Set())}
              >
                נקה
              </button>
            </div>
            <p className="text-xs text-muted-foreground">שנה סטטוס לכולן:</p>
            <div className="flex flex-wrap gap-1">
              {(
                ["pending", "in_progress", "completed", "rejected"] as ItemStatus[]
              ).map((s) => (
                <button
                  key={s}
                  className="text-[11px] px-2 py-1 rounded bg-secondary hover:bg-secondary/80 border border-border transition-colors"
                  onClick={() => bulkChangeStatus(s)}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detail panel */}
        <div className="glass-card p-4">
          <h3 className="font-semibold text-sm mb-3">פרטי פריט</h3>
          {detailItem ? (
            <div className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ברקוד</span>
                  <span className="font-mono text-xs">{detailItem.barcode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סוג</span>
                  <span>{detailItem.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">חזית</span>
                  <span>{detailItem.side}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">קומה</span>
                  <span className="font-inter">{detailItem.floor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">יחידה</span>
                  <span className="font-inter">{detailItem.unit}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">סטטוס</span>
                  <StatusBadge status={detailItem.status} />
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">שנה סטטוס:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    ["pending", "in_progress", "completed", "rejected"] as ItemStatus[]
                  ).map((s) => (
                    <button
                      key={s}
                      className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                        detailItem.status === s
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => {
                        onStatusChange(detailItem.id, s);
                        setDetailItem({ ...detailItem, status: s });
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              לחץ על אלמנט במודל לפרטים
            </p>
          )}
        </div>

        {/* Item list */}
        <div className="glass-card p-4">
          <h3 className="font-semibold text-sm mb-2">רשימת פריטים</h3>
          <div className="max-h-[280px] overflow-y-auto space-y-1">
            {items
              .filter(
                (i) =>
                  (!activeSide || activeSide === i.side) &&
                  (!selectedFloor || selectedFloor === i.floor)
              )
              .slice(0, 100)
              .map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    selectedItemId === item.id
                      ? "bg-primary/15 ring-1 ring-primary/40"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => onSelectItem(item.id)}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: `rgba(${STATUS_COLORS[item.status]
                        .slice(0, 3)
                        .map((c) => Math.round(c * 255))
                        .join(",")}, 1)`,
                    }}
                  />
                  <span className="font-mono truncate">{item.barcode}</span>
                  <span className="text-muted-foreground mr-auto">{item.type}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}