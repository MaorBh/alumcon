## מטרה
לקשר בין נתוני Priority (מספר פרויקט + קטלוג מק"טים) לבין פריטי הפרויקט במערכת, ולייצר ברקודים במבנה אחיד `AAAA-BBBB-CC-DD`.

## מבנה הברקוד
```
AAAA - BBBB - CC - DD
 │      │     │    └─ מיקום (יחידה) – 2 ספרות, padded
 │      │     └────── קומה – 2 ספרות, padded
 │      └──────────── סיומת מק"ט פריוריטי (4 ספרות אחרונות של "5-0-0001" → 0001)
 └─────────────────── מספר פרויקט בפריוריטי (4 ספרות, padded)
```
דוגמה: פרויקט 109, מק"ט `5-0-0042`, קומה 3, יחידה 7 → `0109-0042-03-07`

## שינויים באשף יצירת פרויקט (`CreateProjectDialog.tsx`)
מוסיפים שלב חדש "Priority" בין "פרטי פרויקט" ל"העלאת קובץ פריטים".
4 שלבים במקום 3:
1. פרטי פרויקט (קיים)
2. **Priority (חדש)** – שדה "מספר פרויקט בפריוריטי" (AAAA) + העלאת קובץ Priority (CSV/XLSX) עם עמודות `מקט`, `Unit_NAME`, `TYPE`, `HEIGHT`, `WIDTH`, `Weight`, `Count`
3. העלאת קובץ פריטים/BIM (קיים)
4. סיכום (קיים, כעת מציג גם את נתוני Priority)

### לוגיקת השלב החדש
- ולידציה: `priorityProjectNumber` חובה, מספרי, מומר ל-4 ספרות עם padding
- פרסור הקובץ: זיהוי שורת כותרות בעלת `מקט`, חילוץ 4 הספרות האחרונות של כל מק"ט (regex `/(\d{4})$/`) → `prioritySuffix`
- שמירת מפה `catalogByType: Map<TYPE+Unit_NAME, {suffix, weight, count}>` להעשרת הפריטים

### שיוך לפריטים
בעת יצירת הפרויקט, עבור כל `ProjectItem`:
- חיפוש התאמה בקטלוג Priority לפי `type` (ואם זמין `unitName`)
- שמירת `prioritySuffix` ו-`priorityWeight` על הפריט
- חישוב ברקוד סופי: `${AAAA}-${BBBB}-${pad(floor,2)}-${pad(unit,2)}`
- פריטים ללא התאמה בקטלוג → BBBB = `0000` + סימון אזהרה בסיכום

## שינויים במודל הנתונים (`mockData.ts`)
- `Project`: הוספת `priorityProjectNumber?: string` (4 ספרות)
- `ProjectItem`: הוספת `prioritySuffix?: string`, `priorityWeight?: number`
- `ImportedItem`: ללא שינוי
- חדש: `PriorityCatalogRow { sku: string; suffix: string; unitName: string; type: string; weight: number; count: number; }`
- חדש: `PRIORITY_CATALOG: Record<projectId, PriorityCatalogRow[]>`
- `addProject(...)` מקבל `priorityProjectNumber` ו-`priorityCatalog`, ובונה ברקודים חדשים לכל פריט

## שינויים ב-`BarcodesTab.tsx`
- המדבקה תציג את הברקוד החדש במקום ה-`barcode` הישן
- ה-vertical barcode (`*360*` המשקל) ישתמש ב-`priorityWeight` כשזמין
- ה-horizontal barcode = הברקוד החדש `AAAA-BBBB-CC-DD`
- שדה "מק"ט/קוד" במדבקה יציג את מק"ט Priority המלא (`5-0-0042`)
- אם פריט חסר התאמת Priority → תווית אזהרה במסך התצוגה המקדימה, חסימת הדפסה

## פרסור Priority CSV/XLSX
פונקציית `parsePriorityFile(file)`:
- תומכת ב-`.csv`, `.xlsx`, `.xls` (משתמש ב-`XLSX.read` הקיים)
- מדלגת על שורת הכותרת העליונה ("Window Schedule…") ומאתרת את שורת `מקט,Unit_NAME,TYPE…`
- מחזירה מערך `PriorityCatalogRow`
- אזהרת toast כשמספר השורות = 0 או אין עמודת `מקט`

## קבצים שיתעדכנו
- `src/components/CreateProjectDialog.tsx` – שלב חדש + state
- `src/data/mockData.ts` – שדות חדשים על Project/Item, `addProject` עם בניית ברקוד
- `src/components/BarcodesTab.tsx` – שימוש בברקוד החדש במדבקה ובהדפסה
- `src/pages/Projects.tsx` – העברת `priorityProjectNumber` ו-`priorityCatalog` ל-`addProject`

## הערות
- לא נדרש שינוי לסריקה/Stations – הברקוד החדש נשמר ב-`item.barcode` ולכן כל המסכים שמסתמכים עליו ממשיכים לעבוד.
- פרויקטים קיימים (mock) יקבלו `priorityProjectNumber = "0000"` כדי לא לשבור תצוגות.
