"use client"

import { useTheme } from "next-themes"
import {
  type ExternalToast,
  Toaster as Sonner,
  toast as sonner,
  useSonner,
} from "sonner"
import { Button } from "./button"
import { X } from "lucide-react"
import { isDev } from "@/lib/isDev"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className='toaster group'
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast border-none rounded-md group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "bg-success text-success-foreground",
          info: "bg-info text-info-foreground  border-info",
          error: "bg-destructive text-destructive-foreground ",
          warning: "bg-warning text-warning-foreground",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  )
}

function defaultOptions() {
  const id = crypto.randomUUID()

  const options: ExternalToast = {
    id,
    cancel: (
      <Button
        variant='destructive'
        size='sm'
        className='rounded-full right-0'
        onClick={() => sonner.dismiss(id)}
      >
        <X className='size-3' />
      </Button>
    ),
  }

  return options
}

function ToastTemplate({
  message,
  title,
}: {
  message: string
  title?: string
}) {
  return (
    <div className='flex flex-col gap-1'>
      <p className='text-sm font-medium'>{title}</p>
      <p className='text-sm'>{message}</p>
    </div>
  )
}

function toast(
  { message, title }: { message: string; title?: string },
  options?: ExternalToast
) {
  return sonner(<ToastTemplate message={message} title={title || "Error"} />, {
    ...defaultOptions(),
    ...options,
  })
}

toast.error = (
  { message, title }: { message: string; title?: string },
  options?: ExternalToast
) => {
  return sonner.error(
    <ToastTemplate message={message} title={title || "Error"} />,
    {
      ...defaultOptions(),
      ...options,
    }
  )
}
toast.info = (
  { message, title }: { message: string; title?: string },
  options?: ExternalToast
) => {
  return sonner.info(
    <ToastTemplate message={message} title={title || "Info"} />,
    { ...defaultOptions(), ...options }
  )
}

toast.success = (
  { message, title }: { message: string; title?: string },
  options?: ExternalToast
) => {
  return sonner.success(
    <ToastTemplate message={message} title={title || "Success"} />,
    { ...defaultOptions(), ...options }
  )
}

toast.warning = (
  { message, title }: { message: string; title?: string },
  options?: ExternalToast
) => {
  return sonner.warning(
    <ToastTemplate message={message} title={title || "Warning"} />,
    { ...defaultOptions(), ...options }
  )
}

toast.dismiss = (id: string) => {
  sonner.dismiss(id)
}

toast.loading = () => {
  sonner.loading
}

const useToast = useSonner

export { Toaster, toast, useToast }
