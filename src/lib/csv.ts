export function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function csvLine(row: unknown[]) {
  return `${row.map(csvEscape).join(",")}\n`;
}

export function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (inQuotes) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
