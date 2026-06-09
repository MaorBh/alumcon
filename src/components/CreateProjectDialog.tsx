import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Upload, ChevronLeft, ChevronRight, FolderKanban, Building2, FileSpreadsheet, Check } from "lucide-react";
import { STATIONS, type StationId, type ImportedItem, type PriorityCatalogRow, parsePriorityRows } from "@/data/mockData";
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
  priorityProjectNumber: string;
  priorityFile: File | null;
  priorityCatalog: PriorityCatalogRow[];
}

const STEPS = ["פרטי פרויקט", "Priority", "העלאת קובץ", "סיכום"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (data: ProjectFormData) => void;
}



async function parseExcelFile(file: File): Promise<ImportedItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Read as array-of-arrays to handle title rows
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (rawRows.length < 2) { resolve([]); return; }

        // Find the actual header row: the first row with 3+ non-empty cells
        let headerIdx = -1;
        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const nonEmpty = rawRows[r].filter(c => c !== "" && c != null).length;
          if (nonEmpty >= 3) { headerIdx = r; break; }
        }
        if (headerIdx < 0) { resolve([]); return; }

        const rawHeaders = rawRows[headerIdx].map(h => String(h ?? "").trim());
        const lowerHeaders = rawHeaders.map(h => h.toLowerCase());

        // Column finder (case-insensitive)
        function findCol(candidates: string[]): number {
          for (const c of candidates) {
            const idx = lowerHeaders.indexOf(c.toLowerCase());
            if (idx !== -1) return idx;
          }
          return -1;
        }

        const iIfcGuid    = findCol(["IfcGUID", "IFCGUID", "IFC GUID", "GlobalId", "GUID"]);
        const iUnitId     = findCol(["UNIT_ID", "מזהה"]);
        const iType       = findCol(["TYPE", "סוג"]);
        const iUnitName   = findCol(["Unit_NAME", "UNIT_NAME", "שם היחידה"]);
        const iWidth      = findCol(["WIDTH", "אורך"]);
        const iHeight     = findCol(["HEIGHT", "גובה"]);
        const iWindow     = findCol(["Window", "חלון"]);
        const iUnitArea   = findCol(["Unit_Area", "שטח"]);
        const iMashkofUp  = findCol(["Mashkof_UP", "משקוף עליון"]);
        const iMashkofDn  = findCol(["Mashkof_Down", "משקוף תחתון"]);
        const iFloor      = findCol(["Floor", "קומה"]);
        const iDone       = findCol(["Done", "בוצע"]);
        const iBarcode    = findCol(["Barcode", "ברקוד"]);
        const iSide       = findCol(["Side", "חזית"]);

        console.log("[Excel Parse] Headers:", rawHeaders);
        console.log("[Excel Parse] IfcGUID col:", iIfcGuid, "| UNIT_ID col:", iUnitId, "| Floor col:", iFloor);

        const items: ImportedItem[] = [];
        for (let r = headerIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.every(c => c === "" || c == null)) continue;

          const ifcGuid = iIfcGuid >= 0 ? String(row[iIfcGuid] ?? "").trim() : "";
          if (!ifcGuid) continue;

          const floorRaw = iFloor >= 0 ? String(row[iFloor] ?? "").trim() : "";
          const floorNum = parseInt(floorRaw.replace(/[^0-9]/g, ""), 10) || undefined;

          // Extract unit number from UNIT_ID like "F01-13" → 13
          const unitIdRaw = iUnitId >= 0 ? String(row[iUnitId] ?? "").trim() : "";
          const unitMatch = unitIdRaw.match(/-(\d+)$/);
          const unitNum = unitMatch ? parseInt(unitMatch[1], 10) : undefined;

          items.push({
            ifcGuid,
            barcode:     iBarcode >= 0 ? String(row[iBarcode] ?? "").trim() || unitIdRaw || undefined
                                       : unitIdRaw || undefined,
            type:        iType >= 0       ? String(row[iType] ?? "").trim() || undefined       : undefined,
            floor:       floorNum,
            unit:        unitNum,
            side:        iSide >= 0       ? String(row[iSide] ?? "").trim() || undefined       : undefined,
            width:       iWidth >= 0      ? (Number(row[iWidth]) || undefined)                 : undefined,
            height:      iHeight >= 0     ? (Number(row[iHeight]) || undefined)                : undefined,
            unitName:    iUnitName >= 0   ? String(row[iUnitName] ?? "").trim() || undefined   : undefined,
            unitArea:    iUnitArea >= 0   ? String(row[iUnitArea] ?? "").trim() || undefined   : undefined,
            window:      iWindow >= 0     ? String(row[iWindow] ?? "").trim() || undefined     : undefined,
            mashkofUp:   iMashkofUp >= 0  ? String(row[iMashkofUp] ?? "").trim() || undefined  : undefined,
            mashkofDown: iMashkofDn >= 0  ? String(row[iMashkofDn] ?? "").trim() || undefined  : undefined,
            done:        iDone >= 0       ? String(row[iDone] ?? "").trim() || undefined       : undefined,
            floorLabel:  floorRaw || undefined,
          });
        }
        console.log("[Excel Parse] Parsed items:", items.length);
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

        {/* Step 1: File upload */}
        {step === 1 && (
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

        {/* Step 2: Summary */}
        {step === 2 && (
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
                <span className="text-sm text-muted-foreground">קובץ</span>
                <span className="text-sm">{form.file ? form.file.name : "לא הועלה"}</span>
              </div>
              {form.parsedItems.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">פריטים מהקובץ</span>
                  <span className="text-sm font-inter font-bold text-primary">{form.parsedItems.length}</span>
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