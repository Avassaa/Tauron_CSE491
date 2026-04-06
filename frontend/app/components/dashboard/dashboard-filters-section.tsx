"use client"

import * as React from "react"
import { addDays } from "date-fns"
import type { DateRange } from "react-day-picker"

import { DatePickerWithRange } from "~/components/dashboard/date-picker-with-range"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Label } from "~/components/ui/label"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"

export type DashboardApplyPayload = {
  date: DateRange | undefined
  placeholderOn: boolean
}

type DashboardFiltersSectionProps = {
  applyBusy: boolean
  onApply: (payload: DashboardApplyPayload) => void
}

export function DashboardFiltersSection({
  applyBusy,
  onApply,
}: DashboardFiltersSectionProps) {
  const [placeholderOn, setPlaceholderOn] = React.useState(false)
  const [date, setDate] = React.useState<DateRange | undefined>(() => {
    const y = new Date().getFullYear()
    const from = new Date(y, 0, 20)
    return { from, to: addDays(from, 20) }
  })

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <DatePickerWithRange
            date={date}
            onSelect={setDate}
            disabled={applyBusy}
          />
          <div className="flex shrink-0 items-center gap-2 pb-0.5 sm:pb-1">
            <Switch
              id="dashboard-placeholder-switch"
              checked={placeholderOn}
              onCheckedChange={setPlaceholderOn}
              disabled={applyBusy}
            />
            <Label
              htmlFor="dashboard-placeholder-switch"
              className="text-sm font-normal"
            >
              Placeholder
            </Label>
          </div>
          <Button
            type="button"
            className="w-full shrink-0 sm:w-auto"
            disabled={applyBusy}
            onClick={() =>
              onApply({ date, placeholderOn })
            }
          >
            {applyBusy ? (
              <>
                <Spinner className="size-4" />
                Applying
              </>
            ) : (
              "Apply"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
