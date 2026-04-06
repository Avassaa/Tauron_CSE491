"use client"

import { TrendingUp } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
} from "recharts"

import { CardTitleWithTooltip } from "~/components/dashboard/card-title-with-tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "~/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart"
import {
  placeholderMonthlyDual,
  placeholderMonthlySingle,
  placeholderPieByCategory,
  placeholderRadarDual,
} from "~/lib/dashboard-placeholder-data"

export {
  ChartAreaInteractive,
  description as chartAreaInteractiveDescription,
} from "./chart-area-interactive"

const barLineConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function ChartBarDefault() {
  return (
    <Card>
      <CardHeader>
        <CardTitleWithTooltip tooltip="Compares one metric per month with vertical bars. Good for spotting which months stand out.">
          Bar Chart
        </CardTitleWithTooltip>
        <CardDescription>Placeholder — full year sample</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={barLineConfig}
          className="min-h-[220px] h-[220px] w-full"
        >
          <BarChart accessibilityLayer data={placeholderMonthlySingle}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={8} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Placeholder monthly totals
        </div>
      </CardFooter>
    </Card>
  )
}

export function ChartLineDefault() {
  return (
    <Card>
      <CardHeader>
        <CardTitleWithTooltip tooltip="Shows how a single metric changes month to month. Useful for trends and smooth patterns.">
          Line Chart
        </CardTitleWithTooltip>
        <CardDescription>Placeholder — full year sample</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={barLineConfig}
          className="min-h-[220px] h-[220px] w-full"
        >
          <LineChart
            accessibilityLayer
            data={placeholderMonthlySingle}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Line
              dataKey="desktop"
              type="natural"
              stroke="var(--color-desktop)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Placeholder monthly totals
        </div>
      </CardFooter>
    </Card>
  )
}

const pieChartConfig = {
  visitors: {
    label: "Visitors",
  },
  chrome: {
    label: "Chrome",
    color: "var(--chart-1)",
  },
  safari: {
    label: "Safari",
    color: "var(--chart-2)",
  },
  firefox: {
    label: "Firefox",
    color: "var(--chart-3)",
  },
  edge: {
    label: "Edge",
    color: "var(--chart-4)",
  },
  other: {
    label: "Other",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig

export function ChartPieSimple() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitleWithTooltip tooltip="Each slice is a share of the whole (e.g. mix by category). Hover a slice to see exact values.">
          Pie Chart
        </CardTitleWithTooltip>
        <CardDescription>Placeholder share by category</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={pieChartConfig}
          className="mx-auto aspect-square h-[250px] min-h-[250px] w-full max-w-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie data={placeholderPieByCategory} dataKey="visitors" nameKey="browser">
              {placeholderPieByCategory.map((entry) => (
                <Cell key={entry.browser} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Placeholder distribution
        </div>
      </CardFooter>
    </Card>
  )
}

const radarConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ChartRadarLinesOnly() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitleWithTooltip tooltip="Plots two series on spokes (e.g. months). Distance from center shows strength; compare polygon shapes at a glance.">
          Radar Chart - Lines Only
        </CardTitleWithTooltip>
        <CardDescription>Placeholder desktop vs mobile</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          config={radarConfig}
          className="mx-auto aspect-square h-[250px] min-h-[250px] w-full max-w-[250px]"
        >
          <RadarChart data={placeholderRadarDual}>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <PolarAngleAxis dataKey="month" />
            <PolarGrid radialLines={false} />
            <Radar
              dataKey="desktop"
              fill="var(--color-desktop)"
              fillOpacity={0}
              stroke="var(--color-desktop)"
              strokeWidth={2}
            />
            <Radar
              dataKey="mobile"
              fill="var(--color-mobile)"
              fillOpacity={0}
              stroke="var(--color-mobile)"
              strokeWidth={2}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2 leading-none text-muted-foreground">
          Placeholder 8-month window
        </div>
      </CardFooter>
    </Card>
  )
}

const multiLineConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ChartLineMultiple() {
  return (
    <Card>
      <CardHeader>
        <CardTitleWithTooltip tooltip="Two lines on the same time axis so you can compare desktop vs mobile (or any pair of series) together.">
          Line Chart - Multiple
        </CardTitleWithTooltip>
        <CardDescription>Placeholder — full year, two series</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={multiLineConfig}
          className="min-h-[260px] h-[260px] w-full"
        >
          <LineChart
            accessibilityLayer
            data={placeholderMonthlyDual}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="desktop"
              type="monotone"
              stroke="var(--color-desktop)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="mobile"
              type="monotone"
              stroke="var(--color-mobile)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium">
              Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              Placeholder dual series
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
