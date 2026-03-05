import { BellIcon } from "lucide-react"

import { cn } from "~/lib/utils"
import { AnimatedList, AnimatedListItem } from "~/routes/home/components/animated-list"

const notifications = [
  { id: 1, title: "New message", body: "You have a new message from the team." },
  { id: 2, title: "Update complete", body: "Your export has finished processing." },
  { id: 3, title: "Reminder", body: "Meeting with the team in 30 minutes." },
  { id: 4, title: "File shared", body: "Someone shared a document with you." },
]

export default function AnimatedListDemo({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <AnimatedList
      className={className}
      delay={2000}
      {...props}
    >
      {notifications.map((n) => (
        <div
          key={n.id}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border px-3 py-2",
            "border-neutral-950/[.1] bg-neutral-950/[.02]",
            "dark:border-neutral-50/[.1] dark:bg-neutral-50/[.08]"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <BellIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {n.title}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {n.body}
            </p>
          </div>
        </div>
      ))}
    </AnimatedList>
  )
}
