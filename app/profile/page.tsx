// app/profile/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, User, Upload, X, LogOut } from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageViewer } from "@/components/image-viewer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserProfile {
  id: string;
  name: string;
  createdAt: string;
  storeName: string;
  storeAddress: string;
  storeContact: string;
  storeCountryCode: string;
  profilePhoto?: string | null;
  isProfileComplete: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeContact, setStoreContact] = useState("");
  const [storeCountryCode, setStoreCountryCode] = useState("+91");
  const [contactError, setContactError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [redirectFrom, setRedirectFrom] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Profile photo states
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  const checkProfileCompletion = useCallback(
    (profileData: Partial<UserProfile>): boolean => {
      return !!(
        profileData.name &&
        profileData.storeName &&
        profileData.storeAddress &&
        profileData.storeContact &&
        /^\d{10}$/.test(profileData.storeContact)
      );
    },
    []
  );

  const setUserState = useCallback(
    (userData: UserProfile) => {
      const isComplete = checkProfileCompletion(userData);
      setUser({ ...userData, isProfileComplete: isComplete });
      setName(userData.name || "");
      setStoreName(userData.storeName || "");
      setStoreAddress(userData.storeAddress || "");
      setStoreContact(userData.storeContact || "");
      setStoreCountryCode(userData.storeCountryCode || "+91");
      setProfilePhoto(userData.profilePhoto || null);
    },
    [checkProfileCompletion]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        setFetchError(null);

        const userJSON = localStorage.getItem("currentUser");
        if (!userJSON) {
          router.push("/login");
          return;
        }

        const currentUser = JSON.parse(userJSON);
        if (!currentUser?.token) {
          router.push("/login");
          return;
        }

        const response = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${currentUser.token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem("currentUser");
            router.push("/login");
            return;
          }
          throw new Error(`Failed to fetch profile: ${response.status}`);
        }

        const userData = await response.json();

        if (isMounted) {
          setUserState(userData);
          const from = new URLSearchParams(window.location.search).get("from");
          if (from) {
            setRedirectFrom(from);
            setShowProfileAlert(!userData.isProfileComplete);
          }
        }
      } catch (error: any) {
        if (isMounted) {
          setFetchError(error.message || "Failed to load profile data");
          console.error("Profile fetch error:", error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [router, setUserState]);

  useEffect(() => {
    if (user) {
      const isComplete = checkProfileCompletion({
        name,
        storeName,
        storeAddress,
        storeContact,
      });
      if (isComplete !== user.isProfileComplete) {
        updateProfileCompletionStatus(isComplete);
      }
      if (showProfileAlert && isComplete) {
        setShowProfileAlert(false);
      }
    }
  }, [
    name,
    storeName,
    storeAddress,
    storeContact,
    user,
    showProfileAlert,
    checkProfileCompletion,
  ]);

  const updateProfileCompletionStatus = async (isComplete: boolean) => {
    try {
      const userJSON = localStorage.getItem("currentUser");
      if (!userJSON) {
        router.push("/login");
        return;
      }

      const currentUser = JSON.parse(userJSON);

      const response = await fetch("/api/profile/complete", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ isProfileComplete: isComplete }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile completion status");
      }

      const updatedProfile = await response.json();
      setUser((prev) =>
        prev ? { ...prev, isProfileComplete: isComplete } : null
      );
    } catch (error) {
      console.error("Error updating profile completion:", error);
    }
  };

  const validateContact = (contact: string): boolean => {
    if (!contact) {
      setContactError("Contact number is required");
      return false;
    }
    if (!/^\d{10}$/.test(contact)) {
      setContactError("Contact number must be exactly 10 digits");
      return false;
    }
    setContactError("");
    return true;
  };

  const handlePhoneChange = (value: string, countryCode: string) => {
    setStoreContact(value || "");
    setStoreCountryCode(countryCode || "+91");
    validateContact(value);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!user) return;

    if (
      !name ||
      !storeName ||
      !storeAddress ||
      !storeContact ||
      !storeCountryCode
    ) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    if (!validateContact(storeContact)) {
      setLoading(false);
      return;
    }

    try {
      const userJSON = localStorage.getItem("currentUser");
      if (!userJSON) {
        router.push("/login");
        return;
      }

      const currentUser = JSON.parse(userJSON);

      let photoUrl = profilePhoto || null;
      if (selectedFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", selectedFile);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentUser.token}`,
          },
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload profile picture");
        }

        const uploadData = await uploadResponse.json();
        photoUrl = uploadData.url;
      } else if (profilePhoto === null) {
        photoUrl = null;
      }

      const isComplete = checkProfileCompletion({
        name,
        storeName,
        storeAddress,
        storeContact,
      });

      const profileData = {
        name,
        storeName,
        storeAddress,
        storeContact,
        storeCountryCode,
        profilePhoto: photoUrl,
        isProfileComplete: isComplete,
      };

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      const updatedProfile = await response.json();
      setSuccess("Profile updated successfully");
      setUserState(updatedProfile.updatedProfile);
      setSelectedFile(null);
      if (updatedProfile.isProfileComplete && redirectFrom) {
        router.push(redirectFrom);
      }
    } catch (error: any) {
      console.error("Update profile error:", error);
      setError(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!user) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      setLoading(false);
      return;
    }

    if (newPassword.length <= 7) {
      setError("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter");
      setLoading(false);
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setError("Password must contain at least one lowercase letter");
      setLoading(false);
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one digit");
      setLoading(false);
      return;
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      setError("Password must contain at least one special character");
      setLoading(false);
      return;
    }

    try {
      const userJSON = localStorage.getItem("currentUser");
      if (!userJSON) {
        router.push("/login");
        return;
      }

      const currentUser = JSON.parse(userJSON);

      const usersJSON = localStorage.getItem("users");
      const users = usersJSON ? JSON.parse(usersJSON) : [];
      const userToUpdate = users.find((u: any) => u.id === user.id);

      if (!userToUpdate) {
        setError("User not found");
        setLoading(false);
        return;
      }

      if (userToUpdate.password !== currentPassword) {
        setError("Current password is incorrect");
        setLoading(false);
        return;
      }

      const updatedUsers = users.map((u: any) =>
        u.id === user.id ? { ...u, password: newPassword } : u
      );
      localStorage.setItem("users", JSON.stringify(updatedUsers));

      setSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Update password error:", error);
      setError(error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  const handleProfilePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("File size too large. Maximum 5MB allowed.");
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProfilePhoto(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfilePhoto = () => {
    setProfilePhoto(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFullScreenPhoto = () => {
    if (profilePhoto) {
      setIsImageViewerOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Profile Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{fetchError}</AlertDescription>
            </Alert>
            <div className="mt-4 flex justify-center">
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
            <div className="mt-2 text-center">
              <Button variant="link" onClick={() => router.push("/login")}>
                Or go to login page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            User not found. Please log in again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <Link href="/">
          <Button
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center space-x-2 focus:outline-none">
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="h-10 w-10 rounded-full object-cover border-2 border-gray-200 cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={openFullScreenPhoto}
                />
              ) : (
                <div className="bg-gray-200 rounded-full p-2 h-10 w-10 flex items-center justify-center hover:bg-gray-300 transition-colors">
                  <User className="h-6 w-6 text-gray-600" />
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
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
        {showProfileAlert && !user.isProfileComplete && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-800" />
            <AlertDescription>
              Please complete your profile details before accessing{" "}
              {redirectFrom === "/create" ? "receipt creation" : "accounts"}.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div
                className="relative cursor-pointer group"
                onClick={handleProfilePhotoClick}
              >
                {profilePhoto ? (
                  <div className="relative">
                    <img
                      src={profilePhoto}
                      alt="Profile"
                      className="h-20 w-20 rounded-full object-cover border-2 border-gray-200 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFullScreenPhoto();
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                    <button
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProfilePhoto();
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
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
              <div>
                <CardTitle className="text-2xl">{user.name}</CardTitle>
                <p className="text-sm text-gray-500">
                  Member since {new Date(user.createdAt).toLocaleDateString()}
                </p>
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
                  All fields are required before you can create receipts or
                  access accounts
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
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeName">
                      Store/Enterprise Name{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="storeName"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      required
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
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeContact">
                      Store Contact Number{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex-1">
                      <PhoneInput
                        value={storeContact}
                        countryCode={storeCountryCode}
                        onChange={handlePhoneChange}
                        placeholder="10-digit number"
                      />
                    </div>
                    {contactError && (
                      <p className="text-sm text-red-500">{contactError}</p>
                    )}
                  </div>

                  <Button type="submit" disabled={loading}>
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
                    />
                    <p className="text-xs text-gray-500">
                      Password must be at least 8 characters long and contain at
                      least one uppercase letter, one lowercase letter, one
                      digit, and one special character.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
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
          src={profilePhoto}
          alt="Profile Photo"
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}
    </div>
  );
}
