"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

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

export default function AccountsPage() {
  const router = useRouter();
  const [particulars, setParticulars] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [totalDueBalance, setTotalDueBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

      // Save to localStorage for persistence
      localStorage.setItem(
        "accountTransactions",
        JSON.stringify(data.transactions)
      );
      localStorage.setItem("accountBalance", data.balance.toString());
      localStorage.setItem("totalDueBalance", currentTotalDue.toString());
      setUser(profile);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      if (showRefreshing) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
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

  const handleDebit = async () => {
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
          type: "debit",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create transaction");
      }

      const data = await response.json();
      const newTransaction = data.transaction;

      const newTransactions = [...transactions, newTransaction];
      const newBalance = balance - amountValue;
      
      saveData(newTransactions, newBalance);
      setParticulars("");
      setAmount("");
    } catch (error) {
      console.error("Failed to create debit transaction:", error);
      alert("Failed to create debit transaction");
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

  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

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
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="text-gray-600 border-gray-200 hover:bg-gray-50"
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> 
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Link href="/accounts/due">
            <Button
              variant="outline"
              className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
            >
              <FileText className="mr-2 h-4 w-4" /> Manage Due Payments
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
              onClick={handleDebit}
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
  );
}