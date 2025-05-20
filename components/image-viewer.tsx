"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

interface ImageViewerProps {
  src: string
  alt?: string
  isOpen: boolean
  onClose: () => void
}

export function ImageViewer({ src, alt = "Image", isOpen, onClose }: ImageViewerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Add event listener to close on escape key
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEsc)
      // Prevent scrolling when viewer is open
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = "auto"
    }
  }, [isOpen, onClose])

  if (!mounted || !isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90" onClick={onClose}>
      <button
        className="absolute top-4 right-4 bg-white rounded-full p-2 text-black hover:bg-gray-200 transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <X className="h-6 w-6" />
      </button>
      <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={src || "/placeholder.svg"}
          alt={alt}
          className="max-w-full max-h-[90vh] object-contain border-2 border-white shadow-lg"
        />
      </div>
    </div>
  )
}
