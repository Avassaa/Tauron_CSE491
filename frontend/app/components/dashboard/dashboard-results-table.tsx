import { MOCK_DASHBOARD_RESULTS } from "~/lib/mock-data"
import { cn } from "~/lib/utils"
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { CardTitleWithTooltip } from "~/components/dashboard/card-title-with-tooltip"

export function DashboardResultsTable() {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitleWithTooltip
          className="text-base font-black tracking-tight"
          infoLabel="About this table"
          tooltip="Tabular output for the current filter range. Values will populate from your API once connected."
        >
          System Performance
        </CardTitleWithTooltip>
        <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Real-time terminal metrics and telemetry
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Metric</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Baseline</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Current</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Delta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_DASHBOARD_RESULTS.map((row) => (
              <TableRow key={row.label} className="border-border/40 hover:bg-primary/[0.02] transition-colors">
                <TableCell className="font-bold text-sm tracking-tight">{row.label}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{row.start}</TableCell>
                <TableCell className="font-mono text-xs font-bold text-white">{row.end}</TableCell>
                <TableCell className={cn(
                  "text-right tabular-nums font-black text-xs",
                  row.isPositive ? "text-green-500" : "text-red-500"
                )}>
                  {row.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
