import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Palette, Users } from "lucide-react";
import UserManagement from "@/components/UserManagement";
import ReportSettingsCard from "@/components/ReportSettingsCard";
import { useAuth } from "@/auth/AuthContext";

export default function Settings() {
  const { hasRole } = useAuth();
  const [isLight, setIsLight] = useState(() => document.documentElement.classList.contains("light"));

  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    }
  }, [isLight]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">הגדרות כלליות</h2>
        <p className="text-muted-foreground mt-1">ניהול העדפות והרשאות המערכת</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="w-5 h-5" />
            מראה
          </CardTitle>
          <CardDescription>התאם את מראה המערכת להעדפותיך</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isLight ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5 text-primary" />}
              <Label htmlFor="theme-toggle" className="cursor-pointer">
                <div className="font-medium">מצב בהיר</div>
                <div className="text-sm text-muted-foreground">
                  {isLight ? "המערכת במצב בהיר" : "המערכת במצב כהה"}
                </div>
              </Label>
            </div>
            <Switch id="theme-toggle" checked={isLight} onCheckedChange={setIsLight} />
          </div>
        </CardContent>
      </Card>

      {hasRole("admin") ? (
        <UserManagement />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5" />
              ניהול משתמשים
            </CardTitle>
            <CardDescription>אזור זה זמין למנהלים בלבד</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">אודות המערכת</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>גרסה</span><span>1.0.0</span></div>
            <div className="flex justify-between"><span>פלטפורמה</span><span>אלומקון - מערכת ניהול ייצור</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
