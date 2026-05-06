import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import ScanLayout from "@/scan/ScanLayout";
import BarcodeInput from "@/scan/BarcodeInput";
import ItemInfoCard from "@/scan/ItemInfoCard";
import ExistingPhotos from "@/scan/ExistingPhotos";
import PhotoCapture from "@/scan/PhotoCapture";
import { getCurrentUser } from "@/scan/scanAuth";
import { findItemByBarcode, getStationName, recordStationScan } from "@/scan/scanData";
import { ProjectItem } from "@/data/mockData";

export default function StationScan() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [barcode, setBarcode] = useState("");
  const [item, setItem] = useState<ProjectItem | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [decision, setDecision] = useState<"pass" | "fail" | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user || user.role !== "station" || !user.stationId) {
      navigate("/scan/login", { replace: true });
    }
  }, [user, navigate]);

  if (!user || !user.stationId) return null;

  const reset = () => {
    setBarcode("");
    setItem(null);
    setProjectId("");
    setPhotos([]);
    setDecision(null);
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
    setDecision("pass"); // default
  };

  const handleSubmit = () => {
    if (!item || !decision) return;
    if (decision === "fail" && photos.length === 0) {
      toast.error("בפסילה חובה לצרף לפחות תמונה אחת");
      return;
    }
    recordStationScan({
      item,
      projectId,
      username: user.username,
      stationId: user.stationId!,
      passed: decision === "pass",
      photos,
      notes: notes.trim() || undefined,
    });
    toast.success(decision === "pass" ? "אושר ונשלח" : "נפסל ונשלח");
    reset();
  };

  return (
    <ScanLayout user={user} title={`תחנת ${getStationName(user.stationId)}`}>
      <div className="space-y-4">
        <BarcodeInput
          value={barcode}
          onChange={setBarcode}
          onSubmit={handleScan}
          placeholder="סרוק או הקלד ברקוד..."
        />

        {!item && (
          <button
            onClick={handleScan}
            disabled={!barcode.trim()}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition"
          >
            חפש פריט
          </button>
        )}

        {item && (
          <>
            <ItemInfoCard item={item} projectId={projectId} />
            <ExistingPhotos itemId={item.id} />

            <div className="surface-card p-4 space-y-3">
              <div className="text-sm font-semibold">החלטה</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDecision("pass")}
                  className={`h-14 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition ${
                    decision === "pass"
                      ? "border-status-completed bg-status-completed/15 text-status-completed"
                      : "border-border bg-background text-muted-foreground hover:border-status-completed/60"
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  אישור תחנה
                </button>
                <button
                  onClick={() => setDecision("fail")}
                  className={`h-14 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition ${
                    decision === "fail"
                      ? "border-status-rejected bg-status-rejected/15 text-status-rejected"
                      : "border-border bg-background text-muted-foreground hover:border-status-rejected/60"
                  }`}
                >
                  <XCircle className="w-5 h-5" />
                  פסילה
                </button>
              </div>
            </div>

            <div className="surface-card p-4">
              <PhotoCapture
                photos={photos}
                onChange={setPhotos}
                max={3}
                required={decision === "fail"}
              />
            </div>

            {decision === "fail" && (
              <div className="surface-card p-4 space-y-2">
                <label className="text-sm font-semibold">סיבת פסילה</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="תיאור הפגם..."
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-2 sticky bottom-2">
              <button
                onClick={handleSubmit}
                className="h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition shadow-lg shadow-primary/30"
              >
                <Send className="w-5 h-5" />
                שלח
              </button>
              <button
                onClick={reset}
                className="h-14 px-4 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                aria-label="התחל מחדש"
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
