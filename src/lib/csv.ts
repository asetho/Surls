export function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = /^[\t ]*[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(safeText)) {
    return `"${safeText.replace(/"/g, '""')}"`;
  }
  return safeText;
}

export function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function csvLine(row: unknown[]) {
  return `${row.map(csvEscape).join(",")}\n`;
}

export function parseCsvRows(
  text: string,
  maxRows = Number.POSITIVE_INFINITY,
  maxFieldCharacters = Number.POSITIVE_INFINITY
) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  function appendToField(value: string) {
    if (field.length + value.length > maxFieldCharacters) {
      throw new Error(`CSV fields must be ${maxFieldCharacters} characters or fewer.`);
    }
    field += value;
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        appendToField('"');
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        appendToField(char);
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
      if (row.some(Boolean)) {
        rows.push(row);
        if (rows.length > maxRows) throw new Error(`Import at most ${maxRows} rows at a time.`);
      }
      row = [];
      field = "";
    } else if (char !== "\r") {
      appendToField(char);
    }
  }

  if (inQuotes) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some(Boolean)) {
    rows.push(row);
    if (rows.length > maxRows) throw new Error(`Import at most ${maxRows} rows at a time.`);
  }
  return rows;
}
