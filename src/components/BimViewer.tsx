import { useEffect, useRef, useState, useCallback } from "react";
import { ProjectItem, ItemStatus } from "@/data/mockData";
import { API_URL } from "@/config";
import StatusBadge from "@/components/StatusBadge";

declare global {
  interface Window { Autodesk: any; THREE: any; }
}

const STATUS_COLORS: Record<ItemStatus, [number, number, number, number]> = {
  pending:     [0.55, 0.55, 0.55, 1],
  in_progress: [0.98, 0.78, 0.18, 1],
  completed:   [0.22, 0.76, 0.30, 1],
  rejected:    [0.88, 0.20, 0.20, 1],
};
const COLOR_SELECTED: [number, number, number, number] = [0.02, 0.82, 0.96, 1];
const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: "ממתין", in_progress: "בתהליך", completed: "הושלם", rejected: "נפסל",
};
const STATUS_BG: Record<ItemStatus, string> = {
  pending: "bg-muted/80 text-muted-foreground",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

interface AvailableModel { bucket: string; name: string; urn: string; sizeMB: number; }

interface ModelElement {
  dbId: number;
  name: string;
  category: string;
  externalId?: string;
  properties: { displayName: string; displayValue: string | number }[];
  status: ItemStatus;
}

interface BimViewerProps {
  projectId: string; items: ProjectItem[]; selectedItemId: string | null;
  onSelectItem: (itemId: string) => void; onStatusChange: (itemId: string, newStatus: ItemStatus) => void;
  activeSide?: string; selectedFloor?: number | null;
}

function getLocalUrn(pid: string) { try { return localStorage.getItem("bim_urn_" + pid); } catch { return null; } }
function setLocalUrn(pid: string, urn: string) { try { localStorage.setItem("bim_urn_" + pid, urn); } catch {} }
function getLocalStatuses(pid: string): Record<number, ItemStatus> {
  try { return JSON.parse(localStorage.getItem("bim_statuses_" + pid) || "{}"); } catch { return {}; }
}
function saveLocalStatuses(pid: string, s: Record<number, ItemStatus>) {
  try { localStorage.setItem("bim_statuses_" + pid, JSON.stringify(s)); } catch {}
}

export default function BimViewer({ projectId, items, selectedItemId, onSelectItem, onStatusChange, activeSide, selectedFloor }: BimViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const modelRef = useRef<any>(null);

  // Element status tracking (keyed by dbId — works for ALL elements, not just mapped ones)
  const elementStatusRef = useRef<Record<number, ItemStatus>>(getLocalStatuses(projectId));

  // dbId <-> itemId mapping (best-effort for pre-loaded project items)
  const dbIdToItemId = useRef<Record<number, string>>({});
  const itemIdToDbId = useRef<Record<string, number>>({});
  const handlerSetRef = useRef(false);

  const [urn, setUrn] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [translating, setTranslating] = useState(false);
  const [transProgress, setTransProgress] = useState(0);
  const [transMsg, setTransMsg] = useState("");
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [activeElement, setActiveElement] = useState<ModelElement | null>(null);
  const activeDbIdRef = useRef<number | null>(null);
  const [, forceRepaint] = useState(0);

  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [manualUrn, setManualUrn] = useState("");

  // ─── URN loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    const localUrn = getLocalUrn(projectId);
    if (localUrn) setUrn(localUrn);
    fetch(API_URL + "/api/project-urn/" + projectId)
      .then(r => r.json())
      .then(d => {
        if (d.urn) { setUrn(d.urn); setLocalUrn(projectId, d.urn); }
        else if (localUrn) {
          fetch(API_URL + "/api/restore-urn/" + projectId, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urn: localUrn }),
          }).catch(() => {});
        }
      })
      .catch(() => { if (localUrn) setUrn(localUrn); });
  }, [projectId]);

  // ─── Viewer init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!urn) return;
    function init() {
      if (viewerRef.current) { loadModel(urn!); return; }
      fetch(API_URL + "/api/token")
        .then(r => r.json())
        .then(({ access_token }) => {
          if (!access_token) return;
          window.Autodesk.Viewing.Initializer(
            { env: "AutodeskProduction", accessToken: access_token },
            () => {
              if (!containerRef.current) return;
              const v = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current, {});
              v.start();
              v.setBackgroundColor(18, 22, 30, 18, 22, 30);
              viewerRef.current = v;
              loadModel(urn!);
            }
          );
        })
        .catch(console.error);
    }
    if (window.Autodesk) { init(); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
    script.onload = init;
    document.head.appendChild(script);
  }, [urn]);

  // Re-apply colors whenever items change or viewer loads
  useEffect(() => {
    if (viewerLoaded) applyColors();
  }, [items, viewerLoaded]);

  // ─── Color engine ─────────────────────────────────────────────────────────
  function applyColors() {
    const viewer = viewerRef.current;
    const model = modelRef.current;
    if (!viewer || !model) return;
    viewer.clearThemingColors(model);

    // 1. Color items matched by name/barcode
    items.forEach(item => {
      const dbId = itemIdToDbId.current[item.id];
      if (dbId != null) {
        viewer.setThemingColor(dbId, new window.THREE.Vector4(...STATUS_COLORS[item.status]), model);
      }
    });

    // 2. Color elements with manually assigned statuses
    Object.entries(elementStatusRef.current).forEach(([dbId, status]) => {
      viewer.setThemingColor(Number(dbId), new window.THREE.Vector4(...STATUS_COLORS[status]), model);
    });

    // 3. Highlight active selection on top
    if (activeDbIdRef.current != null) {
      viewer.setThemingColor(activeDbIdRef.current, new window.THREE.Vector4(...COLOR_SELECTED), model);
    }
  }

  // ─── Model loading & polling ───────────────────────────────────────────────
  function loadModel(modelUrn: string) {
    setTranslating(true);
    setTransMsg("בודק סטטוס המרה...");
    pollTranslation(modelUrn);
  }

  async function pollTranslation(modelUrn: string) {
    try {
      const resp = await fetch(API_URL + "/api/translate-status/" + encodeURIComponent(modelUrn));
      const s = await resp.json();
      if (s.status === "success") { setTranslating(false); setTransMsg(""); startLoadingModel(modelUrn); }
      else if (s.status === "failed") { setTranslating(false); setTransMsg("שגיאה בהמרה"); }
      else { const pct = parseInt(s.progress) || 0; setTransProgress(pct); setTransMsg("ממיר מודל... " + pct + "%"); setTimeout(() => pollTranslation(modelUrn), 4000); }
    } catch { setTransMsg("שגיאה בבדיקת סטטוס"); setTranslating(false); }
  }

  function startLoadingModel(modelUrn: string) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    window.Autodesk.Viewing.Document.load("urn:" + modelUrn,
      (doc: any) => {
        const root = doc.getRoot();
        const views3d = root.search({ type: "geometry", role: "3d" });
        const view = views3d[0] || root.getDefaultGeometry();
        viewer.loadDocumentNode(doc, view).then((model: any) => {
          modelRef.current = model;
          viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
            buildMappings(viewer, model);
            setViewerLoaded(true);
          });
        });
      },
      (err: any) => { console.error("Load error:", err); setTransMsg("שגיאת טעינה"); }
    );
  }

  // ─── Build item ↔ dbId mappings (best-effort) ─────────────────────────────
  function buildMappings(viewer: any, model: any) {
    model.getBulkProperties(null, ["Name", "Mark", "IfcGUID", "GlobalId", "Tag"],
      (results: any[]) => {
        dbIdToItemId.current = {};
        itemIdToDbId.current = {};
        const propMap: Record<string, number> = {};
        results.forEach(({ dbId, properties }: any) => {
          properties.forEach(({ displayValue }: any) => {
            if (displayValue) propMap[String(displayValue).trim()] = dbId;
          });
        });
        items.forEach(item => {
          for (const key of [item.barcode, item.id]) {
            if (propMap[key] != null) {
              dbIdToItemId.current[propMap[key]] = item.id;
              itemIdToDbId.current[item.id] = propMap[key];
              break;
            }
          }
        });
        applyColors();
        setupClickHandler(viewer, model);
      },
      (err: any) => {
        console.error("buildMappings error:", err);
        setupClickHandler(viewer, model);
      }
    );
  }

  // ─── Click handler — works for ANY element ────────────────────────────────
  function setupClickHandler(viewer: any, model: any) {
    if (handlerSetRef.current) return;
    handlerSetRef.current = true;

    viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (e: any) => {
      const selected: number[] = e.dbIdArray || [];
      if (!selected.length) { setActiveElement(null); activeDbIdRef.current = null; applyColors(); return; }
      const dbId = selected[0];

      // Update selected highlight immediately
      activeDbIdRef.current = dbId;
      applyColors();

      // Get properties from the model
      viewer.getProperties(dbId, (props: any) => {
        const currentStatus: ItemStatus =
          elementStatusRef.current[dbId] ||
          (dbIdToItemId.current[dbId] ? (items.find(i => i.id === dbIdToItemId.current[dbId])?.status || "pending") : "pending");

        const element: ModelElement = {
          dbId,
          name: props.name || "אלמנט #" + dbId,
          category: props.objectid || "",
          externalId: props.externalId,
          properties: (props.properties || [])
            .filter((p: any) => p.displayValue !== "" && p.displayValue != null)
            .slice(0, 12),
          status: currentStatus,
        };
        setActiveElement(element);

        // If this element is mapped to a project item, also notify parent
        const itemId = dbIdToItemId.current[dbId];
        if (itemId) onSelectItem(itemId);
      }, (err: any) => {
        console.error("getProperties error:", err);
        setActiveElement({
          dbId, name: "אלמנט #" + dbId,
          category: "", properties: [],
          status: elementStatusRef.current[dbId] || "pending",
        });
      });
    });
  }

  // ─── Status change for any element ────────────────────────────────────────
  function handleElementStatusChange(dbId: number, newStatus: ItemStatus) {
    elementStatusRef.current[dbId] = newStatus;
    saveLocalStatuses(projectId, elementStatusRef.current);
    setActiveElement(prev => prev ? { ...prev, status: newStatus } : null);
    forceRepaint(n => n + 1);
    applyColors();

    // Also propagate to parent if mapped to a project item
    const itemId = dbIdToItemId.current[dbId];
    if (itemId) onStatusChange(itemId, newStatus);
  }

  // ─── Upload ───────────────────────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); setUploadError(""); setUploadPct(0); setUploadMsg("מעלה " + file.name + "...");
    const formData = new FormData(); formData.append("model", file);
    try {
      const newUrn = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", API_URL + "/api/upload-model/" + projectId);
        xhr.upload.onprogress = ev => {
          if (ev.lengthComputable) { const pct = Math.round(ev.loaded / ev.total * 100); setUploadPct(pct); setUploadMsg("מעלה " + file.name + "... " + pct + "%"); }
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.urn) resolve(data.urn);
            else reject(new Error(data.error || "שגיאת שרת"));
          } catch { reject(new Error("תגובה לא תקינה: " + xhr.responseText.substring(0, 150))); }
        };
        xhr.onerror = () => reject(new Error("שגיאת רשת"));
        xhr.send(formData);
      });
      setLocalUrn(projectId, newUrn); setUrn(newUrn); setUploading(false); setUploadMsg("");
    } catch (err: any) { setUploadError(err.message); setUploading(false); }
    e.target.value = "";
  }

  async function fetchAvailableModels() {
    setLoadingModels(true); setShowModels(true);
    try {
      const resp = await fetch(API_URL + "/api/available-models");
      const data = await resp.json();
      setAvailableModels(data.models || []);
    } catch { setAvailableModels([]); }
    setLoadingModels(false);
  }

  function selectExistingModel(model: AvailableModel) {
    setLocalUrn(projectId, model.urn); setUrn(model.urn); setShowModels(false);
    fetch(API_URL + "/api/restore-urn/" + projectId, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urn: model.urn }),
    }).catch(() => {});
  }

  // ─── No URN splash ────────────────────────────────────────────────────────
  if (!urn) {
    return (
      <div className="glass-card flex flex-col items-center justify-center py-12 gap-4 max-w-lg mx-auto">
        <div className="text-6xl font-bold text-primary/20">BIM</div>
        <h3 className="text-lg font-semibold">אין מודל BIM לפרויקט זה</h3>
        <p className="text-sm text-muted-foreground">העלה קובץ חדש או בחר מדגם קיים</p>

        {uploadError && (
          <div className="w-full bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-xs text-destructive text-right">
            <p className="font-semibold mb-1">שגיאה בהעלאה:</p>
            <p className="font-mono break-all">{uploadError}</p>
          </div>
        )}

        <div className="flex gap-3 flex-wrap justify-center">
          <label className={"cursor-pointer px-6 py-2.5 rounded-lg text-sm font-medium transition-colors " + (uploading ? "bg-primary/50 text-primary-foreground cursor-wait" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
            {uploading ? uploadMsg : "העלה קובץ BIM"}
            <input type="file" accept=".rvt,.stp,.step,.ifc,.dwg,.ipt,.iam" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          <button onClick={fetchAvailableModels} className="px-6 py-2.5 rounded-lg text-sm font-medium bg-secondary border border-border hover:bg-muted transition-colors">
            בחר מדגם קיים
          </button>
        </div>

        {uploading && (
          <div className="w-64 space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: uploadPct + "%" }} /></div>
            <p className="text-xs text-center text-muted-foreground">{uploadMsg}</p>
          </div>
        )}

        {showModels && (
          <div className="w-full border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold">דגמים מתורגמים זמינים</span>
              <button onClick={() => setShowModels(false)} className="text-xs text-muted-foreground hover:text-foreground">סגור</button>
            </div>
            {loadingModels ? (
              <div className="text-center py-6 text-xs text-muted-foreground">טוען רשימה...</div>
            ) : availableModels.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">לא נמצאו דגמים</div>
            ) : (
              <div className="divide-y divide-border max-h-60 overflow-y-auto">
                {availableModels.map((m, i) => (
                  <button key={i} onClick={() => selectExistingModel(m)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-right">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-xs font-medium truncate max-w-[220px]">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground">{m.bucket} · {m.sizeMB} MB</span>
                    </div>
                    <span className="text-xs text-primary font-medium mr-2">טען</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 w-full max-w-sm">
          <input type="text" placeholder="או הזן URN קיים..." value={manualUrn} onChange={e => setManualUrn(e.target.value)}
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
          <button onClick={() => { const u = manualUrn.trim(); if (u) { setLocalUrn(projectId, u); setUrn(u); } }}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs hover:bg-muted transition-colors">טען</button>
        </div>
      </div>
    );
  }

  // ─── Main viewer layout ───────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* ── Viewer ── */}
      <div className="lg:col-span-2">
        <div className="glass-card overflow-hidden relative" style={{ height: "600px" }}>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

          {/* Translation progress */}
          {translating && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur border border-border rounded-lg px-4 py-2 flex items-center gap-3 z-10">
              <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: transProgress + "%" }} />
              </div>
              <span className="text-xs text-muted-foreground">{transMsg}</span>
            </div>
          )}
          {transMsg && !translating && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2 z-10">
              <span className="text-xs text-destructive">{transMsg}</span>
            </div>
          )}

          {/* Top controls */}
          <div className="absolute top-3 left-3 flex gap-2 z-10">
            <label className="cursor-pointer bg-background/80 hover:bg-background backdrop-blur border border-border rounded-lg px-3 py-1.5 text-xs font-medium transition-colors">
              החלף מודל
              <input type="file" accept=".rvt,.stp,.step,.ifc,.dwg,.ipt,.iam" className="hidden" onChange={handleUpload} />
            </label>
            <button onClick={() => { setUrn(null); setViewerLoaded(false); setActiveElement(null); handlerSetRef.current = false; }}
              className="bg-background/80 hover:bg-background backdrop-blur border border-border rounded-lg px-3 py-1.5 text-xs font-medium transition-colors">
              בחר אחר
            </button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur border border-border rounded-lg px-3 py-2 z-10">
            <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold">מקרא</p>
            <div className="space-y-1">
              {(Object.entries(STATUS_LABELS) as [ItemStatus, string][]).map(([status, label]) => (
                <div key={status} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: `rgba(${STATUS_COLORS[status].slice(0,3).map(c => Math.round(c*255)).join(",")},1)` }} />
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: "rgba(5,209,245,1)" }} />
                <span className="text-[10px] text-muted-foreground">נבחר</span>
              </div>
            </div>
          </div>

          {/* Hint when nothing selected */}
          {viewerLoaded && !activeElement && (
            <div className="absolute top-3 right-3 bg-background/80 backdrop-blur border border-border rounded-lg px-3 py-2 z-10">
              <p className="text-[10px] text-muted-foreground">לחץ על אלמנט לצפייה בפרטים</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div className="space-y-4">

        {/* Element detail panel */}
        <div className="glass-card p-4">
          <h3 className="font-semibold text-sm mb-3">פרטי אלמנט</h3>
          {activeElement ? (
            <div className="space-y-3">
              {/* Name & category */}
              <div className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold truncate">{activeElement.name}</p>
                {activeElement.category && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{activeElement.category}</p>
                )}
                {activeElement.externalId && (
                  <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate">{activeElement.externalId}</p>
                )}
              </div>

              {/* Model properties */}
              {activeElement.properties.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {activeElement.properties.map((p, i) => (
                    <div key={i} className="flex justify-between gap-2 text-[11px]">
                      <span className="text-muted-foreground truncate shrink-0 max-w-[45%]">{p.displayName}</span>
                      <span className="truncate text-right font-medium">{String(p.displayValue)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Current status badge */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">סטטוס נוכחי</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BG[activeElement.status]}`}>
                  {STATUS_LABELS[activeElement.status]}
                </span>
              </div>

              {/* Status selector */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">עדכן סטטוס:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["pending","in_progress","completed","rejected"] as ItemStatus[]).map(s => (
                    <button key={s}
                      className={`text-xs px-2 py-2 rounded-lg border font-medium transition-all ${
                        activeElement.status === s
                          ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/30"
                          : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                      onClick={() => handleElementStatusChange(activeElement.dbId, s)}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="text-3xl mb-2 opacity-20">🖱</div>
              <p className="text-sm text-muted-foreground">לחץ על אלמנט במודל</p>
              <p className="text-xs text-muted-foreground/60 mt-1">לצפייה בפרטים ועדכון סטטוס</p>
            </div>
          )}
        </div>

        {/* Items list */}
        <div className="glass-card p-4">
          <h3 className="font-semibold text-sm mb-2">
            פריטי פרויקט
            {Object.keys(elementStatusRef.current).length > 0 && (
              <span className="mr-2 text-[10px] text-primary/70 font-normal">
                ({Object.keys(elementStatusRef.current).length} עם סטטוס)
              </span>
            )}
          </h3>
          <div className="max-h-[280px] overflow-y-auto space-y-1">
            {items
              .filter(i => (!activeSide || activeSide === i.side) && (!selectedFloor || selectedFloor === i.floor))
              .slice(0, 100)
              .map(item => (
                <div key={item.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    selectedItemId === item.id ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-muted/50"
                  }`}
                  onClick={() => onSelectItem(item.id)}>
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: `rgba(${STATUS_COLORS[item.status].slice(0,3).map(c => Math.round(c*255)).join(",")},1)` }} />
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