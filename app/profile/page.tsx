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
  id: string | number;
  superkey: string;
  name: string;
  email: string;
  createdAt: string;
  storeName: string;
  storeAddress: string;
  storeContact: string;
  storeCountryCode: string;
  gstNumber?: string | null;
  profilePhoto?: string | null;
  isProfileComplete: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeContact, setStoreContact] = useState("");
  const [storeCountryCode, setStoreCountryCode] = useState("+91");
  const [gstNumber, setGstNumber] = useState<string>("");
  const [gstError, setGstError] = useState("");
  const [contactError, setContactError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [redirectFrom, setRedirectFrom] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Profile photo states
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const checkProfileCompletion = useCallback(
    (profileData: Partial<UserProfile>): boolean => {
      return !!(
        profileData.name &&
        profileData.storeName &&
        profileData.storeAddress &&
        profileData.storeContact &&
        profileData.storeCountryCode &&
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
      setGstNumber(userData.gstNumber || "");
      setProfilePhoto(userData.profilePhoto || null);
    },
    [checkProfileCompletion]
  );

  const formatDate = (dateString: string): string => {
    try {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.error("Date formatting error:", error);
      return "N/A";
    }
  };

  const fetchProfile = useCallback(async () => {
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
      return userData;
    } catch (error: any) {
      console.error("Profile fetch error:", error);
      setFetchError(error.message || "Failed to load profile data");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const userData = await fetchProfile();
        if (isMounted) {
          setUserState(userData);
          const from = new URLSearchParams(window.location.search).get("from");
          if (from) {
            setRedirectFrom(from);
            setShowProfileAlert(!userData.isProfileComplete);
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [fetchProfile, setUserState]);

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

  const validateGstNumber = (gst: string): boolean => {
    if (!gst) {
      setGstError("");
      return true; // GST is optional
    }
    
    if (gst.length !== 15) {
      setGstError("GST number must be exactly 15 characters");
      return false;
    }
    
    if (!/^[0-9A-Z]{15}$/.test(gst)) {
      setGstError("GST number must be 15 digit alphanumeric");
      return false;
    }
    
    setGstError("");
    return true;
  };

  const handlePhoneChange = (value: string, countryCode: string) => {
    setStoreContact(value || "");
    setStoreCountryCode(countryCode || "+91");
    validateContact(value);
  };

  const handleGstChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setGstNumber(value);
    validateGstNumber(value);
  };

  const uploadProfilePhoto = async (file: File, token: string): Promise<string | null> => {
    try {
      setIsUploading(true);
      setError("");

      // Validate file type
      if (!file.type.startsWith("image/")) {
        throw new Error("Please select an image file");
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("File size too large. Maximum 5MB allowed.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload profile photo");
      }

      const data = await response.json();
      return data.filePath;
    } catch (error: any) {
      console.error("Upload error:", error);
      throw new Error(error.message || "Failed to upload profile photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleProfilePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(""); // Clear any previous errors
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

    if (!validateGstNumber(gstNumber)) {
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

      // Prepare the update payload
      const updatePayload: any = {
        name,
        storeName,
        storeAddress,
        storeContact,
        storeCountryCode,
        gstNumber: gstNumber || null,
      };

      // If no new file is selected, but an existing photo is present, include it in the payload
      if (!selectedFile && profilePhoto) {
        updatePayload.profilePhoto = profilePhoto;
      }

      // Handle profile photo upload if a new file was selected
      if (selectedFile) {
        try {
          const photoUrl = await uploadProfilePhoto(selectedFile, currentUser.token);
          if (photoUrl) {
            updatePayload.profilePhoto = photoUrl;
          }
        } catch (uploadError: any) {
          setError(uploadError.message || "Failed to upload profile photo");
          setLoading(false);
          return;
        }
      } else if (profilePhoto === null && !selectedFile) {
        // Explicitly set to null if user removed the photo and no new file was selected
        updatePayload.profilePhoto = null;
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      const { updatedProfile } = await response.json();
      
      setSuccess("Profile updated successfully");
      setUserState(updatedProfile);
      setSelectedFile(null);
      
      // Update profile completion status
      const isComplete = checkProfileCompletion(updatedProfile);
      if (isComplete && redirectFrom) {
        router.push(redirectFrom);
      }
    } catch (error: any) {
      console.error("Update profile error:", error);
      setError(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // Password validation function
  const validatePassword = (password: string): { isValid: boolean; error: string } => {
    if (password.length < 8) {
      return { isValid: false, error: "Password must be at least 8 characters long" };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, error: "Password must contain at least one uppercase letter" };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, error: "Password must contain at least one lowercase letter" };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, error: "Password must contain at least one number" };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { isValid: false, error: "Password must contain at least one special character" };
    }
    return { isValid: true, error: "" };
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      setIsChangingPassword(false);
      return;
    }

    // Check if new password is same as current password
    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from current password");
      setIsChangingPassword(false);
      return;
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error);
      setIsChangingPassword(false);
      return;
    }

    try {
      const userJSON = localStorage.getItem("currentUser");
      if (!userJSON) {
        router.push("/login");
        return;
      }

      const currentUser = JSON.parse(userJSON);

      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to change password");
      }

      setPasswordSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setPasswordError(error.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/login");
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
              <Button variant="link" onClick={() => router.push("/login")}>Or go to login page</Button>
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
        <Link href="/accounts">
          <Button
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
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
        {!isLoading && showProfileAlert && user && !user.isProfileComplete && (
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
                <CardTitle className="text-2xl">{user?.name}</CardTitle>
                <CardDescription className="text-sm text-gray-500">
                  Member since {formatDate(user?.createdAt || "")}
                </CardDescription>
                <CardDescription className="text-sm">
                  {user?.email}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile Information</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
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
                    <Label htmlFor="superkey">Super Key</Label>
                    <div className="relative">
                      <Input
                        id="superkey"
                        type="text"
                        value={user?.superkey || ""}
                        readOnly
                        className="bg-gray-100 cursor-not-allowed pr-10"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-gray-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                    <p className="text-sm text-red-500">
                      This is your unique identifier (Never share this with anyone and Save it somewhere safe)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeName">Store Name *</Label>
                    <Input
                      id="storeName"
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Enter your store name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeAddress">Store Address *</Label>
                    <Input
                      id="storeAddress"
                      type="text"
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      placeholder="Enter your store address"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeContact">Store Contact Number * (This will be used to login to your account)</Label>
                    <PhoneInput
                      value={storeContact}
                      countryCode={storeCountryCode}
                      onChange={handlePhoneChange}
                      placeholder="Enter 10 digit phone number"
                      className="w-full"
                    />
                    {contactError && (
                      <p className="text-sm text-red-600">{contactError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gstNumber">GST Number</Label>
                    <Input
                      id="gstNumber"
                      type="text"
                      value={gstNumber}
                      onChange={handleGstChange}
                      placeholder="Enter 15 digit GST number (optional)"
                      maxLength={15}
                      className="uppercase"
                    />
                    {gstError && (
                      <p className="text-sm text-red-600">{gstError}</p>
                    )}
                    <div className="text-sm text-gray-500">
                      <p>GST number must be exactly 15 alphanumeric characters</p>
                    </div>
                  </div>

                  <Button type="submit" disabled={loading || isUploading} className="w-full">
                    {loading ? "Updating..." : isUploading ? "Uploading..." : "Update Profile"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Account Security</CardTitle>
                <CardDescription>
                  Manage your account security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Change Password</h3>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
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
                        placeholder="Enter your new password"
                        required
                      />
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      <p>Password must contain:</p>
                      <ul className="list-disc list-inside">
                        <li>At least 8 characters</li>
                        <li>At least one uppercase letter</li>
                        <li>At least one lowercase letter</li>
                        <li>At least one number</li>
                        <li>At least one special character</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your new password"
                        required
                      />
                    </div>
                    
                    {passwordError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{passwordError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {passwordSuccess && (
                      <Alert className="bg-green-50 text-green-800 border-green-200">
                        <AlertDescription>{passwordSuccess}</AlertDescription>
                      </Alert>
                    )}
                    
                    <Button 
                      type="submit" 
                      disabled={isChangingPassword} 
                      className="w-full"
                    >
                      {isChangingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </form>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-2">Session Management</h3>
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out of all devices
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Image Viewer Modal */}
      {profilePhoto && (
        <ImageViewer
          isOpen={isImageViewerOpen}
          src={profilePhoto}
          alt="Profile Photo"
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}
    </div>
  );
}