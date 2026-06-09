import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import JsBarcode from "jsbarcode";
import {
  Upload, FileSpreadsheet, Printer, ChevronRight, ChevronLeft,
  Rows3, Columns3, MousePointerClick, CheckSquare, ArrowRight, ArrowLeft, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectItem } from "@/data/mockData";
import { toast } from "sonner";

/* ============================================================
 * Excel parsing (optional enrichment: weight, code, date)
 * ============================================================ */

interface LabelRow {
  ifcGuid?: string;
  side?: string;
  floor?: number;
  unit?: number;
  type?: string;
  unitCode?: string;
  weight?: string;
  barcode?: string;
  date?: string;
}

function s(v: unknown): string { return String(v ?? "").trim(); }

function toDateStr(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    }
  }
  return s(v);
}

const SIDE_PATTERN = /^[NSEW]-?[NSEW]?$/i;

function parseLabelExcel(file: File): Promise<LabelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: "array" });
        const sheetName = wb.SheetNames.find(n => /הדפס|ברקוד/.test(n)) || wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (raw.length < 2) return resolve([]);

        let headerIdx = -1;
        for (let r = 0; r < Math.min(raw.length, 10); r++) {
          if (raw[r].filter(c => c !== "" && c != null).length >= 3) { headerIdx = r; break; }
        }
        const headers = headerIdx >= 0 ? raw[headerIdx].map(h => s(h).toLowerCase()) : [];
        const dataRows = raw.slice(headerIdx + 1).filter(r => r && r.some(c => c !== "" && c != null));
        if (dataRows.length === 0) return resolve([]);

        const width = Math.max(...dataRows.map(r => r.length));
        const colsByName = (...keys: string[]): number[] => {
          const out: number[] = [];
          headers.forEach((h, i) => { if (keys.some(k => h === k.toLowerCase())) out.push(i); });
          return out;
        };
        const pickNumericCol = (candidates: number[]): number => {
          if (candidates.length <= 1) return candidates[0] ?? -1;
          let best = candidates[0], bestScore = -1;
          for (const c of candidates) {
            let score = 0;
            for (const r of dataRows.slice(0, 30)) {
              const v = s(r[c]);
              if (v && /^-?\d+(\.\d+)?$/.test(v)) score++;
            }
            if (score > bestScore) { bestScore = score; best = c; }
          }
          return best;
        };
        const detectSideCol = (): number => {
          for (let c = 0; c < width; c++) {
            let hits = 0, total = 0;
            for (const r of dataRows.slice(0, 30)) {
              const v = s(r[c]);
              if (!v) continue;
              total++;
              if (SIDE_PATTERN.test(v)) hits++;
            }
            if (total > 0 && hits / total > 0.7) return c;
          }
          return -1;
        };

        const iIfc    = colsByName("ifcguid", "ifc guid", "globalid", "guid")[0] ?? -1;
        const iFloor  = pickNumericCol(colsByName("floor", "קומה", "קו'", "קו"));
        const iUnit   = pickNumericCol(colsByName("unit", "מיקום", "יחידה"));
        const iType   = colsByName("type", "סוג", "מק\"ט", 'מק"ט', "catalog")[0] ?? -1;
        const iCode   = colsByName("code", "unitcode", "unit_name", "קוד", "תאור", "description")[0] ?? -1;
        const iWeight = colsByName("weight", "משקל")[0] ?? -1;
        const iBar    = colsByName("barcode", "ברקוד")[0] ?? -1;
        const iDate   = colsByName("date", "תאריך")[0] ?? -1;
        let iSide     = colsByName("side", "חזית")[0] ?? -1;
        if (iSide < 0) iSide = detectSideCol();

        const out: LabelRow[] = [];
        dataRows.forEach(row => {
          const get = (i: number) => (i >= 0 ? s(row[i]) : "");
          const floorStr = get(iFloor);
          const unitStr  = get(iUnit);
          const barRaw = get(iBar).replace(/^\*|\*$/g, "");
          out.push({
            ifcGuid:  get(iIfc) || undefined,
            side:     get(iSide) || undefined,
            floor:    floorStr ? parseInt(floorStr.replace(/[^0-9-]/g, ""), 10) || undefined : undefined,
            unit:     unitStr  ? parseInt(unitStr.replace(/[^0-9-]/g, ""), 10)  || undefined : undefined,
            type:     get(iType) || undefined,
            unitCode: get(iCode) || undefined,
            weight:   get(iWeight) || undefined,
            barcode:  barRaw || undefined,
            date:     iDate >= 0 ? toDateStr(row[iDate]) : undefined,
          });
        });
        resolve(out);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function sideKey(v?: string): string {
  if (!v) return "";
  return v.toUpperCase().replace(/[^NSEW]/g, "");
}

