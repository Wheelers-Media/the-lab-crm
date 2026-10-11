import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

// On a phone, pull a full-screen dialog down from the top to close it, like
// an iOS sheet. Starts only when the dialog is scrolled to the top.
const CLOSE_DRAG_PX = 120

function useSwipeDownToClose(el: HTMLDivElement | null) {
  React.useEffect(() => {
    if (!el || !window.matchMedia("(max-width: 639px)").matches) return
    let startX = 0
    let startY = 0
    let dy = 0
    let active = false
    let dragging = false
    const onStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      dy = 0
      active = true
      dragging = false
    }
    const onMove = (e: TouchEvent) => {
      if (!active) return
      dy = e.touches[0].clientY - startY
      const dx = e.touches[0].clientX - startX
      if (!dragging) {
        if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
          active = false
          return
        }
        if (dy < 10) return
        dragging = true
      }
      e.preventDefault()
      el.style.transition = "none"
      el.style.transform = `translateY(${dy}px)`
    }
    const onEnd = () => {
      if (!active) return
      active = false
      if (!dragging) return
      el.style.transition = "transform 250ms cubic-bezier(0.16, 1, 0.3, 1)"
      el.style.transform = ""
      if (dy > CLOSE_DRAG_PX)
        el.querySelector<HTMLElement>("[data-dialog-close]")?.click()
    }
    el.addEventListener("touchstart", onStart, { passive: true })
    el.addEventListener("touchmove", onMove, { passive: false })
    el.addEventListener("touchend", onEnd)
    el.addEventListener("touchcancel", onEnd)
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchmove", onMove)
      el.removeEventListener("touchend", onEnd)
      el.removeEventListener("touchcancel", onEnd)
    }
  }, [el])
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  // The portal renders the content after this component mounts, so wait for the node
  const [contentNode, setContentNode] = React.useState<HTMLDivElement | null>(
    null
  )
  useSwipeDownToClose(contentNode)
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className,
          // On a phone a dialog is a full screen that slides up, not a window on a window
          "max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:grid-cols-[minmax(0,1fr)] max-sm:content-start max-sm:overflow-x-hidden max-sm:overflow-y-auto max-sm:rounded-none max-sm:border-0 max-sm:px-4 max-sm:pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] max-sm:pb-0 max-sm:shadow-none max-sm:duration-300 max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom-8 max-sm:data-[state=closed]:slide-out-to-bottom-8"
        )}
        {...props}
        ref={setContentNode}
      >
        {children}
        <DialogPrimitive.Close
          data-dialog-close
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 max-sm:top-[calc(env(safe-area-inset-top,0px)+0.75rem)] max-sm:right-3 max-sm:grid max-sm:size-11 max-sm:place-items-center max-sm:rounded-full max-sm:bg-muted max-sm:opacity-100 [&_svg:not([class*='size-'])]:max-sm:size-5 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
