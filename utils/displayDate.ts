/**
 * Data do wyświetlenia z wartości, która w bazie bywa tekstem ISO (`2026-10-02T17:07:27.000Z`),
 * samą datą (`2026-10-02`), znacznikiem Firestore (`toDate()` / `{ seconds }`) albo `Date`.
 *
 * Surowy ISO-string w wierszu zestawu był długim, niełamliwym ciągiem — na telefonie
 * wypychał układ poza ekran. Tekst, którego nie da się odczytać jako daty, wraca bez zmian.
 */
export function formatDisplayDateValue(value: unknown, locale: string = 'pl-PL'): string {
  if (value === null || value === undefined || value === '') return '';
  const fmt = (d: Date) =>
    Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  if (value instanceof Date) return fmt(value);
  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    // Sama data = kalendarzowy dzień lokalny; `new Date('2026-10-02')` byłoby północą UTC.
    const parsed = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : /^\d{4}-\d{2}-\d{2}T/.test(value.trim())
        ? new Date(value)
        : null;
    if (parsed) return fmt(parsed) || value;
    return value;
  }
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return fmt(v.toDate());
  if (typeof v.seconds === 'number') return fmt(new Date(v.seconds * 1000));
  return String(value);
}
