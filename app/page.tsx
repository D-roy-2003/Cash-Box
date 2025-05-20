"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { ImageViewer } from "@/components/image-viewer"
import { Footer } from "@/components/footer"

interface UserProfile {
  id: string
  name: string
  email: string
  profilePhoto?: string
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Check if user is logged in
    const userJSON = localStorage.getItem("currentUser")
    if (userJSON) {
      setUser(JSON.parse(userJSON))
    }
  }, [])

  useEffect(() => {
    if (user) {
      // Check for overdue payments
      const overduePayments = checkOverduePayments()
      setNotifications(overduePayments)

      // Check if there are new notifications since last read
      const lastReadTime = localStorage.getItem("notificationsLastRead")
      if (lastReadTime) {
        const lastRead = new Date(lastReadTime)
        // Check if any notifications were created after last read
        const hasNew = overduePayments.some((notification: any) => {
          const createdAt = new Date(notification.createdAt)
          return createdAt > lastRead
        })
        setHasUnreadNotifications(hasNew || overduePayments.length > 0)
      } else if (overduePayments.length > 0) {
        // If never read before and there are notifications
        setHasUnreadNotifications(true)
      }
    }
  }, [user])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }

    // Only add the event listener if the dropdown is open
    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isNotificationsOpen])

  const handleLogout = () => {
    localStorage.removeItem("currentUser")
    setUser(null)
  }

  const checkOverduePayments = () => {
    const dueRecordsJSON = localStorage.getItem("dueRecords")
    if (!dueRecordsJSON) return []

    const dueRecords = JSON.parse(dueRecordsJSON)
    const today = new Date()

    // Filter for overdue and unpaid records
    return dueRecords.filter((record: any) => {
      const dueDate = new Date(record.expectedPaymentDate)
      return !record.isPaid && dueDate < today
    })
  }

  const handleNotificationClick = () => {
    setIsNotificationsOpen(!isNotificationsOpen)
    if (hasUnreadNotifications) {
      setHasUnreadNotifications(false)
      // Mark notifications as read in localStorage
      localStorage.setItem("notificationsLastRead", new Date().toISOString())
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="w-full py-4 px-6 flex justify-between items-center border-b bg-black text-white">
        <h1 className="text-xl font-bold">Money Records</h1>
        <div className="flex items-center space-x-4">
          {user && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative text-white hover:bg-gray-800"
                onClick={handleNotificationClick}
              >
                <Bell className="h-5 w-5" />
                {hasUnreadNotifications && (
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
                )}
              </Button>

              {isNotificationsOpen && (
                <div
                  ref={notificationRef}
                  className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-20"
                >
                  <div className="py-2 px-3 bg-gray-100 border-b">
                    <h3 className="text-sm font-medium text-gray-800">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notification: any) => (
                        <Link
                          href="/accounts/due"
                          key={notification.id}
                          className="block px-4 py-3 border-b hover:bg-gray-50"
                        >
                          <div className="flex items-start">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                Payment Overdue: {notification.customerName}
                              </p>
                              <p className="text-xs text-gray-500">
                                ₹{notification.amountDue.toFixed(2)} for {notification.productOrdered}
                              </p>
                              <p className="text-xs text-red-500">
                                Due date: {new Date(notification.expectedPaymentDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">No overdue payments</div>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="py-2 px-3 bg-gray-100 border-t text-center">
                      <Link href="/accounts/due" className="text-xs font-medium text-blue-600 hover:text-blue-500">
                        View all due payments
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {user ? (
            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full text-white hover:bg-gray-800 bg-gray-100 p-0 overflow-hidden"
                  >
                    {user.profilePhoto ? (
                      <img
                        src={user.profilePhoto || "/placeholder.svg"}
                        alt={user.name}
                        className="h-10 w-10 rounded-full object-contain cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsImageViewerOpen(true)
                        }}
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full">
                        <span className="text-sm font-medium text-gray-600">{user.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex flex-col space-y-1 p-2">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/accounts">Accounts</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="space-x-2">
              <Link href="/login">
                <Button variant="outline" size="sm" className="bg-white text-black hover:bg-gray-100">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
        <div className="max-w-3xl w-full text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">Money Records</h1>
          <p className="text-xl text-gray-600">
            Create professional receipts and maintain accounts for your business in seconds
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/create">
              <Button size="lg" className="font-medium">
                Create Receipt <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/accounts">
              <Button size="lg" className="font-medium">
                Accounts <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
      {user?.profilePhoto && (
        <ImageViewer
          src={user.profilePhoto || "/placeholder.svg"}
          alt={user.name}
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}
      <Footer />
    </div>
  )
}
