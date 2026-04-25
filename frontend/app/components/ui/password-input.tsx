import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "~/lib/utils"
import { Input } from "~/components/ui/input"

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev)
    }

    return (
      <div className="relative mt-1">
        <Input
          type={showPassword ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={ref}
          {...props}
        />
        <div
          role="button"
          tabIndex={-1}
          onPointerDown={(e) => {
            e.preventDefault()
            togglePasswordVisibility()
          }}
          className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer z-20"
        >
          {showPassword ? (
            <Eye className="size-4 pointer-events-none" />
          ) : (
            <EyeOff className="size-4 pointer-events-none" />
          )}
        </div>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
