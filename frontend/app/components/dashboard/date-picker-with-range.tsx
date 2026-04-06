"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import { Field, FieldLabel } from "~/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { cn } from "~/lib/utils"

type DatePickerWithRangeProps = {
  id?: string
  className?: string
  date: DateRange | undefined
  onSelect: (range: DateRange | undefined) => void
  disabled?: boolean
}

export function DatePickerWithRange({
  id = "date-picker-range",
  className,
  date,
  onSelect,
  disabled = false,
}: DatePickerWithRangeProps) {
  return (
    <Field className={cn("w-full min-w-0 max-w-sm shrink-0", className)}>
      <FieldLabel htmlFor={id}>Date range</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            disabled={disabled}
            className="w-full justify-start px-2.5 font-normal"
          >
            <CalendarIcon />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} –{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="max-w-[calc(100vw-2rem)] w-auto overflow-x-auto p-0"
          align="start"
        >
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}
