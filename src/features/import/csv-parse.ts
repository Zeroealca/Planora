/** Minimal CSV parser: RFC4180-ish, UTF-8 text, first row = headers. */

export type CsvTable = {
  headers: string[]
  rows: string[][]
}

export function parseCsv(text: string): CsvTable {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const records = parseRecords(normalized)
  if (records.length === 0) {
    return { headers: [], rows: [] }
  }
  const headers = records[0]!.map((h) => h.trim())
  const rows = records.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''))
  return { headers, rows }
}

function parseRecords(text: string): string[][] {
  const records: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false

  while (i < text.length) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\n') {
      row.push(field)
      records.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += ch
    i += 1
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    records.push(row)
  }

  return records
}

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '_')
}
