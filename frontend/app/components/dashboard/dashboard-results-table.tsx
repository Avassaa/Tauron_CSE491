"use client"

import { CardTitleWithTooltip } from "~/components/dashboard/card-title-with-tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"

export function DashboardResultsTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitleWithTooltip
          className="text-base"
          infoLabel="About this table"
          tooltip="Tabular output for the current filter range. Values will populate from your API once connected."
        >
          Results
        </CardTitleWithTooltip>
        <CardDescription>
          Placeholder rows until backend data is wired.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Placeholder row A</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-right tabular-nums">0</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Placeholder row B</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-right tabular-nums">0</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Placeholder row C</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-right tabular-nums">0</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