/** Lookup a LabelRow that matches a given ProjectItem. */
function findRowForItem(item: ProjectItem, rows: LabelRow[]): LabelRow | undefined {
  if (rows.length === 0) return undefined;
  if (item.ifcGuid) {
    const byIfc = rows.find(r => r.ifcGuid && r.ifcGuid.toLowerCase() === item.ifcGuid!.toLowerCase());
    if (byIfc) return byIfc;
  }
  const candidates = rows.filter(r => r.floor === item.floor && r.unit === item.unit);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    const k = sideKey(item.side);
    const exact = candidates.find(c => sideKey(c.side) === k);
    if (exact) return exact;
  }
  return candidates[0];
}

function generateBarcode(projectId: string, item: ProjectItem): string {
  const prefix = projectId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  const f = String(item.floor).padStart(2, "0");
  const u = String(item.unit).padStart(2, "0");
  const k = sideKey(item.side).slice(0, 2) || "XX";
  return `${prefix}-${k}-${f}-${u}`;
}

/* ============================================================
 * Label model
 * ============================================================ */

interface LabelData {
  item: ProjectItem;
  barcode: string;
  type: string;
  side: string;
  floor: number;
  unit: number;
  code: string;
  weight: string;
  date: string;
}

function buildLabel(item: ProjectItem, projectId: string, rows: LabelRow[]): LabelData {
  const row = findRowForItem(item, rows);
  // Prefer the new Priority-based barcode stored on the item.
  const barcode =
    item.barcode ||
    row?.barcode ||
    generateBarcode(projectId, item);
  const weight =
    (item.priorityWeight != null ? String(item.priorityWeight) : "") ||
    row?.weight ||
    "";
  // Show the Priority full SKU as the code line when available.
  const code = item.prioritySku || row?.unitCode || "";
  return {
    item,
    barcode,
    type: row?.type || item.type || "",
    side: row?.side || item.side || "",
    floor: row?.floor ?? item.floor,
    unit: row?.unit ?? item.unit,
    code,
    weight,
    date: row?.date || new Date().toLocaleDateString("he-IL"),
  };
}

/* ============================================================
 * Print HTML
 * ============================================================ */

function labelInnerHtml(l: LabelData): string {
  const weightValue = l.weight || "360";
  return `
    <div class="weight-side">
      <div class="bar-vert-wrap"><svg class="bar-vert"></svg></div>
      <div class="weight-text">
        <div class="wlabel">משקל</div>
        <div class="wvalue">${weightValue}</div>
        <div class="wunit">Kg</div>
      </div>
    </div>
    <div class="info-side">
      <div class="info-top">
        <div class="type">${l.type}</div>
        <div class="side">${l.side}</div>
        <div class="loc">קו' ${l.floor}, מיקום ${l.unit}</div>
        ${l.code ? `<div class="code">${l.code}</div>` : ""}
      </div>
      <div class="info-bot">
        <svg class="bar-horiz" data-barcode="${l.barcode}"></svg>
        <div class="bartext">*${l.barcode}*</div>
        <div class="date">${l.date}</div>
      </div>
    </div>
  `;
}

