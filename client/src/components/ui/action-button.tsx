import * as React from "react"
import { useState, useCallback, useEffect } from "react"
import { Check, Loader2 } from "lucide-react"
import { Button, ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ActionButtonProps extends Omit<ButtonProps, "onClick"> {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void> | void
  successText?: string
  successDuration?: number
  loadingText?: string
  children: React.ReactNode
}

export function ActionButton({
  onClick,
  successText = "Saved!",
  successDuration = 2000,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: ActionButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "success">("idle")

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (state !== "idle" || !onClick) return
    
    setState("loading")
    try {
      await onClick(e)
      setState("success")
    } catch (error) {
      setState("idle")
      throw error
    }
  }, [onClick, state])

  useEffect(() => {
    if (state === "success") {
      const timeout = setTimeout(() => {
        setState("idle")
      }, successDuration)
      return () => clearTimeout(timeout)
    }
  }, [state, successDuration])

  const isDisabled = disabled || state === "loading" || state === "success"

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        "transition-all duration-200",
        state === "success" && "bg-green-600 hover:bg-green-600 text-white",
        className
      )}
      data-testid="action-button"
      {...props}
    >
      {state === "loading" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText && <span className="ml-1">{loadingText}</span>}
        </>
      ) : state === "success" ? (
        <>
          <Check className="h-4 w-4" />
          <span className="ml-1">{successText}</span>
        </>
      ) : (
        children
      )}
    </Button>
  )
}
