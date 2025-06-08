"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Download, RefreshCw, Bell, Facebook, Instagram, Linkedin, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageViewer } from "@/components/image-viewer";
import { Footer } from "@/components/footer";

interface Transaction {
  id: string;
  particulars: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  receiptNumber?: string;
}

interface DueRecord {
  id: string;
  customerName: string;
  customerContact: string;
  customerCountryCode: string;
  productOrdered: string;
  quantity: number;
  amountDue: number;
  expectedPaymentDate: string;
  createdAt: string;
  isPaid: boolean;
  paidAt?: string;
  receiptNumber?: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  profilePhoto?: string | null;
}

export default function AccountsPage() {
  const router = useRouter();
  const [particulars, setParticulars] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [totalDueBalance, setTotalDueBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const userJSON = localStorage.getItem("currentUser")
      if (!userJSON) return

      const currentUser = JSON.parse(userJSON)
      if (!currentUser?.token) return

      try {
        const response = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${currentUser.token}`,
            "Content-Type": "application/json",
          },
        })

        if (response.ok) {
          const userData = await response.json()
          setUser({
            id: userData.id || currentUser.id,
            name: userData.name || currentUser.name,
            email: userData.email || currentUser.email,
            profilePhoto: userData.profilePhoto
          })
        } else {
          setUser(currentUser)
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
        setUser(currentUser)
      }
    }

    fetchUserProfile()
  }, [])

  useEffect(() => {
    if (user) {
      const overduePayments = checkOverduePayments();
      setNotifications(overduePayments);

      const lastReadTime = localStorage.getItem("notificationsLastRead");
      if (lastReadTime) {
        const lastRead = new Date(lastReadTime);
        const hasNew = overduePayments.some((notification: any) => {
          const createdAt = new Date(notification.createdAt);
          return createdAt > lastRead;
        });
        setHasUnreadNotifications(hasNew || overduePayments.length > 0);
      } else if (overduePayments.length > 0) {
        setHasUnreadNotifications(true);
      }
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }

    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotificationsOpen]);

  const fetchDueRecords = async (userToken: string) => {
    try {
      const response = await fetch('/api/due', {
        headers: { Authorization: `Bearer ${userToken}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch due records`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const dueRecords: DueRecord[] = Array.isArray(data) ? data : [];
      const calculatedTotalDue = dueRecords
        .filter(record => !record.isPaid)
        .reduce((total, record) => total + (record.amountDue || 0), 0);
      
      return calculatedTotalDue;
    } catch (error) {
      console.error('Failed to fetch due records:', error);
      return 0;
    }
  };

  const fetchData = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    
    const userJSON = localStorage.getItem("currentUser");
    if (!userJSON) {
      router.push("/login");
      return;
    }

    const userData = JSON.parse(userJSON);

    try {
      // Check profile completion
      const profileRes = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${userData.token}` },
      });
      if (!profileRes.ok) throw new Error("Failed to fetch profile");
      const profile = await profileRes.json();

      if (!profile.isProfileComplete) {
        router.push("/profile?from=/accounts");
        return;
      }

      // Fetch transactions data
      const response = await fetch("/api/transactions", {
        headers: { Authorization: `Bearer ${userData.token}` },
      });
      const data = await response.json();

      // Fetch current due records and calculate total
      const currentTotalDue = await fetchDueRecords(userData.token);

      setTransactions(data.transactions);
      setBalance(data.balance);
      setTotalDueBalance(currentTotalDue);
      setUser(profile);

      // Save to localStorage for persistence
      localStorage.setItem(
        "accountTransactions",
        JSON.stringify(data.transactions)
      );
      localStorage.setItem("accountBalance", data.balance.toString());
      localStorage.setItem("totalDueBalance", currentTotalDue.toString());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      if (showRefreshing) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleDueRecordPaid = () => {
      console.log("Due record paid event received. Refreshing data...");
      fetchData(true); // Re-fetch all data, showing refresh spinner
    };

    window.addEventListener('dueRecordPaid', handleDueRecordPaid);

    return () => {
      window.removeEventListener('dueRecordPaid', handleDueRecordPaid);
    };
  }, [router]);

  const saveData = (newTransactions: Transaction[], newBalance: number) => {
    localStorage.setItem(
      "accountTransactions",
      JSON.stringify(newTransactions)
    );
    localStorage.setItem("accountBalance", newBalance.toString());
    setTransactions(newTransactions);
    setBalance(newBalance);
  };

  const handleTransaction = async (type: "credit" | "debit") => {
    if (
      !particulars ||
      !amount ||
      isNaN(Number.parseFloat(amount)) ||
      Number.parseFloat(amount) <= 0
    ) {
      alert("Please enter valid particulars and amount");
      return;
    }

    const amountValue = Number.parseFloat(amount);
    const userJSON = localStorage.getItem("currentUser");
    if (!userJSON) {
      router.push("/login");
      return;
    }

    const userData = JSON.parse(userJSON);

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userData.token}`,
        },
        body: JSON.stringify({
          particulars,
          amount: amountValue,
          type,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create transaction");
      }

      const data = await response.json();
      const newTransaction = data.transaction;

      const newTransactions = [...transactions, newTransaction];
      const newBalance = type === "credit" 
        ? balance + amountValue 
        : balance - amountValue;
      
      saveData(newTransactions, newBalance);
      setParticulars("");
      setAmount("");
    } catch (error) {
      console.error(`Failed to create ${type} transaction:`, error);
      alert(`Failed to create ${type} transaction`);
    }
  };

  const handleRefresh = () => {
    fetchData(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const formatDateOnly = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const exportToExcel = () => {
    if (transactions.length === 0) {
      alert("No transactions to export");
      return;
    }

    // Sort transactions by date (newest first) for export
    const sortedTransactions = [...transactions].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    let runningBalance = 0;
    const dataToExport = sortedTransactions.map((transaction) => {
      runningBalance =
        transaction.type === "credit"
          ? runningBalance + transaction.amount
          : runningBalance - transaction.amount;

      return {
        Date: formatDateOnly(transaction.date),
        Particulars: transaction.particulars,
        Type:
          transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
        "Receipt Number": transaction.receiptNumber || "",
        Amount: transaction.amount.toFixed(2),
        Balance: runningBalance.toFixed(2),
      };
    });

    const headers = Object.keys(dataToExport[0]).join(",");
    const headersCaps = headers
      .split(",")
      .map((h) => `"${h.toUpperCase()}"`)
      .join(",");

    const rows = dataToExport.map((row) => {
      return [
        `"${row.Date}"`,
        `"${row.Particulars}"`,
        `"${row.Type}"`,
        `"${row["Receipt Number"]}"`,
        `"${row.Amount}"`,
        `"${row.Balance}"`,
      ].join(",");
    });

    const csvContent = [headersCaps, ...rows].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `transactions_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getProfilePhotoUrl = (profilePhoto?: string | null): string => {
    if (!profilePhoto) return "/placeholder.svg";
    if (profilePhoto.startsWith('http')) return profilePhoto;
    if (profilePhoto.startsWith('data:')) return profilePhoto;
    if (profilePhoto.startsWith('/Uploads/')) return profilePhoto;
    return `/Uploads/${profilePhoto.replace(/^\/+/, '')}`;
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setUser(null);
    router.push("/login");
  };

  const checkOverduePayments = () => {
    const dueRecordsJSON = localStorage.getItem("dueRecords");
    if (!dueRecordsJSON) return [];

    const dueRecords = JSON.parse(dueRecordsJSON);
    const today = new Date();

    return dueRecords.filter((record: any) => {
      const dueDate = new Date(record.expectedPaymentDate);
      return !record.isPaid && dueDate < today;
    });
  };

  const handleNotificationClick = () => {
    setIsNotificationsOpen(!isNotificationsOpen);
    if (hasUnreadNotifications) {
      setHasUnreadNotifications(false);
      localStorage.setItem("notificationsLastRead", new Date().toISOString());
    }
  };

  const handleViewReceiptsClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      router.push("/login");
    }
  };

  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="w-full py-4 px-6 flex justify-between items-center border-b bg-gray-800 text-white">
        <h1 className="text-xl font-bold">Cash-Box</h1>
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
                        src={getProfilePhotoUrl(user.profilePhoto)}
                        alt={user.name}
                        className="h-10 w-10 rounded-full object-cover cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsImageViewerOpen(true);
                        }}
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                        <span className="text-sm font-medium text-gray-600">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
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

      <div className="flex-1">
        <div className="container mx-auto py-8 px-4">
          <div className="flex justify-between items-center mb-6">
            <div className="flex space-x-4">
              <Link href="/create">
                <Button className="font-medium">
                  Create Receipt <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link 
                href={user ? "/viewreceipts" : "#"} 
                onClick={handleViewReceiptsClick}
                className={!user ? "cursor-not-allowed" : ""}
              >
                <Button
                  className={`font-medium bg-green-600 hover:bg-green-700 ${
                    !user ? "opacity-70" : ""
                  }`}
                  disabled={!user}
                >
                  View Receipts <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <h2 className="text-lg font-medium mb-2">Current Balance</h2>
                  <p
                    className={`text-3xl font-bold ${
                      balance >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    ₹{balance.toFixed(2)}
                  </p>
                </div>

                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <h2 className="text-lg font-medium mb-2">Total Due Balance</h2>
                  <p className="text-3xl font-bold text-red-600">
                    -₹{totalDueBalance.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    <Link
                      href="/accounts/due"
                      className="underline hover:text-gray-700"
                    >
                      Manage due payments
                    </Link>
                  </p>
                  {totalDueBalance > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Synced with due records
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <input
                  type="text"
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  placeholder="Particulars"
                  className="flex-1 border px-4 py-2 rounded-md"
                />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 border px-4 py-2 rounded-md"
                />
                <Button
                  onClick={() => handleTransaction("credit")}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Add Credit
                </Button>
                <Button
                  onClick={() => handleTransaction("debit")}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Add Debit
                </Button>
              </div>

              {transactions.length > 0 && (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Transaction History</h3>
                    <Button
                      onClick={exportToExcel}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Download className="mr-2 h-4 w-4" /> Export to Excel
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden hidden md:block">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Particulars
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Receipt
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sortedTransactions.map((transaction) => (
                            <tr key={transaction.id}>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {formatDate(transaction.date)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {transaction.particulars}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span
                                  className={`px-2 inline-flex text-xs font-semibold rounded-full ${
                                    transaction.type === "credit"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {transaction.type.charAt(0).toUpperCase() +
                                    transaction.type.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {transaction.receiptNumber || "-"}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-medium">
                                <span
                                  className={
                                    transaction.type === "credit"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  ₹{transaction.amount.toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="md:hidden mt-4 space-y-4">
                    {sortedTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className={`p-4 rounded-lg border ${
                          transaction.type === "credit"
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium">
                            {transaction.particulars}
                          </span>
                          <span
                            className={`font-bold ${
                              transaction.type === "credit"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            ₹{transaction.amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>{formatDate(transaction.date)}</span>
                          <span
                            className={`px-2 py-1 rounded-full ${
                              transaction.type === "credit"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {transaction.type.charAt(0).toUpperCase() +
                              transaction.type.slice(1)}
                          </span>
                        </div>
                        {transaction.receiptNumber && (
                          <div className="mt-2 text-xs text-gray-500">
                            Receipt: {transaction.receiptNumber}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {user?.profilePhoto && (
        <ImageViewer
          src={getProfilePhotoUrl(user.profilePhoto)}
          alt={user.name}
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}
      <Footer />
    </div>
  );
}