"use client"

import * as React from "react"

import { Marquee } from "~/routes/home/components/marquee"
import { cn } from "~/lib/utils"

type FileItem = {
  name: string
  body: string
}

type AuthGatedFilesMarqueeProps = {
  files: FileItem[]
}

export function AuthGatedFilesMarquee({ files }: AuthGatedFilesMarqueeProps) {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false)

  React.useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("access_token")))
  }, [])

  if (!isLoggedIn) return null

  return (
    <Marquee
      pauseOnHover
      className="absolute top-10 [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] [--duration:20s]"
    >
      {files.map((f, idx) => (
        <figure
          key={idx}
          className={cn(
            "relative w-32 cursor-pointer overflow-hidden rounded-xl border p-4",
            "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
            "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]",
            "transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none"
          )}
        >
          <div className="flex flex-row items-center gap-2">
            <div className="flex flex-col">
              <figcaption className="text-sm font-medium text-foreground dark:text-white">
                {f.name}
              </figcaption>
            </div>
          </div>
          <blockquote className="mt-2 text-xs">{f.body}</blockquote>
        </figure>
      ))}
    </Marquee>
  )
}