const LABEL_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 12px; background: #f3f3f3; font-family: "Heebo", "Arial Hebrew", Arial, sans-serif; color: #000; }
  .toolbar { position: sticky; top: 0; z-index: 10; background: #fff; padding: 10px; border-bottom: 1px solid #ccc;
    display: flex; justify-content: space-between; align-items: center; margin: -12px -12px 16px; }
  .toolbar button { background: #111; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
  .label { display: flex; flex-direction: row; width: 105mm; height: 40mm; background: #fff; border: 1px solid #000;
    margin: 0 auto 6mm; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
  .weight-side { width: 50%; border-right: 1px solid #000; display: flex; align-items: center; gap: 1mm; padding: 0; }
  .bar-vert-wrap { width: 8mm; height: 40mm; position: relative; overflow: hidden; flex-shrink: 0; }
  .bar-vert { position: absolute; top: 50%; left: 50%; width: 38mm; height: 8mm; transform: translate(-50%, -50%) rotate(-90deg); transform-origin: center center; }
  .weight-text { flex: 1; text-align: center; line-height: 1; padding: 2mm 1mm; }
  .wlabel { font-size: 14pt; font-weight: 700; }
  .wvalue { font-size: 38pt; font-weight: 900; margin: 2mm 0; line-height: 1; }
  .wunit  { font-size: 14pt; font-weight: 700; }
  .info-side { width: 50%; padding: 2mm 3mm; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
  .info-top { display: flex; flex-direction: column; gap: 0.8mm; }
  .info-bot { display: flex; flex-direction: column; gap: 0.3mm; }
  .type { font-size: 16pt; font-weight: 900; line-height: 1; }
  .side { font-size: 14pt; font-weight: 800; line-height: 1; }
  .loc  { font-size: 11pt; font-weight: 600; line-height: 1.1; }
  .code { font-size: 11pt; font-weight: 600; line-height: 1.1; }
  .bar-horiz { width: 100%; height: 10mm; display: block; }
  .bartext { font-family: "Courier New", monospace; font-size: 8pt; text-align: center; letter-spacing: 1px; font-weight: 700; }
  .date { font-size: 10pt; font-weight: 700; text-align: left; direction: ltr; margin-top: 0.5mm; }
  @media print { body { background: #fff; padding: 0; } .toolbar { display: none; } .label { border-color: #000; margin: 0 auto 4mm; } }
`;

function buildPrintHtml(labels: LabelData[], projectName: string): string {
  const labelsHtml = labels.map(l => `<div class="label">${labelInnerHtml(l)}</div>`).join("");
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<title>הדפסת מדבקות - ${projectName}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>${LABEL_CSS}</style>
</head>
<body>
  <div class="toolbar">
    <strong>הדפסת מדבקות – ${projectName} (${labels.length})</strong>
    <button onclick="window.print()">🖨️ הדפס</button>
  </div>
  ${labelsHtml}
  <script>
    document.querySelectorAll('svg.bar-horiz').forEach(function(svg){
      try { JsBarcode(svg, svg.getAttribute('data-barcode'), { format: "CODE128", displayValue: false, margin: 0, height: 38, width: 1.5 }); } catch (e) {}
    });
    document.querySelectorAll('svg.bar-vert').forEach(function(svg, i){
      try { JsBarcode(svg, "W" + (i+1), { format: "CODE128", displayValue: false, margin: 0, height: 30, width: 1.2 }); } catch (e) {}
    });
  </script>
</body>
</html>`;
}

/* ============================================================
 * Live preview (single label in component)
 * ============================================================ */

function LabelPreview({ label }: { label: LabelData }) {
  const horizRef = useRef<SVGSVGElement>(null);
  const vertRef = useRef<SVGSVGElement>(null);
  const weightValue = label.weight || "360";

  useEffect(() => {
    if (horizRef.current) {
      try {
        JsBarcode(horizRef.current, label.barcode, {
          format: "CODE128", displayValue: false, margin: 0, height: 40, width: 1.6,
        });
      } catch {}
    }
    if (vertRef.current) {
      try {
        JsBarcode(vertRef.current, "W-" + label.barcode, {
          format: "CODE128", displayValue: false, margin: 0, height: 30, width: 1.4,
        });
      } catch {}
    }
  }, [label]);

  return (
    <div
      dir="rtl"
      className="bg-white text-black border-2 border-black shadow-xl"
      style={{ width: "105mm", height: "40mm", display: "flex", flexDirection: "row", overflow: "hidden", fontFamily: "Heebo, Arial Hebrew, Arial, sans-serif" }}
    >
      <div style={{ width: "50%", borderRight: "1px solid #000", display: "flex", alignItems: "center", gap: "1mm" }}>
        <div style={{ width: "8mm", height: "40mm", position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <svg ref={vertRef} style={{ position: "absolute", top: "50%", left: "50%", width: "38mm", height: "8mm", transform: "translate(-50%, -50%) rotate(-90deg)", transformOrigin: "center center" }} />
        </div>
        <div style={{ flex: 1, textAlign: "center", lineHeight: 1, padding: "2mm 1mm" }}>
          <div style={{ fontSize: "14pt", fontWeight: 700 }}>משקל</div>
          <div style={{ fontSize: "38pt", fontWeight: 900, margin: "2mm 0", lineHeight: 1 }}>{weightValue}</div>
          <div style={{ fontSize: "14pt", fontWeight: 700 }}>Kg</div>
        </div>
      </div>
      <div style={{ width: "50%", padding: "2mm 3mm", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8mm" }}>
          <div style={{ fontSize: "16pt", fontWeight: 900, lineHeight: 1 }}>{label.type}</div>
          <div style={{ fontSize: "14pt", fontWeight: 800, lineHeight: 1 }}>{label.side}</div>
          <div style={{ fontSize: "11pt", fontWeight: 600, lineHeight: 1.1 }}>קו' {label.floor}, מיקום {label.unit}</div>
          {label.code && <div style={{ fontSize: "11pt", fontWeight: 600, lineHeight: 1.1 }}>{label.code}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3mm" }}>
          <svg ref={horizRef} style={{ width: "100%", height: "10mm", display: "block" }} />
          <div style={{ fontFamily: "Courier New, monospace", fontSize: "8pt", textAlign: "center", letterSpacing: "1px", fontWeight: 700 }}>*{label.barcode}*</div>
          <div style={{ fontSize: "10pt", fontWeight: 700, textAlign: "left", direction: "ltr", marginTop: "0.5mm" }}>{label.date}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Main component
 * ============================================================ */

type SelectionMode = "floor" | "strip" | "single" | "multi";

export default function BarcodesTab({ items, projectName }: { items: ProjectItem[]; projectName: string }) {
  const { id: projectId = "" } = useParams<{ id: string }>();

  // Optional Excel enrichment
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<LabelRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2>(1);
  const [side, setSide] = useState<string>("");
  const [mode, setMode] = useState<SelectionMode>("floor");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  // Printed labels tracking (persisted per project)
  const printedKey = `barcodesPrinted:${projectId}`;
  const [printedIds, setPrintedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`barcodesPrinted:${projectId}`);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch { return new Set<string>(); }
  });
  useEffect(() => {
    try { localStorage.setItem(printedKey, JSON.stringify(Array.from(printedIds))); } catch {}
  }, [printedIds, printedKey]);

  // Drag-to-select state (multi mode only)
  const [dragStart, setDragStart] = useState<{ floor: number; unit: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ floor: number; unit: number } | null>(null);
  const [dragAdditive, setDragAdditive] = useState(true);
  const sides = useMemo(() => Array.from(new Set(items.map(i => i.side))).sort(), [items]);

  const sideItems = useMemo(() => items.filter(i => i.side === side), [items, side]);
  const floors = useMemo(() => Array.from(new Set(sideItems.map(i => i.floor))).sort((a, b) => b - a), [sideItems]);
  const units = useMemo(() => Array.from(new Set(sideItems.map(i => i.unit))).sort((a, b) => a - b), [sideItems]);

  /** Build a {floor → {unit → ProjectItem}} grid for the selected side. */
  const grid = useMemo(() => {
    const m = new Map<number, Map<number, ProjectItem>>();
    sideItems.forEach(it => {
      if (!m.has(it.floor)) m.set(it.floor, new Map());
      m.get(it.floor)!.set(it.unit, it);
    });
    return m;
  }, [sideItems]);

  // Commit drag-selection rectangle on mouseup
  useEffect(() => {
    const up = () => {
      if (dragStart && dragEnd) {
        const fMin = Math.min(dragStart.floor, dragEnd.floor);
        const fMax = Math.max(dragStart.floor, dragEnd.floor);
        const uMin = Math.min(dragStart.unit, dragEnd.unit);
        const uMax = Math.max(dragStart.unit, dragEnd.unit);
        const rectIds = sideItems
          .filter(i => i.floor >= fMin && i.floor <= fMax && i.unit >= uMin && i.unit <= uMax)
          .map(i => i.id);
        setSelectedIds(prev => {
          const s = new Set(prev);
          if (dragAdditive) rectIds.forEach(id => s.add(id));
          else rectIds.forEach(id => s.delete(id));
          return Array.from(s);
        });
      }
      setDragStart(null); setDragEnd(null);
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [dragStart, dragEnd, dragAdditive, sideItems]);

  // Rectangle currently being dragged (for preview highlight)
  const dragRect = useMemo(() => {
    if (!dragStart || !dragEnd) return null;
    return {
      fMin: Math.min(dragStart.floor, dragEnd.floor),
      fMax: Math.max(dragStart.floor, dragEnd.floor),
      uMin: Math.min(dragStart.unit, dragEnd.unit),
      uMax: Math.max(dragStart.unit, dragEnd.unit),
    };
  }, [dragStart, dragEnd]);

  const handleFile = async (f: File | null) => {
    setFile(f);
    setRows([]);
    if (!f) return;
    setParsing(true);
    try {
      const parsed = await parseLabelExcel(f);
      setRows(parsed);
      toast.success(`נטענו ${parsed.length} שורות נתונים מהקובץ`);
    } catch {
      toast.error("שגיאה בקריאת הקובץ");
    } finally {
      setParsing(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSide("");
    setMode("floor");
    setSelectedIds([]);
    setPreviewIdx(0);
  };

  const toggleId = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectFloor = (floor: number) => {
    const ids = sideItems.filter(i => i.floor === floor).sort((a, b) => a.unit - b.unit).map(i => i.id);
    setSelectedIds(ids);
  };

  const selectStrip = (unit: number) => {
    // bottom → up: lowest floor first
    const ids = sideItems.filter(i => i.unit === unit).sort((a, b) => a.floor - b.floor).map(i => i.id);
    setSelectedIds(ids);
  };

  const onModeChange = (m: SelectionMode) => {
    setMode(m);
    setSelectedIds([]);
  };

  const selectedItems = useMemo(
    () => selectedIds.map(id => items.find(i => i.id === id)).filter(Boolean) as ProjectItem[],
    [selectedIds, items]
  );

  const labels = useMemo(
    () => selectedItems.map(it => buildLabel(it, projectId, rows)),
    [selectedItems, projectId, rows]
  );

  const handlePrint = () => {
    if (labels.length === 0) return;
    const html = buildPrintHtml(labels, projectName);
    const w = window.open("", "_blank");
    if (!w) { toast.error("חלון ההדפסה נחסם — אפשר חלונות קופצים"); return; }
    // Persist barcodes back to items
    labels.forEach(l => { l.item.barcode = l.barcode; });
    // Mark as printed
    setPrintedIds(prev => {
      const s = new Set(prev);
      labels.forEach(l => s.add(l.item.id));
      return s;
    });
    w.document.write(html);
    w.document.close();
    toast.success(`נשלחו ${labels.length} מדבקות להדפסה`);
  };

  const clearPrinted = () => {
    if (!confirm("לאפס סימון הדפסה לכל הפריטים בפרויקט?")) return;
    setPrintedIds(new Set());
    toast.success("סימון ההדפסה אופס");
  };

  /* -------------------- Render -------------------- */

  return (
    <div className="space-y-4" dir="rtl">
      {/* Excel upload (optional enrichment) */}
      <div className="surface-card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">נתוני מדבקה (אופציונלי)</div>
            <div className="text-xs text-muted-foreground truncate">
              {file ? (
                <>קובץ: <span className="text-foreground font-medium">{file.name}</span>
                {parsing ? " · מנתח..." : ` · ${rows.length} שורות`}</>
              ) : "ניתן להעלות קובץ Excel עם משקל/קוד/תאריך להעשרת המדבקות"}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background/60 hover:bg-secondary cursor-pointer text-xs font-medium">
            <Upload className="w-4 h-4" />
            {file ? "החלף" : "העלאת קובץ"}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => handleFile(e.target.files?.[0] || null)} />
          </label>
          {file && (
            <button onClick={() => { setFile(null); setRows([]); if (fileRef.current) fileRef.current.value = ""; }}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-background/60 hover:bg-secondary"
              title="הסר קובץ">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stepper header */}
      <div className="flex items-center gap-2 text-xs">
        <StepPill n={1} label="בחירת היקף" active={step === 1} done={step > 1} />
        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        <StepPill n={2} label="תצוגה מקדימה" active={step === 2} done={false} />
      </div>

      {step === 1 && (
        <div className="surface-card p-5 space-y-5">
          {/* 1. Side */}
          <section>
            <h3 className="font-bold text-sm mb-2">1. בחירת חזית</h3>
            {sides.length === 0 ? (
              <div className="text-sm text-muted-foreground">אין פריטים בפרויקט</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sides.map(sd => (
                  <button key={sd}
                    onClick={() => { setSide(sd); setSelectedIds([]); }}
                    className={`px-4 h-10 rounded-lg border text-sm font-medium transition ${
                      side === sd
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background/60 border-border hover:border-primary"
                    }`}>
                    {sd}
                  </button>
                ))}
              </div>
            )}
          </section>

          {side && (
            <>
              {/* 2. Mode */}
              <section>
                <h3 className="font-bold text-sm mb-2">2. אופן הבחירה</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <ModeCard icon={Rows3} label="קומה (רוחב)" active={mode === "floor"} onClick={() => onModeChange("floor")} />
                  <ModeCard icon={Columns3} label="סטריפ (מלמטה למעלה)" active={mode === "strip"} onClick={() => onModeChange("strip")} />
                  <ModeCard icon={MousePointerClick} label="יחידה בודדת" active={mode === "single"} onClick={() => onModeChange("single")} />
                  <ModeCard icon={CheckSquare} label="מספר יחידות" active={mode === "multi"} onClick={() => onModeChange("multi")} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  הדפסה מוגבלת לקבוצה אחת בלבד — קומה, סטריפ, יחידה בודדת או מספר יחידות נבחרות.
                </p>
              </section>

              {/* 3. Selection */}
              <section>
                <h3 className="font-bold text-sm mb-2">
                  3. {mode === "floor" ? "בחר קומה" : mode === "strip" ? "בחר סטריפ" : "בחר יחידות בגריד"}
                </h3>

                {(mode === "floor" || mode === "strip") && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(mode === "floor" ? floors : units).map(n => {
                      const isSel = mode === "floor"
                        ? selectedItems.length > 0 && selectedItems.every(i => i.floor === n)
                        : selectedItems.length > 0 && selectedItems.every(i => i.unit === n);
                      return (
                        <button key={n}
                          onClick={() => mode === "floor" ? selectFloor(n) : selectStrip(n)}
                          className={`min-w-[42px] h-8 px-2 rounded border text-xs font-mono tabular-nums transition ${
                            isSel ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background/60 border-border hover:border-primary"
                          }`}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Grid view */}
                <div className="overflow-x-auto border border-border rounded-lg bg-background/40 select-none">
                  <table className="text-[11px]">
                    <thead>
                      <tr>
                        <th className="px-2 py-1.5 text-muted-foreground font-semibold text-right sticky right-0 bg-muted/40">קומה \ מיקום</th>
                        {units.map(u => (
                          <th key={u} className="px-2 py-1.5 text-muted-foreground font-semibold tabular-nums text-center min-w-[44px]">{u}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {floors.map(f => (
                        <tr key={f}>
                          <td className="px-2 py-1 font-semibold tabular-nums text-right sticky right-0 bg-muted/40 border-l border-border">{f}</td>
                          {units.map(u => {
                            const it = grid.get(f)?.get(u);
                            const selected = !!it && selectedIds.includes(it.id);
                            const printed = !!it && printedIds.has(it.id);
                            const inDrag = !!dragRect && f >= dragRect.fMin && f <= dragRect.fMax && u >= dragRect.uMin && u <= dragRect.uMax;
                            if (!it) return <td key={u} className="px-1 py-1"><div className="w-9 h-7 rounded bg-muted/20" /></td>;
                            return (
                              <td key={u} className="px-1 py-1 text-center">
                                <button
                                  onMouseDown={(e) => {
                                    if (mode !== "multi") return;
                                    e.preventDefault();
                                    setDragAdditive(!selected);
                                    setDragStart({ floor: f, unit: u });
                                    setDragEnd({ floor: f, unit: u });
                                  }}
                                  onMouseEnter={() => {
                                    if (mode === "multi" && dragStart) setDragEnd({ floor: f, unit: u });
                                  }}
                                  onClick={() => {
                                    if (mode === "multi") return; // handled by drag
                                    if (mode === "single") setSelectedIds([it.id]);
                                    else if (mode === "floor") selectFloor(f);
                                    else selectStrip(u);
                                  }}
                                  className={`relative w-9 h-7 rounded text-[10px] font-mono border transition ${
                                    inDrag
                                      ? (dragAdditive ? "bg-primary/60 text-primary-foreground border-primary" : "bg-destructive/30 border-destructive")
                                      : selected
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : printed
                                          ? "bg-status-completed/20 border-status-completed/60 text-status-completed hover:border-status-completed"
                                          : "bg-background border-border hover:border-primary"
                                  }`}
                                  title={`קומה ${f} · מיקום ${u}${printed ? " · הודפס" : ""}`}>
                                  {printed ? "✓" : "●"}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {mode === "multi" && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    טיפ: לחץ וגרור על הגריד לבחירת טווח רציף. גרירה מתא לא-מסומן תוסיף לבחירה, וגרירה מתא מסומן תסיר ממנה.
                  </p>
                )}
                {printedIds.size > 0 && (
                  <div className="flex items-center justify-between mt-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="inline-block w-3 h-3 rounded bg-status-completed/20 border border-status-completed/60" />
                      <span>הודפס בעבר ({printedIds.size})</span>
                    </div>
                    <button onClick={clearPrinted} className="text-muted-foreground hover:text-destructive underline-offset-2 hover:underline">
                      אפס סימון הדפסה
                    </button>
                  </div>
                )}
              </section>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <div className="text-xs text-muted-foreground">
              {selectedIds.length > 0
                ? <>נבחרו <span className="text-foreground font-semibold">{selectedIds.length}</span> יחידות להדפסה</>
                : "לא נבחרו יחידות"}
            </div>
            <Button onClick={() => { setPreviewIdx(0); setStep(2); }} disabled={selectedIds.length === 0}>
              המשך לתצוגה מקדימה
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="surface-card p-5 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-sm">תצוגה מקדימה</h3>
              <div className="text-xs text-muted-foreground mt-0.5">
                חזית {side} · {labels.length} מדבקות ·
                {mode === "floor" && selectedItems[0] && <> קומה {selectedItems[0].floor}</>}
                {mode === "strip" && selectedItems[0] && <> סטריפ {selectedItems[0].unit}</>}
                {mode === "single" && <> יחידה בודדת</>}
                {mode === "multi" && <> בחירה מרובה</>}
              </div>
            </div>
            <button onClick={resetWizard} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5" /> בחירה מחדש
            </button>
          </div>

          {labels.length > 0 && (
            <>
              {/* Pager */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setPreviewIdx(i => Math.max(0, i - 1))}
                  disabled={previewIdx === 0}
                  className="h-9 w-9 rounded-lg border border-border bg-background/60 hover:bg-secondary disabled:opacity-40 inline-flex items-center justify-center">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="text-xs font-mono tabular-nums text-muted-foreground">
                  {previewIdx + 1} / {labels.length}
                </div>
                <button
                  onClick={() => setPreviewIdx(i => Math.min(labels.length - 1, i + 1))}
                  disabled={previewIdx >= labels.length - 1}
                  className="h-9 w-9 rounded-lg border border-border bg-background/60 hover:bg-secondary disabled:opacity-40 inline-flex items-center justify-center">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Preview */}
              <div className="flex justify-center py-4 bg-muted/20 rounded-lg">
                <LabelPreview label={labels[previewIdx]} />
              </div>

              {/* Thumbnails strip */}
              {labels.length > 1 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {labels.map((l, i) => (
                    <button key={l.item.id}
                      onClick={() => setPreviewIdx(i)}
                      className={`px-2 h-7 rounded border text-[10px] font-mono tabular-nums transition ${
                        i === previewIdx
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background/60 border-border hover:border-primary"
                      }`}>
                      {l.floor}/{l.unit}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowRight className="w-4 h-4" />
              חזרה
            </Button>
            <Button onClick={handlePrint} disabled={labels.length === 0}>
              <Printer className="w-4 h-4" />
              אישור ושליחה להדפסה ({labels.length})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Small UI helpers
 * ============================================================ */

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full border ${
      active ? "bg-primary/10 border-primary text-primary"
      : done ? "bg-status-completed/10 border-status-completed/40 text-status-completed"
      : "bg-background/60 border-border text-muted-foreground"
    }`}>
      <span className={`w-5 h-5 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
        active ? "bg-primary text-primary-foreground" : done ? "bg-status-completed text-white" : "bg-muted text-muted-foreground"
      }`}>{n}</span>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

function ModeCard({ icon: Icon, label, active, onClick }: {
  icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 h-20 rounded-lg border transition ${
        active ? "bg-primary/10 border-primary text-primary"
               : "bg-background/60 border-border hover:border-primary text-foreground"
      }`}>
      <Icon className="w-5 h-5" />
      <span className="text-xs font-semibold text-center px-1">{label}</span>
    </button>
  );
}
