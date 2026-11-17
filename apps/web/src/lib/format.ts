export function formatPrice(value: string) {
  const [whole, fraction = ''] = value.split('.')
  const trimmedFraction = fraction.replace(/0+$/, '')
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

export function formatSubmittedAt(value: string) {
  const date = new Date(value)
  const dateParts: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)) {
    dateParts[part.type] = part.value
  }
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return formatDateForIndia(dateParts.year + '-' + dateParts.month + '-' + dateParts.day) + ' · ' + time
}

export function formatDateForIndia(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? match[3] + '-' + match[2] + '-' + match[1] : value
}

export function indianDateToIso(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (!match) return null
  const isoDate = match[3] + '-' + match[2] + '-' + match[1]
  const parsed = new Date(isoDate + 'T00:00:00.000Z')
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === isoDate
    ? isoDate
    : null
}
