import { getSelectedOption } from '@/features/items/item-summary'
import { getStatusBehavior, type ProjectStatusOption } from '@/features/projects/project-options'
import type { ItemWithOptions } from '@/types/domain'
import { plannedCost, toBudgetItem } from '@/utils/budget/calculations'

export type PurchaseReportEntry = {
  itemName: string
  model: string
  price: number | null
}

export function buildPurchaseReportEntries(
  items: readonly ItemWithOptions[],
  statusOptions: readonly ProjectStatusOption[],
): PurchaseReportEntry[] {
  return items.flatMap((item) => {
    if (
      !item.include_in_purchase_report ||
      getStatusBehavior(item.status, statusOptions) !== 'pending'
    ) {
      return []
    }

    const selectedOption = getSelectedOption(item)
    const price = plannedCost(toBudgetItem(item), statusOptions)
    return [{
      itemName: item.name,
      model: selectedOption?.model?.trim() || selectedOption?.name?.trim() || 'Por definir',
      price: price > 0 ? price : null,
    }]
  })
}

function pdfText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapLine(value: string, maxLength: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line === '' ? word : `${line} ${word}`
    if (next.length > maxLength && line !== '') {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  lines.push(line)
  return lines
}

function pdfBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff
  }
  return bytes
}

function createPdf(pages: readonly string[]): Blob {
  const pageObjectIds = pages.map((_, index) => 4 + index * 2)
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  pages.forEach((content, index) => {
    const pageId = pageObjectIds[index]!
    objects[pageId - 1] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' +
      `${pageId + 1} 0 R >>`
    objects[pageId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  })

  let document = '%PDF-1.4\n%âãÏÓ\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(document.length)
    document += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = document.length
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => {
    document += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  const bytes = pdfBytes(document)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: 'application/pdf' })
}

export function createPurchaseReportPdf({
  projectName,
  entries,
  formatPrice,
  generatedAt = new Date(),
}: {
  projectName: string
  entries: readonly PurchaseReportEntry[]
  formatPrice: (value: number) => string
  generatedAt?: Date
}): Blob {
  const dateLabel = new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(generatedAt)
  const lines = [
    { value: 'Lista de electrodomesticos por comprar', size: 18, gap: 28 },
    { value: `Proyecto: ${projectName}`, size: 11, gap: 18 },
    { value: `Generado: ${dateLabel}`, size: 10, gap: 25 },
    { value: 'Item | Modelo | Precio estimado', size: 11, gap: 18 },
  ]
  const entryLines = entries.length === 0
    ? ['No hay items marcados pendientes de compra.']
    : entries.flatMap((entry, index) =>
        wrapLine(
          `${index + 1}. ${entry.itemName} | ${entry.model} | ${entry.price == null ? 'Por definir' : formatPrice(entry.price)}`,
          90,
        ),
      )

  const pages: string[] = []
  let y = 792
  let content = 'BT\n'
  const addLine = (value: string, size: number, gap: number) => {
    content += `/F1 ${size} Tf\n50 ${y} Td\n(${pdfText(value)}) Tj\n-50 -${y} Td\n`
    y -= gap
  }
  lines.forEach((line) => addLine(line.value, line.size, line.gap))
  entryLines.forEach((line) => {
    if (y < 60) {
      content += 'ET'
      pages.push(content)
      y = 792
      content = 'BT\n'
    }
    addLine(line, 10, 16)
  })
  content += 'ET'
  pages.push(content)

  return createPdf(pages)
}

export function downloadPurchaseReportPdf(projectName: string, pdf: Blob): void {
  const fileName = `reporte-compras-${projectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'proyecto'}.pdf`
  const url = URL.createObjectURL(pdf)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
