"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, AlertCircle, AlertTriangle, User, Upload, Check, X, LogOut } from "lucide-react"
import { PhoneInput } from "@/components/phone-input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageViewer } from "@/components/image-viewer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface UserProfile {
  id: string
  name: string
  email: string
  createdAt: string
  storeName?: string
  storeAddress?: string
  storeContact?: string
  storeCountryCode?: string
  profileComplete?: boolean
  emailVerified?: boolean
  profilePhoto?: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [storeName, setStoreName] = useState("")
  const [storeAddress, setStoreAddress] = useState("")
  const [storeContact, setStoreContact] = useState("")
  const [storeCountryCode, setStoreCountryCode] = useState("+91")
  const [contactError, setContactError] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [showProfileAlert, setShowProfileAlert] = useState(false)
  const [redirectFrom, setRedirectFrom] = useState<string | null>(null)

  // Email verification states
  const [emailOtp, setEmailOtp] = useState("")
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtpVerified, setEmailOtpVerified] = useState(false)
  const [generatedEmailOtp, setGeneratedEmailOtp] = useState("")

  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)

  useEffect(() => {
    // Check if user is logged in
    const userJSON = localStorage.getItem("currentUser")
    if (!userJSON) {
      router.push("/login")
      return
    }

    const userData = JSON.parse(userJSON)
    setUser(userData)
    setName(userData.name)
    setEmail(userData.email)
    setStoreName(userData.storeName || "")
    setStoreAddress(userData.storeAddress || "")
    setStoreContact(userData.storeContact || "")
    setStoreCountryCode(userData.storeCountryCode || "+91")
    setEmailOtpVerified(userData.emailVerified || false)
    setProfilePhoto(userData.profilePhoto || null)

    // Check if redirected from another page
    const urlParams = new URLSearchParams(window.location.search)
    const from = urlParams.get("from")
    if (from) {
      setRedirectFrom(from)
      setShowProfileAlert(true)
    }
  }, [router])

  const validateContact = (contact: string): boolean => {
    if (!contact) {
      setContactError("Contact number is required")
      return false
    }
    if (!/^\d{10}$/.test(contact)) {
      setContactError("Contact number must be exactly 10 digits")
      return false
    }
    setContactError("")
    return true
  }

  const handlePhoneChange = (value: string, countryCode: string) => {
    setStoreContact(value)
    setStoreCountryCode(countryCode)
    validateContact(value)
  }

  const isProfileComplete = (): boolean => {
    return !!(
      name &&
      storeName &&
      storeAddress &&
      storeContact &&
      /^\d{10}$/.test(storeContact) &&
      emailOtpVerified
    )
  }

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    if (!user) return

    // Validate contact number
    if (!validateContact(storeContact)) {
      setLoading(false)
      return
    }

    // Validate required fields
    if (!name || !storeName || !storeAddress) {
      setError("All fields are required to complete your profile")
      setLoading(false)
      return
    }

    // Check if email is verified
    if (!emailOtpVerified) {
      setError("Please verify your email address")
      setLoading(false)
      return
    }

    // Check if profile is complete
    const profileComplete = isProfileComplete()

    // Update user profile
    const updatedUser = {
      ...user,
      name,
      email,
      storeName,
      storeAddress,
      storeContact,
      storeCountryCode,
      profileComplete,
      emailVerified: emailOtpVerified,
      profilePhoto: profilePhoto,
    }

    // Get all users
    const usersJSON = localStorage.getItem("users")
    const users = usersJSON ? JSON.parse(usersJSON) : []

    // Update user in the users array
    const updatedUsers = users.map((u: any) =>
      u.id === user.id
        ? {
            ...u,
            name,
            email,
            storeName,
            storeAddress,
            storeContact,
            storeCountryCode,
            profileComplete,
            emailVerified: emailOtpVerified,
            profilePhoto: profilePhoto,
          }
        : u,
    )

    // Save updated users
    localStorage.setItem("users", JSON.stringify(updatedUsers))

    // Update current user
    localStorage.setItem("currentUser", JSON.stringify(updatedUser))
    setUser(updatedUser)

    setSuccess("Profile updated successfully")
    setLoading(false)

    // Redirect back to the original page if profile is now complete
    if (profileComplete && redirectFrom) {
      setTimeout(() => {
        router.push(redirectFrom)
      }, 1500)
    }
  }

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    if (!user) return

    // Validate passwords
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields")
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      setLoading(false)
      return
    }

    // Validate password strength
    if (newPassword.length <= 7) {
      setError("Password must be at least 8 characters long")
      setLoading(false)
      return
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter")
      setLoading(false)
      return
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(newPassword)) {
      setError("Password must contain at least one lowercase letter")
      setLoading(false)
      return
    }

    // Check for at least one digit
    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one digit")
      setLoading(false)
      return
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      setError("Password must contain at least one special character")
      setLoading(false)
      return
    }

    // Get all users
    const usersJSON = localStorage.getItem("users")
    const users = usersJSON ? JSON.parse(usersJSON) : []

    // Find current user
    const currentUser = users.find((u: any) => u.id === user.id)

    if (!currentUser) {
      setError("User not found")
      setLoading(false)
      return
    }

    // Verify current password
    if (currentUser.password !== currentPassword) {
      setError("Current password is incorrect")
      setLoading(false)
      return
    }

    // Update password
    const updatedUsers = users.map((u: any) => (u.id === user.id ? { ...u, password: newPassword } : u))

    // Save updated users
    localStorage.setItem("users", JSON.stringify(updatedUsers))

    setSuccess("Password updated successfully")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem("currentUser")
    router.push("/login")
  }

  // Email verification
  const sendEmailOtp = () => {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedEmailOtp(otp)
    setEmailOtpSent(true)

    // In a real app, you would send this OTP via email
    alert(`For demo purposes, your email OTP is: ${otp}`)
  }

  const verifyEmailOtp = () => {
    if (emailOtp === generatedEmailOtp) {
      setEmailOtpVerified(true)
      setSuccess("Email verified successfully")
      setError("")
    } else {
      setError("Incorrect OTP. Please check and try again.")
    }
  }

  // Profile photo handling
  const handleProfilePhotoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setProfilePhoto(event.target.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const removeProfilePhoto = () => {
    setProfilePhoto(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const openFullScreenPhoto = () => {
    if (profilePhoto) {
      const newWindow = window.open("", "_blank")
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Profile Photo</title>
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  background-color: rgba(0, 0, 0, 0.9);
                }
                img {
                  max-width: 90vw;
                  max-height: 90vh;
                  object-fit: contain;
                  border: 2px solid white;
                  box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
                }
                .close-btn {
                  position: absolute;
                  top: 20px;
                  right: 20px;
                  background: white;
                  color: black;
                  border: none;
                  border-radius: 50%;
                  width: 40px;
                  height: 40px;
                  font-size: 20px;
                  cursor: pointer;
                }
              </style>
            </head>
            <body>
              <button class="close-btn" onclick="window.close()">×</button>
              <img src="${profilePhoto}" alt="Profile Photo" />
            </body>
          </html>
        `)
      }
    }
  }

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <Link href="/">
          <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>
        
        {/* Profile dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center space-x-2 focus:outline-none">
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="h-10 w-10 rounded-full object-cover border-2 border-gray-200 cursor-pointer hover:border-blue-500 transition-colors"
                />
              ) : (
                <div className="bg-gray-200 rounded-full p-2 h-10 w-10 flex items-center justify-center hover:bg-gray-300 transition-colors">
                  <User className="h-6 w-6 text-gray-600" />
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {showProfileAlert && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-800" />
            <AlertDescription>
              Please complete your profile details before accessing{" "}
              {redirectFrom === "/create" ? "receipt creation" : "accounts"}.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="relative cursor-pointer group" onClick={handleProfilePhotoClick}>
                {profilePhoto ? (
                  <div className="relative">
                    <img
                      src={profilePhoto || "/placeholder.svg"}
                      alt="Profile"
                      className="h-20 w-20 rounded-full object-cover border-2 border-gray-200 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsImageViewerOpen(true)
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                    <button
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeProfilePhoto()
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-200 rounded-full p-4 h-20 w-20 flex items-center justify-center group-hover:bg-gray-300">
                    <User className="h-12 w-12 text-gray-600" />
                    <div className="absolute inset-0 bg-black bg-opacity-20 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                  </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
              <div>
                <CardTitle className="text-2xl">{user.name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
                <p className="text-sm text-gray-500">Member since {new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile Information</TabsTrigger>
            <TabsTrigger value="security">Security & Password</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Update Profile</CardTitle>
                <CardDescription>
                  All fields are required before you can create receipts or access accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex space-x-2">
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          // Reset verification if email changes
                          if (emailOtpVerified) {
                            setEmailOtpVerified(false)
                          }
                        }}
                        required
                        className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                        disabled={emailOtpVerified}
                      />
                      {!emailOtpVerified ? (
                        <Button type="button" onClick={sendEmailOtp} disabled={!email || !email.includes("@")}>
                          Send OTP
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" className="bg-green-50 text-green-600 border-green-200">
                          <Check className="mr-2 h-4 w-4" /> Verified
                        </Button>
                      )}
                    </div>

                    {emailOtpSent && !emailOtpVerified && (
                      <div className="mt-2 flex space-x-2">
                        <Input
                          placeholder="Enter OTP sent to your email"
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value)}
                          className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                        />
                        <Button type="button" onClick={verifyEmailOtp}>
                          Verify
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeName">
                      Store/Enterprise Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="storeName"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeAddress">
                      Store Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="storeAddress"
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeContact">
                      Store Contact Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex-1">
                      <PhoneInput
                        value={storeContact}
                        countryCode={storeCountryCode}
                        onChange={handlePhoneChange}
                        placeholder="10-digit number"
                      />
                    </div>
                    {contactError && <p className="text-sm text-red-500">{contactError}</p>}
                  </div>

                  <Button type="submit" disabled={loading || !emailOtpVerified}>
                    {loading ? "Updating..." : "Update Profile"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password</CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    />
                    <p className="text-xs text-gray-500">
                      Password must be at least 8 characters long and contain at least one uppercase letter, one
                      lowercase letter, one digit, and one special character.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    />
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Updating..." : "Change Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {profilePhoto && (
        <ImageViewer
          src={profilePhoto || "/placeholder.svg"}
          alt="Profile Photo"
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}
    </div>
  )
}