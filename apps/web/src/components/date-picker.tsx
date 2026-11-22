import { CalendarBlankIcon } from '@phosphor-icons/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** Parses DD-MM-YYYY into a local Date, or undefined if it isn't a real date. */
function parseIndianDate(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (!match) return undefined
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
  return date.getDate() === Number(match[1]) ? date : undefined
}

function toIndianDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${date.getFullYear()}`
}

/** Today's calendar date in Asia/Kolkata, as a local Date at midnight. */
function todayInIndia() {
  const parts: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())) {
    parts[part.type] = part.value
  }
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
}

type DatePickerProps = {
  id?: string
  /** Date as DD-MM-YYYY, or '' when nothing is picked. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Disable days after today (India time). */
  disableFuture?: boolean
  className?: string
}

export function DatePicker({ id, value, onChange, placeholder = 'Pick a date', disableFuture, className }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = parseIndianDate(value)
  const today = todayInIndia()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn('w-full justify-start font-normal', !selected && 'text-muted-foreground', className)}
          />
        }
      >
        <CalendarBlankIcon data-icon="inline-start" aria-hidden />
        {selected ? value : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? today}
          endMonth={disableFuture ? today : undefined}
          disabled={disableFuture ? { after: today } : undefined}
          onSelect={(date) => {
            // Clicking the selected day again clears it.
            onChange(date ? toIndianDate(date) : '')
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
