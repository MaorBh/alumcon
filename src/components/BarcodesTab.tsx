import { useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import JsBarcode from "jsbarcode";
import { Upload, FileSpreadsheet, Printer, Save, Check, AlertTriangle, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROJECT_ITEMS, ProjectItem } from "@/data/mockData";
import { toast } from "sonner";

/** Single parsed row from the uploaded label-data Excel. */
interface LabelRow {
  rowIndex: number;
  ifcGuid?: string;
  side?: string;
  floor?: number;
  unit?: number;
  type?: string;
  unitCode?: string;   // e.g. "U-125x360-V-B"
  weight?: string;
  barcode?: string;    // from file (optional)
  date?: string;       // free-text date for label
  // Resolution
  matchedItemId?: string | null; // null = no match; undefined = not yet resolved
}

function s(v: unknown): string {
  return String(v ?? "").trim();
}

/** Convert Excel serial date (or string) to DD/MM/YYYY. */
function toDateStr(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Excel serial date — 1900-based with the well-known leap bug.
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
        // Prefer a sheet whose name contains "הדפס" / "ברקוד"
        const sheetName =
          wb.SheetNames.find(n => /הדפס|ברקוד/.test(n)) || wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (raw.length < 2) return resolve([]);

        // Find header row = first with ≥3 non-empty cells in first 10 rows.
        let headerIdx = -1;
        for (let r = 0; r < Math.min(raw.length, 10); r++) {
          if (raw[r].filter(c => c !== "" && c != null).length >= 3) { headerIdx = r; break; }
        }
        // If row 0 looks like data (no Hebrew header words), treat as headerless.
        const headers = headerIdx >= 0 ? raw[headerIdx].map(h => s(h).toLowerCase()) : [];
        const dataRows = raw.slice(headerIdx + 1).filter(r => r && r.some(c => c !== "" && c != null));
        if (dataRows.length === 0) return resolve([]);

        const width = Math.max(...dataRows.map(r => r.length));

        // Find all column indices for a given header keyword.
        const colsByName = (...keys: string[]): number[] => {
          const out: number[] = [];
          headers.forEach((h, i) => { if (keys.some(k => h === k.toLowerCase())) out.push(i); });
          return out;
        };

        // Pick the column whose data rows are mostly numeric (for floor/unit when "מיקום" appears twice).
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

        // Auto-detect side column by content (e.g. "N-W", "S-W", "N-S").
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
        const unitCols = colsByName("unit", "מיקום", "יחידה");
        // If two "מיקום" columns: the numeric one is unit, the textual one is the location label.
        const iUnit   = pickNumericCol(unitCols);
        const iType   = colsByName("type", "סוג", "מק\"ט", 'מק"ט', "catalog")[0] ?? -1;
        const iCode   = colsByName("code", "unitcode", "unit_name", "קוד", "תאור", "description")[0] ?? -1;
        const iWeight = colsByName("weight", "משקל")[0] ?? -1;
        const iBar    = colsByName("barcode", "ברקוד")[0] ?? -1;
        const iDate   = colsByName("date", "תאריך")[0] ?? -1;
        let iSide     = colsByName("side", "חזית")[0] ?? -1;
        if (iSide < 0) iSide = detectSideCol();

        const out: LabelRow[] = [];
        dataRows.forEach((row, idx) => {
          const get = (i: number) => (i >= 0 ? s(row[i]) : "");
          const floorStr = get(iFloor);
          const unitStr  = get(iUnit);
          const barRaw = get(iBar).replace(/^\*|\*$/g, "");
          out.push({
            rowIndex: idx + 1,
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
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/** Build a normalized side key for soft matching ("S-North" ≈ "N-S" ≈ "N"). */
function sideKey(s?: string): string {
  if (!s) return "";
  return s.toUpperCase().replace(/[^NSEW]/g, "");
}

function matchItem(row: LabelRow, items: ProjectItem[]): ProjectItem | null {
  if (row.ifcGuid) {
    const byIfc = items.find(i => i.ifcGuid && i.ifcGuid.toLowerCase() === row.ifcGuid!.toLowerCase());
    if (byIfc) return byIfc;
  }
  if (row.floor != null && row.unit != null) {
    const candidates = items.filter(i => i.floor === row.floor && i.unit === row.unit);
    if (candidates.length === 1) return candidates[0];
    if (row.side && candidates.length > 0) {
      const k = sideKey(row.side);
      const exact = candidates.find(c => sideKey(c.side) === k);
      if (exact) return exact;
      const partial = candidates.find(c => sideKey(c.side).includes(k) || k.includes(sideKey(c.side)));
      if (partial) return partial;
    }
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

function generateBarcode(projectId: string, item: ProjectItem): string {
  const prefix = projectId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  const f = String(item.floor).padStart(2, "0");
  const u = String(item.unit).padStart(2, "0");
  const k = sideKey(item.side).slice(0, 2) || "XX";
  return `${prefix}-${k}-${f}-${u}`;
}

function buildPrintHtml(rows: { row: LabelRow; item: ProjectItem; barcode: string }[], projectName: string): string {
  const labels = rows.map(({ row, item, barcode }) => {
    const sideLabel = row.side || item.side || "";
    const floor = row.floor ?? item.floor;
    const unit = row.unit ?? item.unit;
    const code = row.unitCode || "";
    const type = row.type || item.type || "";
    const date = row.date || new Date().toLocaleDateString("he-IL");
    const weight = row.weight || "";

    return `
      <div class="label">
        ${weight ? `
        <div class="weight-side">
          <svg class="bar-vert"></svg>
          <div class="weight-text">
            <div class="wlabel">משקל</div>
            <div class="wvalue">${weight}</div>
            <div class="wunit">Kg</div>
          </div>
        </div>` : ""}
        <div class="info-side ${weight ? "" : "full"}">
          <div class="type">${type}</div>
          <div class="side">${sideLabel}</div>
          <div class="loc">קו' ${floor}, מיקום ${unit}</div>
          ${code ? `<div class="code">${code}</div>` : ""}
          <svg class="bar-horiz" data-barcode="${barcode}"></svg>
          <div class="bartext">*${barcode}*</div>
          <div class="date">${date}</div>
        </div>
      </div>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<title>הדפסת מדבקות - ${projectName}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px;
    background: #f3f3f3;
    font-family: "Heebo", "Arial Hebrew", Arial, sans-serif;
    color: #000;
  }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    background: #fff; padding: 10px; border-bottom: 1px solid #ccc;
    display: flex; justify-content: space-between; align-items: center;
    margin: -12px -12px 16px;
  }
  .toolbar button {
    background: #111; color: #fff; border: 0; padding: 8px 16px;
    border-radius: 6px; cursor: pointer; font-size: 14px;
  }
  .label {
    display: flex;
    width: 105mm;
    height: 40mm;
    background: #fff;
    border: 1px solid #000;
    margin: 0 auto 6mm;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .weight-side {
    width: 38%;
    border-left: 1px solid #000;
    display: flex;
    align-items: center;
    padding: 3mm;
    gap: 2mm;
  }
  .bar-vert { width: 8mm; height: 100%; }
  .weight-text { flex: 1; text-align: center; line-height: 1; }
  .wlabel { font-size: 11pt; font-weight: 600; }
  .wvalue { font-size: 28pt; font-weight: 800; margin: 1mm 0; }
  .wunit  { font-size: 12pt; font-weight: 700; }
  .info-side {
    flex: 1; padding: 2.5mm 3mm;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .info-side.full { width: 100%; }
  .type { font-size: 14pt; font-weight: 800; line-height: 1; }
  .side { font-size: 12pt; font-weight: 700; line-height: 1; margin-top: 0.5mm; }
  .loc  { font-size: 10pt; font-weight: 600; margin-top: 1mm; }
  .code { font-size: 10pt; font-weight: 600; }
  .bar-horiz { width: 100%; height: 11mm; margin-top: 1mm; }
  .bartext { font-family: monospace; font-size: 8pt; text-align: center; letter-spacing: 0.5px; }
  .date { font-size: 9pt; font-weight: 600; text-align: left; direction: ltr; }
  @media print {
    body { background: #fff; padding: 0; }
    .toolbar { display: none; }
    .label { border-color: #000; margin: 0 auto 4mm; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <strong>הדפסת מדבקות – ${projectName} (${rows.length})</strong>
    <button onclick="window.print()">🖨️ הדפס</button>
  </div>
  ${labels}
  <script>
    document.querySelectorAll('svg.bar-horiz').forEach(function(svg){
      try {
        JsBarcode(svg, svg.getAttribute('data-barcode'), {
          format: "CODE128", displayValue: false,
          margin: 0, height: 40, width: 1.6
        });
      } catch (e) { console.error(e); }
    });
    document.querySelectorAll('svg.bar-vert').forEach(function(svg, i){
      try {
        JsBarcode(svg, "W" + (i+1), {
          format: "CODE128", displayValue: false,
          margin: 0, height: 30, width: 1.4
        });
        svg.style.transform = 'rotate(90deg)';
      } catch (e) {}
    });
  </script>
</body>
</html>`;
}

export default function BarcodesTab({ items: itemsProp, projectName }: { items: ProjectItem[]; projectName: string }) {
  const { id: projectId } = useParams<{ id: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<LabelRow[]>([]);
  const [, force] = useState(0);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = itemsProp;

  /** Resolved per-row: matched item id + which barcode value will be used. */
  const resolved = useMemo(() => {
    return rows.map(r => {
      const matched =
        r.matchedItemId === null
          ? null
          : r.matchedItemId
          ? items.find(i => i.id === r.matchedItemId) || null
          : matchItem(r, items);
      const item = matched;
      let barcode = "";
      let source: "excel" | "existing" | "generated" | "" = "";
      if (item) {
        if (r.barcode) { barcode = r.barcode; source = "excel"; }
        else if (item.barcode && !item.barcode.startsWith("ALM-")) { barcode = item.barcode; source = "existing"; }
        else if (item.barcode) { barcode = item.barcode; source = "existing"; }
        else if (projectId) { barcode = generateBarcode(projectId, item); source = "generated"; }
      }
      return { row: r, item, barcode, source };
    });
  }, [rows, items, projectId]);

  const matchedCount = resolved.filter(r => r.item).length;
  const unmatchedCount = resolved.length - matchedCount;

  const handleFile = async (f: File | null) => {
    setFile(f);
    setRows([]);
    if (!f) return;
    setParsing(true);
    try {
      const parsed = await parseLabelExcel(f);
      setRows(parsed);
      if (parsed.length === 0) toast.warning("לא נמצאו שורות בקובץ");
      else toast.success(`נטענו ${parsed.length} שורות מהקובץ`);
    } catch {
      toast.error("שגיאה בקריאת הקובץ");
    } finally {
      setParsing(false);
    }
  };

  const setRowItem = (rowIdx: number, itemId: string | "") => {
    setRows(prev => prev.map((r, i) =>
      i === rowIdx ? { ...r, matchedItemId: itemId === "" ? null : itemId } : r
    ));
  };

  const handleSave = () => {
    if (!projectId) return;
    let saved = 0;
    resolved.forEach(({ item, barcode }) => {
      if (item && barcode) {
        item.barcode = barcode;
        saved++;
      }
    });
    force(k => k + 1);
    toast.success(`עודכנו ברקודים עבור ${saved} פריטים`);
  };

  const handlePrint = () => {
    const toPrint = resolved.filter(r => r.item && r.barcode) as {
      row: LabelRow; item: ProjectItem; barcode: string;
    }[];
    if (toPrint.length === 0) {
      toast.error("אין פריטים מותאמים להדפסה");
      return;
    }
    const html = buildPrintHtml(toPrint, projectName);
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("חלון ההדפסה נחסם — אפשר חלונות קופצים");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const handleReset = () => {
    setFile(null);
    setRows([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Upload card */}
      <div className="surface-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold">הפקת ברקודים ושליחה להדפסה</h3>
              <p className="text-xs text-muted-foreground">
                העלה קובץ Excel עם עמודות: <span className="font-mono">IfcGUID</span>, <span className="font-mono">Side/חזית</span>, <span className="font-mono">Floor/קומה</span>, <span className="font-mono">Unit/מיקום</span>, <span className="font-mono">Type</span>, <span className="font-mono">Code</span>, <span className="font-mono">Weight</span>, <span className="font-mono">Barcode</span> (אופציונלי)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <label className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-background/60 hover:bg-secondary hover:border-primary cursor-pointer text-sm font-medium transition">
              <Upload className="w-4 h-4" />
              {file ? "החלף קובץ" : "העלאת קובץ"}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0] || null)}
              />
            </label>
            {file && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border bg-background/60 text-xs hover:bg-secondary transition"
                title="איפוס"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                איפוס
              </button>
            )}
          </div>
        </div>

        {file && (
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-border/40">
            <div className="text-xs text-muted-foreground">
              קובץ: <span className="font-medium text-foreground">{file.name}</span>
              {" · "}
              {parsing ? (
                <span className="text-primary">מנתח...</span>
              ) : rows.length > 0 ? (
                <>
                  <span className="text-status-completed">{matchedCount} שובצו</span>
                  {unmatchedCount > 0 && <> · <span className="text-status-rejected">{unmatchedCount} ללא התאמה</span></>}
                </>
              ) : (
                <span>אין שורות</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={matchedCount === 0}>
                <Save className="w-4 h-4" />
                שמור ברקודים לפריטים
              </Button>
              <Button onClick={handlePrint} disabled={matchedCount === 0}>
                <Printer className="w-4 h-4" />
                הפק לשליחה להדפסה
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Rows table */}
      {rows.length > 0 && (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["#", "IFC GUID", "חזית", "קומה", "מיקום", "סוג", "קוד", "התאמה לפריט", "ברקוד", "מקור"].map(h => (
                    <th key={h} className="text-right px-3 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resolved.map(({ row, item, barcode, source }, idx) => {
                  const isMatched = !!item;
                  const isManual = row.matchedItemId !== undefined;
                  return (
                    <tr key={idx} className={`border-b border-border/40 last:border-0 transition-colors ${
                      !isMatched ? "bg-status-rejected/5" : "hover:bg-muted/30"
                    }`}>
                      <td className="px-3 py-2 text-xs font-inter tabular-nums text-muted-foreground">{row.rowIndex}</td>
                      <td className="px-3 py-2 text-xs font-mono truncate max-w-[120px]" title={row.ifcGuid}>{row.ifcGuid || "—"}</td>
                      <td className="px-3 py-2 text-xs">{row.side || "—"}</td>
                      <td className="px-3 py-2 text-xs font-inter tabular-nums">{row.floor ?? "—"}</td>
                      <td className="px-3 py-2 text-xs font-inter tabular-nums">{row.unit ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{row.type || "—"}</td>
                      <td className="px-3 py-2 text-xs font-mono">{row.unitCode || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {isMatched ? (
                            <span className="inline-flex items-center gap-1 text-status-completed text-xs">
                              <Check className="w-3.5 h-3.5" />
                              <span className="font-mono">{item.id}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-status-rejected text-xs">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              ללא התאמה
                            </span>
                          )}
                          <select
                            value={row.matchedItemId ?? (item?.id ?? "")}
                            onChange={e => setRowItem(idx, e.target.value)}
                            className="h-7 max-w-[140px] bg-background/60 border border-border rounded text-[11px] px-1"
                            title="בחר פריט ידנית"
                          >
                            <option value="">— דלג —</option>
                            {items.map(it => (
                              <option key={it.id} value={it.id}>
                                {it.side} · קומה {it.floor} · מיקום {it.unit}
                              </option>
                            ))}
                          </select>
                          {isManual && (
                            <button
                              onClick={() => setRows(prev => prev.map((r, i) => i === idx ? { ...r, matchedItemId: undefined } : r))}
                              className="text-muted-foreground hover:text-foreground"
                              title="בטל בחירה ידנית"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono">{barcode || "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {source === "excel" && <span className="text-primary">מהקובץ</span>}
                        {source === "existing" && <span className="text-muted-foreground">קיים</span>}
                        {source === "generated" && <span className="text-status-in-progress">נוצר</span>}
                        {!source && "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 && !file && (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground">
          העלה קובץ Excel כדי להתחיל. הברקודים שיופקו ישובצו לפריטים בפרויקט ויופיעו אוטומטית במסך הפריטים ובמודל.
        </div>
      )}
    </div>
  );
}
