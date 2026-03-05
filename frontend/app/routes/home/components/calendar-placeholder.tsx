import { cn } from "~/lib/utils"

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const DATES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
const selectedDate = 11

export default function CalendarPlaceholder({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "w-fit rounded-md border border-border bg-background p-2",
        className
      )}
      {...props}
    >
      <div className="mb-1 text-center text-xs font-medium">May 2022</div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
        {DAYS.map((d) => (
          <div key={d} className="font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {DATES.map((d) => (
          <button
            key={d}
            type="button"
            className={cn(
              "h-5 w-5 rounded transition-colors hover:bg-accent text-[10px]",
              d === selectedDate && "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}
