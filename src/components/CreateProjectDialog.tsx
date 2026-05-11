import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Upload, ChevronLeft, ChevronRight, FolderKanban, Building2, FileSpreadsheet, Check } from "lucide-react";
import { STATIONS, type StationId, type ImportedItem } from "@/data/mockData";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const ALL_SIDES = ["S-South", "S-East", "S-North", "S-West"];

interface ProjectFormData {
  name: string;
  description: string;
  sides: string[];
  floorFrom: number;
  floorTo: number;
  unitsPerFloor: Record<string, number>;
  enabledStations: StationId[];
  file: File | null;
  parsedItems: ImportedItem[];
}

const STEPS = ["פרטי פרויקט", "הגדרת מבנה", "תחנות ייצור", "העלאת קובץ", "סיכום"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (data: ProjectFormData) => void;
}

// Detect column name (Hebrew + English variants)
function detectColumn(headers: string[], candidates: string[]): string | undefined {
  const lower = headers.map(h => h?.toString().trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

async function parseExcelFile(file: File): Promise<ImportedItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (rows.length === 0) { resolve([]); return; }

        const headers = Object.keys(rows[0]);
        // IfcGUID – primary BIM linkage key
        const colIfcGuid = detectColumn(headers, [
          "IfcGUID", "ifcguid", "IFCGUID", "IFC GUID",
          "GlobalId", "globalid", "GLOBALID",
          "GUID", "guid",
        ]);
        // Floor / קומה
        const colFloor   = detectColumn(headers, ["Floor", "קומה", "FLOOR", "floor", "Koma"]);
        // Unit identifier / מזהה יחידה
        const colUnit    = detectColumn(headers, [
          "UNIT_ID", "מזהה", "Unit", "יחידה",
          "UNIT_NAME", "שם היחידה", "unit", "UNIT", "דירה",
        ]);
        // Facade / חזית
        const colSide    = detectColumn(headers, ["חזית", "Side", "side", "SIDE", "Facade"]);
        // Element type / סוג
        const colType    = detectColumn(headers, [
          "TYPE", "סוג", "Type", "type", "Window", "חלון", "Category",
        ]);
        // Barcode / ברקוד  (fallback: UNIT_ID / מזהה)
        const colBarcode = detectColumn(headers, [
          "Barcode", "ברקוד", "barcode", "BARCODE",
          "UNIT_ID", "מזהה", "Code",
        ]);
        // Width / אורך
        const colWidth   = detectColumn(headers, ["WIDTH", "אורך", "Width", "width"]);
        // Height / גובה
        const colHeight  = detectColumn(headers, ["HEIGHT", "גובה", "Height", "height"]);

        // Helper: extract numeric part from a value like "קומה 3" or "Floor 3" or just "3"
        const toNum = (v: unknown): number | undefined => {
          const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
          return isNaN(n) || n === 0 ? undefined : n;
        };

        const items: ImportedItem[] = rows
          .map(row => {
            const ifcGuid = colIfcGuid ? String(row[colIfcGuid] ?? "").trim() : "";
            if (!ifcGuid) return null;
            return {
              ifcGuid,
              barcode: colBarcode ? String(row[colBarcode] ?? "").trim() || undefined : undefined,
              type:    colType    ? String(row[colType]    ?? "").trim() || undefined : undefined,
              floor:   colFloor   ? toNum(row[colFloor])                              : undefined,
              unit:    colUnit    ? toNum(row[colUnit])                               : undefined,
              side:    colSide    ? String(row[colSide]    ?? "").trim() || undefined : undefined,
              width:   colWidth   ? toNum(row[colWidth])                              : undefined,
              height:  colHeight  ? toNum(row[colHeight])                             : undefined,
            } as ImportedItem;
          })
          .filter((item): item is ImportedItem => item !== null);

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function CreateProjectDialog({ open, onOpenChange, onProjectCreated }: Props) {
  const [step, setStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [form, setForm] = useState<ProjectFormData>({
    name: "",
    description: "",
    sides: [...ALL_SIDES],
    floorFrom: 1,
    floorTo: 10,
    unitsPerFloor: { "S-South": 10, "S-East": 8, "S-North": 8, "S-West": 10 },
    enabledStations: STATIONS.map(s => s.id),
    file: null,
    parsedItems: [],
  });

  const reset = () => {
    setStep(0);
    setForm({
      name: "",
      description: "",
      sides: [...ALL_SIDES],
      floorFrom: 1,
      floorTo: 10,
      unitsPerFloor: { "S-South": 10, "S-East": 8, "S-North": 8, "S-West": 10 },
      enabledStations: STATIONS.map(s => s.id),
      file: null,
      parsedItems: [],
    });
  };

  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 1) return form.sides.length > 0 && form.floorFrom <= form.floorTo;
    if (step === 2) return form.enabledStations.length > 0;
    return true;
  };

  const handleSubmit = () => {
    onProjectCreated(form);
    toast.success(`פרויקט "${form.name}" נוצר בהצלחה`);
    reset();
    onOpenChange(false);
  };

  const handleFileChange = async (f: File | null) => {
    setForm(prev => ({ ...prev, file: f, parsedItems: [] }));
    if (!f) return;
    setParsing(true);
    try {
      const items = await parseExcelFile(f);
      setForm(prev => ({ ...prev, parsedItems: items }));
      if (items.length > 0) {
        toast.success(`נמצאו ${items.length} פריטים עם IfcGUID בקובץ`);
      } else {
        toast.warning("לא נמצאו פריטים עם IfcGUID בקובץ — ודא שהעמודה נקראת IfcGUID או GlobalId");
      }
    } catch {
      toast.error("שגיאה בקריאת הקובץ");
    } finally {
      setParsing(false);
    }
  };

  const toggleSide = (side: string) => {
    setForm(f => ({
      ...f,
      sides: f.sides.includes(side) ? f.sides.filter(s => s !== side) : [...f.sides, side],
    }));
  };

  const toggleStation = (id: StationId) => {
    setForm(f => ({
      ...f,
      enabledStations: f.enabledStations.includes(id)
        ? f.enabledStations.filter(s => s !== id)
        : [...f.enabledStations, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-primary" />
            הקמת פרויקט חדש
          </DialogTitle>
          <DialogDescription>מלא את הפרטים הנדרשים ליצירת הפרויקט</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-2 px-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary/20 text-primary border border-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`hidden sm:block w-6 h-px ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-center text-muted-foreground mb-4">{STEPS[step]}</p>

        {/* Step 0: Basic info */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם הפרויקט *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="לדוגמה: מגדל דרומי"
              />
            </div>
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="תיאור קצר של הפרויקט..."
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 1: Building config */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> חזיתות
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SIDES.map(side => (
                  <label
                    key={side}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.sides.includes(side)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <Checkbox
                      checked={form.sides.includes(side)}
                      onCheckedChange={() => toggleSide(side)}
                    />
                    <span className="text-sm">{side}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>טווח קומות</Label>
              <div className="flex items-center gap-3">
                <div className="space-y-1 flex-1">
                  <span className="text-xs text-muted-foreground">מקומה</span>
                  <Input
                    type="number"
                    min={1}
                    value={form.floorFrom}
                    onChange={e => setForm(f => ({ ...f, floorFrom: Number(e.target.value) }))}
                  />
                </div>
                <span className="mt-5 text-muted-foreground">—</span>
                <div className="space-y-1 flex-1">
                  <span className="text-xs text-muted-foreground">עד קומה</span>
                  <Input
                    type="number"
                    min={form.floorFrom}
                    value={form.floorTo}
                    onChange={e => setForm(f => ({ ...f, floorTo: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>יחידות לקומה (לפי חזית)</Label>
              <div className="grid grid-cols-2 gap-2">
                {form.sides.map(side => (
                  <div key={side} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{side}</span>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      className="h-8 text-sm"
                      value={form.unitsPerFloor[side] || 1}
                      onChange={e => setForm(f => ({
                        ...f,
                        unitsPerFloor: { ...f.unitsPerFloor, [side]: Number(e.target.value) },
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Stations */}
        {step === 2 && (
          <div className="space-y-3">
            <Label>בחר תחנות ייצור פעילות</Label>
            <div className="grid grid-cols-2 gap-2">
              {STATIONS.map(station => (
                <label
                  key={station.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.enabledStations.includes(station.id)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Checkbox
                    checked={form.enabledStations.includes(station.id)}
                    onCheckedChange={() => toggleStation(station.id)}
                  />
                  <span className="text-sm">{station.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: File upload */}
        {step === 3 && (
          <div className="space-y-4">
            <Label className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> העלאת קובץ פריטים (Excel / CSV)
            </Label>
            <p className="text-xs text-muted-foreground">
              העלה קובץ Excel עם עמודת <strong>IfcGUID</strong> (או GlobalId) לשיוך אוטומטי בין פריטי הפרויקט למודל BIM.
              עמודות נוספות שנתמכות: קומה, יחידה, חזית, סוג, ברקוד.
            </p>
            <label
              className={`flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                form.file
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className={`w-8 h-8 ${form.file ? "text-primary" : "text-muted-foreground"}`} />
              {form.file ? (
                <div className="text-center">
                  <p className="text-sm font-medium">{form.file.name}</p>
                  <p className="text-xs text-muted-foreground">{(form.file.size / 1024).toFixed(1)} KB</p>
                  {parsing && <p className="text-xs text-primary mt-1">מנתח קובץ...</p>}
                  {!parsing && form.parsedItems.length > 0 && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      ✓ {form.parsedItems.length} פריטים עם IfcGUID זוהו
                    </p>
                  )}
                  {!parsing && form.file && form.parsedItems.length === 0 && (
                    <p className="text-xs text-amber-500 mt-1">
                      ⚠ לא נמצאו פריטים עם IfcGUID
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">לחץ לבחירת קובץ</p>
                  <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv</p>
                </div>
              )}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => handleFileChange(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-xs text-muted-foreground">* שלב זה אופציונלי. ניתן להוסיף פריטים גם לאחר הקמת הפרויקט.</p>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">שם</span>
                <span className="text-sm font-semibold">{form.name}</span>
              </div>
              {form.description && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">תיאור</span>
                  <span className="text-sm">{form.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">חזיתות</span>
                <span className="text-sm">{form.sides.join(", ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">קומות</span>
                <span className="text-sm font-inter">{form.floorFrom}–{form.floorTo} ({form.floorTo - form.floorFrom + 1} קומות)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">תחנות</span>
                <span className="text-sm">{form.enabledStations.length} מתוך {STATIONS.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">קובץ</span>
                <span className="text-sm">{form.file ? form.file.name : "לא הועלה"}</span>
              </div>
              {form.parsedItems.length > 0 ? (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">פריטים מהקובץ</span>
                  <span className="text-sm font-inter font-bold text-primary">{form.parsedItems.length}</span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">סה״כ פריטים (משוער)</span>
                  <span className="text-sm font-inter font-bold text-primary">
                    {form.sides.reduce((sum, side) => sum + (form.unitsPerFloor[side] || 1) * (form.floorTo - form.floorFrom + 1), 0)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>
              <ChevronRight className="w-4 h-4" />
              הקודם
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
              הבא
              <ChevronLeft className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit}>
              <Plus className="w-4 h-4" />
              צור פרויקט
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}