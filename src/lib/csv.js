function escapeCsvField(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(rows, headers) {
  const headerLine = headers.map((h) => escapeCsvField(h.label)).join(',')
  const lines = rows.map((row) => headers.map((h) => escapeCsvField(h.value(row))).join(','))
  return [headerLine, ...lines].join('\r\n')
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([`﻿${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
