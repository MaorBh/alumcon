# מסמך אפיון מערכת — Alumcon BIM & Production Tracker
**גרסה:** 1.0 | **תאריך:** מאי 2026 | **מחבר:** Vonoit  

---

## תוכן עניינים
1. [סקירה כללית](#1-סקירה-כללית)
2. [ארכיטקטורה טכנית](#2-ארכיטקטורה-טכנית)
3. [מודל הנתונים](#3-מודל-הנתונים)
4. [מודולי המערכת](#4-מודולי-המערכת)
5. [לוגיקות עסקיות](#5-לוגיקות-עסקיות)
6. [מערכת ההרשאות](#6-מערכת-ההרשאות)
7. [ממשק BIM](#7-ממשק-bim)
8. [אפליקציית הסריקה המובייל](#8-אפליקציית-הסריקה-המובייל)
9. [ממשקי API](#9-ממשקי-api)
10. [בדיקות ואיכות קוד](#10-בדיקות-ואיכות-קוד)
11. [ממצאי ביקורת ובאגים](#11-ממצאי-ביקורת-ובאגים)
12. [המלצות לשיפור](#12-המלצות-לשיפור)
13. [רשימת קבצים](#13-רשימת-קבצים)

---

## 1. סקירה כללית

### מטרת המערכת
מערכת Alumcon היא פלטפורמת ניהול ייצור ובקרת איכות למפעל אלומיניום (חלונות, ויטרינות וכד'). המערכת מאפשרת מעקב בזמן אמת אחר כל פריט ייצור לאורך שרשרת הייצור — מ-CNC ועד אישור סופי — ומשלבת מודל תלת-ממדי BIM לוויזואליזציה של ההתקדמות.

### קהל יעד
| תפקיד | גישה | שימוש עיקרי |
|-------|-------|-------------|
| מנהל (admin) | מלא | דשבורד, ניהול פרויקטים, ניהול משתמשים, BIM |
| בקר איכות (qc) | אפליקציית סריקה + מפקד | סריקת QC, אישור/פסילה |
| עובד תחנה (worker/station) | אפליקציית סריקה | רישום עמדת ייצור |

### טכנולוגיות
| שכבה | טכנולוגיה |
|------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| State | React useState/useRef + in-memory mockData |
| Routing | React Router v6 |
| BIM Backend | Node.js + Express (deployed: Render.com) |
| BIM Viewer | Autodesk Platform Services (APS) — SVF format |
| 3D Storage | Autodesk OSS Buckets |
| Testing | Vitest + @testing-library/react |
| CI/CD | GitHub → Lovable (Frontend) + Render (Backend) |

---

## 2. ארכיטקטורה טכנית

```
┌─────────────────────────────────────────────────────────┐
│                  BROWSER (Lovable CDN)                  │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Admin App  │  │  Scan App   │  │  BIM Viewer  │  │
│  │ (React SPA) │  │ /scan/*     │  │ (APS SDK)    │  │
│  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘  │
│         │                │                  │           │
│  localStorage      localStorage          VITE_API_URL   │
│  (users, session)  (scan-user)                          │
└──────────────────────────────────────┬──────────────────┘
                                       │ REST API /api/*
                              ┌────────┴────────┐
                              │  BIM Backend    │
                              │  (Render.com)   │
                              │  Node/Express   │
                              └────────┬────────┘
                                       │
                     ┌─────────────────┴──────────────────┐
                     │      Autodesk Platform Services      │
                     │  ┌─────────┐    ┌────────────────┐  │
                     │  │   OSS   │    │ Model Derivative│  │
                     │  │ Buckets │    │ API (SVF)       │  │
                     │  └─────────┘    └────────────────┘  │
                     └─────────────────────────────────────┘
```

### URL Structure
```
/               → Home (dashboard redirect)
/login          → כניסת מנהל
/projects       → רשימת פרויקטים
/projects/:id   → פרויקט — 5 לשוניות: דשבורד/גריד/BIM/פריטים/הגדרות
/items          → כלל הפריטים (cross-project)
/settings       → ניהול משתמשים
/scan/login     → כניסת עובד/בקר
/scan/station   → תחנת ייצור (מובייל)
/scan/qc        → בקרת איכות (מובייל)
```

---

## 3. מודל הנתונים

### Project
```typescript
interface Project {
  id: string;           // URL-safe slug  
  name: string;         // שם הפרויקט
  description: string;  
  createdAt: string;    // YYYY-MM-DD
  status: 'active' | 'completed' | 'on_hold';
  totalItems: number;   // מחושב אוטומטית
  completedItems: number; // מעודכן ב-updateItemStatus
  sides: string[];      // ['S-South','S-East','S-North','S-West']
  floors: number[];     // [21,22,...,33]
  urn?: string;         // APS URN אם קיים מודל BIM
}
```

### ProjectItem
```typescript
interface ProjectItem {
  id: string;          // '{projectId}-{index}'
  barcode: string;     // 'ALM-{PRJ}-{00001}'
  type: string;        // 'חלון' | 'ויטרינה'
  floor: number;
  unit: number;        // יחידה בתוך הקומה
  side: string;        // חזית הבניין
  status: ItemStatus;  // 'pending' | 'in_progress' | 'completed' | 'rejected'
  currentStation: StationId | null;
  stationHistory: StationHistoryEntry[];
  qcApproved: boolean;
}
```

### StationHistoryEntry
```typescript
interface StationHistoryEntry {
  station: StationId;        // תחנה
  timestamp: string;          // ISO8601
  result: 'pass' | 'fail';   // תוצאה
  notes?: string;             // הערת עובד/בקר
}
```

### ScanRecord
```typescript
interface ScanRecord {
  id: string;
  itemId: string;
  projectId: string;
  barcode: string;
  username: string;
  action: 'station_pass'|'station_reject'|'qc_pass'|'qc_reject'|'qc_final';
  stationId?: StationId;
  notes?: string;
  photos: string[];   // data URLs (base64) — אינן נשמרות
  timestamp: string;
}
```

### תחנות ייצור (STATIONS)
```
1. cnc       → CNC
2. frames    → מסגרות
3. glazing   → זיגוג
4. finishes  → פינישים
5. windows   → חלונות
6. vitrines  → ויטרינות
```

---

## 4. מודולי המערכת

### 4.1 דשבורד ראשי (Dashboard.tsx)
**מטרה:** תצוגת KPI מרכזית לכלל המפעל.

**רכיבים:**
- 4 כרטיסי KPI: סה"כ פריטים, הושלמו (+ %), בתהליך, נפסלו
- גריד 6 תחנות עם ספירות: פעילים/הושלמו/נפסלו
- טבלת פעילות אחרונה (8 שורות)
- רשימת פרויקטים עם %-התקדמות

**חישובים:**
```
allItems = concat(PROJECT_ITEMS.south-tower, PROJECT_ITEMS.north-tower, ...)
completedPct = completedItems / totalItems * 100
recentItems = allItems.filter(has history).sort(by last history timestamp).slice(0,8)
```

### 4.2 ניהול פרויקטים (Projects.tsx + CreateProjectDialog.tsx)
**מטרה:** יצירה וניהול של פרויקטים.

**תהליך יצירת פרויקט — 5 שלבים:**
```
שלב 0: שם + תיאור
שלב 1: חזיתות + קומות + יחידות לקומה
שלב 2: בחירת תחנות פעילות
שלב 3: העלאת קובץ Excel/CSV (אופציונלי — לא ממומש עדיין)
שלב 4: סיכום + אישור
```

**לוגיקת יצירה:**
```
totalItems = sides.reduce(side → floors.length × unitsPerFloor[side])
כל פריט חדש: status='pending', stationHistory=[], qcApproved=false
id = slugify(name) + '-' + Date.now().toString(36)
```

### 4.3 פרויקט — לשוניות (ProjectDetail.tsx)
5 לשוניות בפרויקט:

**לשונית דשבורד:**
- KPI: סה"כ/הושלמו/בתהליך/נפסלו
- סטטוס 6 תחנות (רק לפרויקט הנוכחי)
- פעילות אחרונה

**לשונית גריד:**
- בחירת חזית (S-South, S-East, S-North, S-West)
- גריד חלונות: שורה=קומה, עמודה=יחידה
- כל תא מורכב מ-2 שכבות: ייצור (עליון) + QC (תחתון)
- לחיצה על קומה: פרטי כל הפריטים בקומה עם סרגל תחנות

**לשונית מודל BIM:** ← ראה מדור 7

**לשונית פריטים:**
- טבלה עם חיפוש + פילטר סטטוס + פילטר תחנה
- מציג עד 100 שורות

**לשונית הגדרות:**
- פרטי הפרויקט בלבד (read-only)

### 4.4 רשימת פריטים כוללת (Items.tsx)
- טבלה לכלל הפריטים מכל הפרויקטים

### 4.5 ניהול משתמשים (Settings.tsx → UserManagement.tsx)
- CRUD מלא למשתמשי המערכת
- 3 תפקידים: admin, qc, worker

---

## 5. לוגיקות עסקיות

### 5.1 מחזור חיים של פריט
```
pending → in_progress → completed
                     ↘ rejected
                     
qc_final → completed (+ qcApproved=true)
qc_reject → rejected (+ history entry)
```

### 5.2 עדכון סטטוס (updateItemStatus)
```typescript
function updateItemStatus(projectId, itemId, newStatus):
  item.status = newStatus
  if newStatus === 'completed': item.qcApproved = true
  if newStatus === 'rejected':  item.qcApproved = false
  project.completedItems = items.filter(completed).length
```

### 5.3 רישום תחנה (recordStationScan)
```
אישור תחנה (passed=true):
  item.stationHistory.push({ station, result:'pass', timestamp })
  item.status = 'in_progress'
  item.currentStation = stationId

פסילת תחנה (passed=false):
  item.stationHistory.push({ station, result:'fail', timestamp, notes })
  item.status = 'rejected'
  item.currentStation = stationId
  ⚠ דרישה: לפחות תמונה אחת
```

### 5.4 רישום QC (recordQcScan)
```
qc_pass:   item.status = 'in_progress'
qc_reject: item.status = 'rejected', qcApproved=false,
           stationHistory.push({result:'fail'})
           ⚠ דרישה: לפחות תמונה אחת + הערות
qc_final:  item.status = 'completed', qcApproved=true,
           currentStation=null
```

### 5.5 חישוב % התקדמות
```
pct = completedItems / totalItems × 100
```

### 5.6 חישוב סטטוס QC
```typescript
function getQcStatus(item):
  if item.qcApproved → 'approved'
  if item.stationHistory.some(h → h.result === 'fail') → 'failed'
  else → 'not_checked'
```

### 5.7 מיון פעילות אחרונה
```typescript
items
  .filter(i => i.stationHistory.length > 0)
  .sort((a, b) => b.lastHistoryTimestamp.localeCompare(a.lastHistoryTimestamp))
  .slice(0, 8)
```

---

## 6. מערכת ההרשאות

### 6.1 Admin App (src/auth/)
```
localStorage key: "app-users"   → רשימת משתמשים (JSON)
localStorage key: "app-current-user" → ID של המשתמש המחובר

תפקידים: admin | qc | worker
סיסמאות: plaintext (⚠ לא מאובטח — ראה המלצות)
```

**ברירות מחדל:**
```
admin / admin  → role: admin
qc1   / 1234   → role: qc
worker1 / 1234 → role: worker
```

**RequireAuth:** מגן על כל נתיבי /projects, /items, /settings — מפנה ל-/login.

### 6.2 Scan App (src/scan/scanAuth.ts)
מערכת auth **נפרדת** לאפליקציית הסריקה:
```
localStorage key: "scan-current-user" → ScanUser (JSON)

תפקידים: station | qc
```

**משתמשי ברירת מחדל:**
```
cnc     / 1234 → station, stationId='cnc'
frames  / 1234 → station, stationId='frames'
glazing / 1234 → station, stationId='glazing'
finishes/ 1234 → station, stationId='finishes'
windows / 1234 → station, stationId='windows'
vitrines/ 1234 → station, stationId='vitrines'
qc1     / 1234 → qc
qc2     / 1234 → qc
```

**הפרדת auth:** עובד תחנה (/scan/station) מוגן ע"י `role==='station'`.
בקר איכות (/scan/qc) מוגן ע"י `role==='qc'`.

---

## 7. ממשק BIM

### 7.1 רכיב BimViewer (BimViewer.tsx)
**תלויות חיצוניות:**
- Autodesk Viewer 7.x (נטען דינמית מ-CDN)
- Backend: `https://alumcon-bim-server.onrender.com`

**מחזור חיים:**
```
1. טעינת URN:
   a. קרא מ-localStorage ("bim_urn_{projectId}")
   b. קרא מ-server (/api/project-urn/:projectId)
   c. אם server מחזיר URN → עדכן localStorage
   d. אם רק localStorage → restore ל-server

2. אתחול Viewer (כאשר URN קיים):
   a. GET /api/token → access_token
   b. Autodesk.Viewing.Initializer({ env:'AutodeskProduction' })
   c. GuiViewer3D.start()
   d. loadModel(urn)

3. המתנה להמרה (polling):
   GET /api/translate-status/:urn כל 4 שניות
   עד status==='success'

4. טעינת מודל:
   Autodesk.Viewing.Document.load("urn:" + urn)
   → loadDocumentNode(3D view)

5. מיפוי אלמנטים (buildMappings):
   getBulkProperties(["Name","Mark","IfcGUID","GlobalId","Tag"])
   ניסיון התאמה: item.barcode ↔ displayValue

6. לחיצה על אלמנט:
   SELECTION_CHANGED_EVENT → getProperties(dbId)
   → מציג פרטים בלוח הימני
   → setThemingColor לצבע הסטטוס
```

**צבעי סטטוס:**
```
pending     → אפור   [0.55, 0.55, 0.55, 1]
in_progress → צהוב   [0.98, 0.78, 0.18, 1]
completed   → ירוק   [0.22, 0.76, 0.30, 1]
rejected    → אדום   [0.88, 0.20, 0.20, 1]
נבחר        → ציאן   [0.02, 0.82, 0.96, 1]
```

**שמירת סטטוסים:**
```
localStorage key: "bim_statuses_{projectId}" → Record<dbId, ItemStatus>
```

### 7.2 Backend APS (server.js)
**Bucket:** `alumcon001` (persistent on APS)

**קבצים שתורגמו (SVF — בכל הbuckets):**
```
bim-tracker-your-company-name/TEST_109.rvt       ✅ success
bim-tracker-your-company-name/EGG_Assembly.stp   ✅ success
bim-tracker-your-company-name/Glass_YT_11-12.stp ✅ success
bimtracker001/TEST_109.rvt                        ✅ success
alumcon001/south-tower_TEST_109.rvt               ✅ success
```

**לוגיקת העלאה (skip re-translation):**
```
1. העלה קובץ ל-S3 (signed upload)
2. בנה URN
3. בדוק manifest — אם success → החזר URN מיד (ללא תרגום)
4. שלח job תרגום SVF
5. אם תרגום נכשל + manifest קיים → החזר URN
```

---

## 8. אפליקציית הסריקה המובייל

### 8.1 תחנת ייצור (StationScan.tsx)
```
URL: /scan/station
Auth: role=station + stationId required

תהליך:
1. סריקת ברקוד (input + Enter)
2. findItemByBarcode() — חיפוש בכל הפרויקטים
3. הצגת פרטי פריט + תמונות קיימות
4. בחירת החלטה: אישור / פסילה
5. [פסילה] חובה לצרף ≥1 תמונה + הערה
6. שליחה → recordStationScan()
7. toast הצלחה + איפוס
```

### 8.2 בקרת איכות (QcScan.tsx)
```
URL: /scan/qc
Auth: role=qc

תהליך:
1. סריקת ברקוד
2. הצגת פרטי פריט
3. בחירת החלטה: אישור תחנה / פסילה / אישור סופי
4. [פסילה] חובה: ≥1 תמונה + הערות
5. שליחה → recordQcScan()
6. toast + איפוס
```

### 8.3 BarcodeInput
- Input עם onKeyDown Enter → trigger onSubmit
- תומך בסורק ברקוד HID (כמו מקלדת)

### 8.4 PhotoCapture
- מצלמה (getUserMedia) — data URL base64
- מקסימום 3 תמונות
- אינן נשמרות בין סשנים (in-memory only)

---

## 9. ממשקי API

### 9.1 BIM Backend (server.js)

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/token` | APS access token |
| GET | `/api/project-urn/:projectId` | URN שמור לפרויקט |
| POST | `/api/upload-model/:projectId` | העלאת קובץ BIM |
| GET | `/api/translate-status/:urn` | סטטוס המרה |
| POST | `/api/restore-urn/:projectId` | שמירת URN מ-client |
| GET | `/api/available-models` | רשימת מודלים מתורגמים |

### 9.2 APS APIs בשימוש

| API | שימוש |
|-----|-------|
| Authentication v2 | client_credentials token |
| OSS v2 | יצירת bucket, signed upload, list objects |
| Model Derivative v2 | job תרגום SVF, manifest status |
| Viewer 7.x | טעינה, selection, theming colors |

---

## 10. בדיקות ואיכות קוד

### 10.1 קבצי בדיקה שנכתבו
```
src/test/mockData.test.ts    — 30+ בדיקות, מכסה:
  ✓ STATIONS — מבנה, סדר, שלמות
  ✓ PROJECTS — שדות חובה, סטטוס, עקביות totalItems
  ✓ PROJECT_ITEMS — ייחודיות ברקוד, pattern, status, qcApproved
  ✓ updateItemStatus — סטטוס, qcApproved, completedItems
  ✓ addProject — יצירה, ספירת פריטים, status=pending
  ✓ getStationStats — כיסוי כל תחנות

src/test/users.test.ts       — 25+ בדיקות, מכסה:
  ✓ listUsers — seed, שדות, ברירות מחדל
  ✓ login — אישורים נכונים/שגויים, case-insensitive, trim, inactive
  ✓ logout — ניקוי session
  ✓ getCurrentUser — null/logged
  ✓ createUser — הוספה, כניסה, duplicate
  ✓ updateUser / deleteUser

src/test/scanData.test.ts    — 20+ בדיקות, מכסה:
  ✓ findItemByBarcode — מציאה, trim, null, empty
  ✓ getProjectName / getStationName — נכון + fallback
  ✓ recordStationScan — pass/fail, history, status, SCAN_LOG
  ✓ recordQcScan — כל 3 פעולות, history, SCAN_LOG

src/test/scanAuth.test.ts    — 15+ בדיקות, מכסה:
  ✓ SCAN_USERS — מבנה, roles, stationId
  ✓ login/logout/getCurrentUser
```

### 10.2 הרצת בדיקות
```bash
npm test          # vitest run (single pass)
npm run test:watch # vitest watch mode
```

---

## 11. ממצאי ביקורת ובאגים

### 🔴 קריטי

| # | תיאור | קובץ | שורה |
|---|-------|------|------|
| B1 | נתונים אינם persistent — כל refresh מאפס את הנתונים | mockData.ts | כולו |
| B2 | `generateItems` משתמש ב-`Math.random()` — KPIs משתנים בכל refresh | mockData.ts | 74 |
| B3 | סיסמאות מאוחסנות ב-plaintext ב-localStorage | users.ts | 55 |
| B4 | אין הצפנה/hashing לסיסמאות | users.ts | כולו |

### 🟠 גבוה

| # | תיאור | קובץ | שורה |
|---|-------|------|------|
| B5 | `nextStation()` מוגדרת אך לא בשימוש | scanData.ts | 166 |
| B6 | תמונות scan אינן נשמרות (data URLs in-memory בלבד) | scanData.ts | PhotoCapture |
| B7 | `enabledStations` נאסף בדיאלוג אך לא מועבר ל-addProject | CreateProjectDialog | 126 |
| B8 | העלאת CSV/Excel בדיאלוג פרויקט — לא ממומשת (רק UI) | CreateProjectDialog | step 3 |
| B9 | Render.com — `data/project-urns.json` נמחק בכל restart | server.js | 22 |
| B10 | מיפוי BIM ↔ project items לא פועל (barcode ≠ model element name) | BimViewer.tsx | buildMappings |

### 🟡 בינוני

| # | תיאור | קובץ | שורה |
|---|-------|------|------|
| B11 | מחיקת משתמש מחובר לא מנתקת session | users.ts | deleteUser |
| B12 | אין validation לטווח קומות (floorFrom > floorTo) | CreateProjectDialog | 163 |
| B13 | `recharts` מותקן אך לא בשימוש | package.json | - |
| B14 | `@tanstack/react-query` מותקן אך לא בשימוש לנתונים | package.json | - |
| B15 | `refreshKey` ב-ProjectDetail לא תמיד מספיק ל-re-render של items | ProjectDetail.tsx | 124 |

---

## 12. המלצות לשיפור

### P1 — מיידי (גרסה הבאה)

**1. Persistence — DB או localStorage מלא**
```
אפשרות א: הוסף Supabase (PostgreSQL מנוהל, free tier)
  - Projects, Items, ScanRecords — טבלאות עם real-time subscriptions
אפשרות ב: localStorage מלא (מינימלי)
  - שמור PROJECT_ITEMS ב-localStorage בכל שינוי
  - חסרון: לא multi-device
```

**2. Hash סיסמאות**
```typescript
// bcrypt.js (client-side) — מינימלי
import { hashSync, compareSync } from 'bcryptjs';
password: hashSync(plaintext, 10)
verify:   compareSync(input, storedHash)
```

**3. קיבוע seed נתונים**
```typescript
// הוסף seed קבוע ל-generateItems
import seedrandom from 'seedrandom';
const rng = seedrandom(projectId); // תמיד אותם נתונים לאותו פרויקט
```

**4. URN persistence ב-Render**
```
הוסף Redis (Upstash free tier) לאחסון URN במקום filesystem
```

### P2 — קצר-טווח (חודש הבא)

**5. מיפוי BIM — barcode ב-Revit**
```
הנח לעובדים ב-Revit לשים את הברקוד (ALM-XXX-NNNNN)
בשדה "Mark" של כל Element. אז buildMappings יצליח.
```

**6. ייצוא דוחות**
```typescript
// Excel export
import * as XLSX from 'xlsx';
// PDF export
import jsPDF from 'jspdf';
```

**7. ממשק סריקה — offline support**
```
Service Worker + IndexedDB → scans נשמרות offline
sync כשחוזרת connectivity
```

**8. Notifications / WebSocket**
```
Socket.io/WebSocket לעדכון dashboard real-time
כאשר עובד סורק → dashboard מתעדכן ללא refresh
```

**9. לוגים של BIM statuses ב-server**
```javascript
// שמור element statuses ב-DB עם projectId
app.post('/api/bim-element-status', ...)
```

### P3 — ארוך-טווח

**10. ניהול גרסאות מודלים**
- היסטוריית גרסאות של ה-RVT
- השוואה בין גרסאות

**11. ייצוא SVG של הגריד**
- PDF עם גריד הצבעים לדוח שבועי

**12. אינטגרציה ל-ERP**
- Webhook כאשר פריט הושלם
- ייבוא BOM מ-Excel

**13. App מובייל native (React Native)**
- מצלמה טובה יותר
- push notifications
- offline-first

---

## 13. רשימת קבצים

### Frontend (src/)
```
src/
├── App.tsx                          # Router ראשי, Providers
├── config.ts                        # VITE_API_URL
├── index.css                        # CSS variables, global styles
├── main.tsx                         # React DOM render
│
├── auth/
│   ├── AuthContext.tsx               # React context למשתמש הנוכחי
│   └── users.ts                      # CRUD משתמשים + login/logout
│
├── data/
│   └── mockData.ts                   # נתוני פרויקטים, פריטים, לוגיקה
│
├── components/
│   ├── AppLayout.tsx                 # Sidebar + header
│   ├── BimViewer.tsx                 # *** Autodesk Viewer + status ***
│   ├── CreateProjectDialog.tsx       # 5-step wizard
│   ├── KpiCard.tsx                   # כרטיס KPI
│   ├── NavLink.tsx                   # ניווט sidebar
│   ├── ProjectItemsTab.tsx           # טבלת פריטים עם פילטרים
│   ├── RequireAuth.tsx               # Guard component
│   ├── StationCard.tsx               # כרטיס תחנה
│   ├── StatusBadge.tsx               # Badge לסטטוס
│   └── UserManagement.tsx            # ניהול משתמשים CRUD
│
├── pages/
│   ├── Dashboard.tsx                 # דשבורד ראשי
│   ├── Home.tsx                      # redirect לדשבורד
│   ├── Items.tsx                     # כל הפריטים
│   ├── Login.tsx                     # כניסה למנהל
│   ├── NotFound.tsx                  # 404
│   ├── Projects.tsx                  # רשימת פרויקטים
│   ├── ProjectDetail.tsx             # *** 5-tab project view ***
│   ├── Settings.tsx                  # ניהול משתמשים
│   └── scan/
│       ├── QcScan.tsx               # בקרת איכות (מובייל)
│       ├── ScanLogin.tsx            # כניסה לסריקה
│       └── StationScan.tsx          # תחנת ייצור (מובייל)
│
├── scan/
│   ├── BarcodeInput.tsx             # Input לסריקת ברקוד
│   ├── ExistingPhotos.tsx           # תצוגת תמונות קיימות
│   ├── ItemInfoCard.tsx             # כרטיס פרטי פריט
│   ├── PhotoCapture.tsx             # צילום מצלמה
│   ├── ScanLayout.tsx               # Layout לאפליקציית סריקה
│   ├── scanAuth.ts                  # auth עצמאי לסריקה
│   └── scanData.ts                  # לוגיקת סריקה ורישום
│
└── test/
    ├── example.test.ts              # trivial smoke test
    ├── mockData.test.ts             # *** 30+ tests ***
    ├── users.test.ts                # *** 25+ tests ***
    ├── scanData.test.ts             # *** 20+ tests ***
    ├── scanAuth.test.ts             # *** 15+ tests ***
    └── setup.ts                     # matchMedia mock
```

### Backend (root/)
```
server.js          # Express API — APS auth, upload, translate, URN storage
.env.example       # APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET_KEY, PORT
```

### Config
```
vite.config.ts     # dev proxy /api → localhost:3001, port 8080
vitest.config.ts   # jsdom, @/* alias
tailwind.config.ts # design tokens, colors
tsconfig.app.json  # strict TS
package.json       # scripts: dev, build, test, dev:full
```

---

*מסמך זה נוצר על ידי ניתוח אוטומטי של קוד המקור ע"י Claude AI. גרסה: 1.0 | מאי 2026*