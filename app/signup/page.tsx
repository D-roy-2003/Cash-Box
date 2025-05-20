"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, AlertCircle } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Simple validation
    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    // Validate password strength
    if (password.length <= 7) {
      setError("Password must be at least 8 characters long")
      setLoading(false)
      return
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter")
      setLoading(false)
      return
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter")
      setLoading(false)
      return
    }

    // Check for at least one digit
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one digit")
      setLoading(false)
      return
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      setError("Password must contain at least one special character")
      setLoading(false)
      return
    }

    // Get existing users from localStorage
    const usersJSON = localStorage.getItem("users")
    const users = usersJSON ? JSON.parse(usersJSON) : []

    // Check if email already exists
    if (users.some((user: any) => user.email === email)) {
      setError("Email already in use. Please use a different email or login.")
      setLoading(false)
      return
    }

    // Create new user
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password, // In a real app, you would hash this password
      createdAt: new Date().toISOString(),
    }

    // Add user to localStorage
    users.push(newUser)
    localStorage.setItem("users", JSON.stringify(users))

    // Store current user in localStorage (excluding password)
    const { password: _, ...userWithoutPassword } = newUser
    localStorage.setItem("currentUser", JSON.stringify(userWithoutPassword))

    // Redirect to home page
    router.push("/")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-start">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
            <CardDescription>Enter your information to create an account</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                />
                <p className="text-xs text-gray-500">
                  Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase
                  letter, one digit, and one special character.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Sign Up"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col">
            <div className="mt-2 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Login
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
