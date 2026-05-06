import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, ShieldCheck, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import ScanLayout from "@/scan/ScanLayout";
import BarcodeInput from "@/scan/BarcodeInput";
import ItemInfoCard from "@/scan/ItemInfoCard";
import PhotoCapture from "@/scan/PhotoCapture";
import { getCurrentUser } from "@/scan/scanAuth";
import { findItemByBarcode, recordQcScan } from "@/scan/scanData";
import { ProjectItem } from "@/data/mockData";

type QcDecision = "qc_pass" | "qc_reject" | "qc_final";

const decisionMeta: Record<
  QcDecision,
  {
    label: string;
    icon: typeof CheckCircle2;
    toast: string;
    activeClass: string;
  }
> = {
  qc_pass: {
    label: "אישור תחנה",
    icon: CheckCircle2,
    toast: "התחנה אושרה",
    activeClass: "border-status-completed bg-status-completed/15 text-status-completed",
  },
  qc_reject: {
    label: "פסילה",
    icon: XCircle,
    toast: "הפריט נפסל",
    activeClass: "border-status-rejected bg-status-rejected/15 text-status-rejected",
  },
  qc_final: {
    label: "אישור סופי",
    icon: ShieldCheck,
    toast: "אישור QC סופי נרשם",
    activeClass: "border-primary bg-primary/15 text-primary",
  },
};

export default function QcScan() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [barcode, setBarcode] = useState("");
  const [item, setItem] = useState<ProjectItem | null>(null);
  const [projectId, setProjectId] = useState("");
  const [decision, setDecision] = useState<QcDecision | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user || user.role !== "qc") navigate("/scan/login", { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  const reset = () => {
    setBarcode("");
    setItem(null);
    setProjectId("");
    setDecision(null);
    setPhotos([]);
    setNotes("");
  };

  const handleScan = () => {
    const found = findItemByBarcode(barcode);
    if (!found) {
      toast.error("ברקוד לא נמצא במערכת");
      return;
    }
    setItem(found.item);
    setProjectId(found.projectId);
  };

  const handleSubmit = () => {
    if (!item || !decision) {
      toast.error("יש לבחור פעולה");
      return;
    }
    if (decision === "qc_reject" && photos.length === 0) {
      toast.error("בפסילה חובה לצרף לפחות תמונה אחת");
      return;
    }
    recordQcScan({
      item,
      projectId,
      username: user.username,
      action: decision,
      photos,
      notes: notes.trim() || undefined,
    });
    toast.success(decisionMeta[decision].toast);
    reset();
  };

  return (
    <ScanLayout user={user} title="בקרת איכות">
      <div className="space-y-4">
        <BarcodeInput value={barcode} onChange={setBarcode} onSubmit={handleScan} />

        {!item && (
          <button
            onClick={handleScan}
            disabled={!barcode.trim()}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-40 hover:bg-primary/90 transition"
          >
            חפש פריט
          </button>
        )}

        {item && (
          <>
            <ItemInfoCard item={item} projectId={projectId} />

            <div className="surface-card p-4 space-y-3">
              <div className="text-sm font-semibold">פעולת בקר</div>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(decisionMeta) as QcDecision[]).map((key) => {
                  const meta = decisionMeta[key];
                  const Icon = meta.icon;
                  const active = decision === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setDecision(key)}
                      className={`h-14 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition ${
                        active
                          ? meta.activeClass
                          : "border-border bg-background text-muted-foreground hover:border-foreground/40"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="surface-card p-4">
              <PhotoCapture
                photos={photos}
                onChange={setPhotos}
                max={3}
                required={decision === "qc_reject"}
              />
              {decision !== "qc_reject" && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  צילום הוא רשות בפעולה זו
                </p>
              )}
            </div>

            <div className="surface-card p-4 space-y-2">
              <label className="text-sm font-semibold">
                הערות{" "}
                {decision === "qc_reject" && <span className="text-status-rejected">*</span>}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="הערות בקר איכות..."
                className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2 sticky bottom-2">
              <button
                onClick={handleSubmit}
                disabled={!decision}
                className="h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition shadow-lg shadow-primary/30 disabled:opacity-40"
              >
                <Send className="w-5 h-5" />
                שלח
              </button>
              <button
                onClick={reset}
                className="h-14 px-4 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </ScanLayout>
  );
}
