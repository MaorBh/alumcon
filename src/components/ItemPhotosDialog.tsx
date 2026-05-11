import { useState } from "react";
import { X, ImageIcon } from "lucide-react";
import { SCAN_LOG, getStationName } from "@/scan/scanData";

const actionLabels: Record<string, string> = {
  station_pass: "אישור תחנה",
  station_reject: "פסילת תחנה",
  qc_pass: "אישור בקר",
  qc_reject: "פסילת בקר",
  qc_final: "אישור סופי",
};

interface Props {
  itemId: string;
  barcode: string;
  onClose: () => void;
}

export default function ItemPhotosDialog({ itemId, barcode, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const records = SCAN_LOG.filter((r) => r.itemId === itemId && r.photos.length > 0);
  const total = records.reduce((s, r) => s + r.photos.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">תמונות מסריקות</h3>
              <p className="text-[11px] text-muted-foreground font-mono">{barcode} · {total} תמונות</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="סגור"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {records.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              לא קיימות תמונות עבור פריט זה
            </div>
          ) : (
            records.map((r) => (
              <div key={r.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {actionLabels[r.action] || r.action}
                    {r.stationId && ` · ${getStationName(r.stationId)}`}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(r.timestamp).toLocaleString("he-IL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  ע״י: <span className="text-foreground">{r.username}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {r.photos.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPreview(p)}
                      className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:border-primary transition"
                    >
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                {r.notes && (
                  <p className="text-xs text-muted-foreground italic">"{r.notes}"</p>
                )}
              </div>
            ))
          )}
        </div>

        {preview && (
          <div
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setPreview(null)}
          >
            <button
              type="button"
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/20 backdrop-blur flex items-center justify-center text-white"
              onClick={() => setPreview(null)}
              aria-label="סגור"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={preview} alt="" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>
    </div>
  );
}
