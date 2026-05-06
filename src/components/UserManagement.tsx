import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, UserPlus, Shield, ShieldCheck, HardHat } from "lucide-react";
import {
  AppRole,
  AppUser,
  ROLE_LABELS,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "@/auth/users";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";

const ROLE_ICONS: Record<AppRole, typeof Shield> = {
  admin: Shield,
  qc: ShieldCheck,
  worker: HardHat,
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  qc: "bg-status-in-progress/15 text-status-in-progress border-status-in-progress/30",
  worker: "bg-secondary text-secondary-foreground border-border",
};

interface FormState {
  username: string;
  displayName: string;
  password: string;
  role: AppRole;
  active: boolean;
}

const EMPTY: FormState = {
  username: "",
  displayName: "",
  password: "",
  role: "worker",
  active: true,
};

export default function UserManagement() {
  const { user: current } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const refresh = () => setUsers(listUsers());

  useEffect(() => {
    refresh();
    window.addEventListener("app-users-changed", refresh);
    return () => window.removeEventListener("app-users-changed", refresh);
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({
      username: u.username,
      displayName: u.displayName,
      password: u.password,
      role: u.role,
      active: u.active,
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.username.trim() || !form.displayName.trim() || !form.password.trim()) {
      toast.error("נא למלא את כל השדות");
      return;
    }
    try {
      if (editing) {
        updateUser(editing.id, form);
        toast.success("המשתמש עודכן");
      } else {
        createUser(form);
        toast.success("משתמש נוצר");
      }
      setOpen(false);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "שגיאה");
    }
  };

  const remove = (u: AppUser) => {
    if (current?.id === u.id) {
      toast.error("לא ניתן למחוק את המשתמש המחובר");
      return;
    }
    if (!confirm(`למחוק את ${u.displayName}?`)) return;
    deleteUser(u.id);
    toast.success("המשתמש נמחק");
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">ניהול משתמשים</CardTitle>
          <CardDescription>
            ניהול משתמשי המערכת והרשאות (מנהל, בקר איכות, עובד)
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="gap-2">
              <UserPlus className="w-4 h-4" />
              משתמש חדש
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{editing ? "עריכת משתמש" : "משתמש חדש"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>שם משתמש</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={!!editing}
                  placeholder="לדוגמה: john"
                />
              </div>
              <div className="space-y-1.5">
                <Label>שם תצוגה</Label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="שם מלא"
                />
              </div>
              <div className="space-y-1.5">
                <Label>סיסמה</Label>
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>הרשאה</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">מנהל</SelectItem>
                    <SelectItem value="qc">בקר איכות</SelectItem>
                    <SelectItem value="worker">עובד</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-medium text-sm">פעיל</div>
                  <div className="text-xs text-muted-foreground">
                    משתמש לא פעיל לא יוכל להתחבר
                  </div>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                ביטול
              </Button>
              <Button onClick={submit}>{editing ? "שמור" : "צור"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם תצוגה</TableHead>
              <TableHead className="text-right">שם משתמש</TableHead>
              <TableHead className="text-right">הרשאה</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const Icon = ROLE_ICONS[u.role];
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.displayName}</TableCell>
                  <TableCell className="font-mono text-xs">{u.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 ${ROLE_COLORS[u.role]}`}>
                      <Icon className="w-3 h-3" />
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.active ? (
                      <span className="text-xs text-status-completed font-medium">פעיל</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">מושבת</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(u)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(u)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
