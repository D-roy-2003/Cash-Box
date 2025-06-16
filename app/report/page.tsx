"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Download, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getYear, setYear } from "date-fns";

interface Transaction {
  id: string;
  particulars: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  receiptNumber?: string;
  createdAt: string;
  details?: {
    credit: number;
    debit: number;
    transactionCount: number;
  };
}

export default function ReportPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<"day" | "month" | "year">("month");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [runningBalance, setRunningBalance] = useState<number[]>([]);
  const [aggregatedTransactions, setAggregatedTransactions] = useState<Transaction[]>([]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, [filterType, filterDate]);

  const handleReportTypeChange = (value: "day" | "month" | "year") => {
    setFilterType(value);
    const currentDate = new Date();
    
    switch (value) {
      case "year":
        setFilterDate(`${currentDate.getFullYear()}-01-01`);
        break;
      case "month":
        setFilterDate(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`);
        break;
      case "day":
        setFilterDate(currentDate.toISOString().split('T')[0]);
        break;
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setFilterDate(newDate);
  };

  const handleYearSelect = (year: number) => {
    const currentDate = new Date(filterDate);
    currentDate.setFullYear(year);
    setFilterDate(format(currentDate, 'yyyy-MM-dd'));
    setShowYearPicker(false);
  };

  const handleMonthSelect = (date: Date) => {
    setFilterDate(format(date, 'yyyy-MM-dd'));
    setShowMonthPicker(false);
  };

  const getMonthDays = () => {
    const currentDate = new Date(filterDate);
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  };

  const handlePrevMonth = () => {
    const currentDate = new Date(filterDate);
    currentDate.setMonth(currentDate.getMonth() - 1);
    setFilterDate(format(currentDate, 'yyyy-MM-dd'));
  };

  const handleNextMonth = () => {
    const currentDate = new Date(filterDate);
    currentDate.setMonth(currentDate.getMonth() + 1);
    setFilterDate(format(currentDate, 'yyyy-MM-dd'));
  };

  const getYearRange = () => {
    const currentYear = getYear(new Date());
    const startYear = 2000;
    const years = [];
    for (let year = startYear; year <= currentYear; year++) {
      years.push(year);
    }
    return years;
  };

  const getDateInputType = () => {
    switch (filterType) {
      case "year":
        return "number";
      case "month":
        return "month";
      case "day":
        return "date";
      default:
        return "date";
    }
  };

  const getDateInputValue = () => {
    const date = new Date(filterDate);
    switch (filterType) {
      case "year":
        return date.getFullYear().toString();
      case "month":
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case "day":
        return filterDate;
      default:
        return filterDate;
    }
  };

  const getDateInputMin = () => {
    return "";
  };

  const getDateInputMax = () => {
    return "";
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const userJSON = localStorage.getItem("currentUser");
      if (!userJSON) return;

      const userData = JSON.parse(userJSON);
      const response = await fetch("/api/transactions", {
        headers: { Authorization: `Bearer ${userData.token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch transactions");
      
      const data = await response.json();
      let filteredAndSortedTransactions = filterTransactionsByDate(data.transactions);

      // Apply secondary sort by createdAt for transactions on the same date
      filteredAndSortedTransactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        if (dateA === dateB) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return dateA - dateB;
      });

      setTransactions(filteredAndSortedTransactions);
      
      if (filterType === "year") {
        const aggregated = aggregateMonthlyTransactions(filteredAndSortedTransactions);
        setAggregatedTransactions(aggregated);
        calculateRunningBalance(aggregated);
      } else {
        setAggregatedTransactions(filteredAndSortedTransactions);
        calculateRunningBalance(filteredAndSortedTransactions);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterTransactionsByDate = (transactions: Transaction[]) => {
    const date = new Date(filterDate);
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      switch (filterType) {
        case "day":
          return transactionDate.toDateString() === date.toDateString();
        case "month":
          return (
            transactionDate.getMonth() === date.getMonth() &&
            transactionDate.getFullYear() === date.getFullYear()
          );
        case "year":
          return transactionDate.getFullYear() === date.getFullYear();
        default:
          return true;
      }
    });
  };

  const aggregateMonthlyTransactions = (transactions: Transaction[]) => {
    const monthlyMap = new Map<string, { credit: number; debit: number; particulars: string[] }>();

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { credit: 0, debit: 0, particulars: [] });
      }
      
      const monthData = monthlyMap.get(monthKey)!;
      if (transaction.type === "credit") {
        monthData.credit += transaction.amount;
      } else {
        monthData.debit += transaction.amount;
      }
      monthData.particulars.push(transaction.particulars);
    });

    return Array.from(monthlyMap.entries()).map(([monthKey, data]) => {
      const [year, month] = monthKey.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      
      return {
        id: monthKey,
        date: date.toISOString(),
        particulars: `Monthly Summary - ${date.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        amount: Math.max(data.credit, data.debit),
        type: data.credit >= data.debit ? "credit" as const : "debit" as const,
        receiptNumber: undefined,
        createdAt: date.toISOString(),
        details: {
          credit: data.credit,
          debit: data.debit,
          transactionCount: data.particulars.length
        }
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const calculateRunningBalance = (transactions: Transaction[]) => {
    let balance = 0;
    const balances = transactions.map(transaction => {
      if (filterType === "year") {
        balance += (transaction.details?.credit || 0) - (transaction.details?.debit || 0);
      } else {
        balance += transaction.type === "credit" ? transaction.amount : -transaction.amount;
      }
      return balance;
    });
    setRunningBalance(balances);
  };

  const exportToExcel = () => {
    let dataToProcess: Transaction[] = [];

    if (filterType === "year") {
      dataToProcess = [...aggregatedTransactions];
    } else {
      dataToProcess = [...transactions];
    }

    if (dataToProcess.length === 0) {
      alert("No transactions to export");
      return;
    }

    // Apply sorting logic
    dataToProcess.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (dateA === dateB) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return dateA - dateB;
    });

    const headers = ["Date", "Particulars", "Credit", "Debit", "Balance"];

    const csvRows = dataToProcess.map((transaction, index) => {
      let creditAmount = "";
      let debitAmount = "";
      let particularsText = transaction.particulars;

      if (filterType === "year") {
        // Explicitly cast to ensure 'details' is recognized as present
        const aggregatedTransaction = transaction as Required<Transaction>;
        creditAmount = aggregatedTransaction.details.credit.toFixed(2);
        debitAmount = aggregatedTransaction.details.debit.toFixed(2);
        particularsText = `Monthly Summary - ${new Date(aggregatedTransaction.date).toLocaleString('default', { month: 'long', year: 'numeric' })}`;
      } else {
        if (transaction.type === "credit") {
          creditAmount = transaction.amount.toFixed(2);
        } else {
          debitAmount = transaction.amount.toFixed(2);
        }
      }

      const balanceValue = runningBalance[index] !== undefined ? runningBalance[index].toFixed(2) : "";

      return [
        `"${formatDate(transaction.date)}"`,
        `"${particularsText}"`,
        `"${creditAmount}"`,
        `"${debitAmount}"`,
        `"${balanceValue}"`,
      ].join(",");
    });

    const csvContent = [
      headers.map((h) => `"${h.toUpperCase()}"`).join(","),
      ...csvRows,
    ].join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `report_${filterType}_${format(new Date(filterDate), 'yyyy-MM-dd')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const totalCredit = filterType === "year"
    ? aggregatedTransactions.reduce((sum, t) => sum + (t.details?.credit || 0), 0)
    : transactions.filter(t => t.type === "credit").reduce((sum, t) => sum + t.amount, 0);

  const totalDebit = filterType === "year"
    ? aggregatedTransactions.reduce((sum, t) => sum + (t.details?.debit || 0), 0)
    : transactions.filter(t => t.type === "debit").reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <Link href="/accounts">
            <Button variant="outline" size="sm" className="flex items-center gap-2 text-blue-600 border-blue-600 hover:bg-blue-50">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Button onClick={exportToExcel} className="bg-blue-600 hover:bg-blue-700">
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Transaction Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label className="text-sm font-medium mb-1.5">Report Type</Label>
                <Select
                  value={filterType}
                  onValueChange={handleReportTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Daily</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5">
                  {filterType === "year" ? "Year" : 
                   filterType === "month" ? "Month" : "Date"}
                </Label>
                {filterType === "year" ? (
                  <div className="relative">
                    <Input
                      type="text"
                      value={format(new Date(filterDate), 'yyyy')}
                      onClick={() => setShowYearPicker(!showYearPicker)}
                      readOnly
                      className="cursor-pointer"
                    />
                    {showYearPicker && (
                      <div className="absolute z-10 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200">
                        <div className="p-2 border-b">
                          <div className="text-center font-medium mb-2">
                            Select Year
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-1 p-2 max-h-60 overflow-y-auto">
                          {getYearRange().map((year) => (
                            <Button
                              key={year}
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-12 p-0 ${
                                year === getYear(new Date(filterDate)) ? 'bg-blue-100' : ''
                              }`}
                              onClick={() => handleYearSelect(year)}
                            >
                              {year}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : filterType === "month" ? (
                  <div className="relative">
                    <Input
                      type="text"
                      value={format(new Date(filterDate), 'MMMM yyyy')}
                      onClick={() => setShowMonthPicker(!showMonthPicker)}
                      readOnly
                      className="cursor-pointer"
                    />
                    {showMonthPicker && (
                      <div className="absolute z-10 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200">
                        <div className="p-2 flex items-center justify-between border-b">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePrevMonth}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="font-medium">
                            {format(new Date(filterDate), 'MMMM yyyy')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleNextMonth}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 p-2">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-center text-sm text-gray-500 py-1">
                              {day}
                            </div>
                          ))}
                          {getMonthDays().map((date, index) => (
                            <Button
                              key={index}
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 p-0 ${
                                isToday(date) ? 'bg-blue-100' : ''
                              }`}
                              onClick={() => handleMonthSelect(date)}
                            >
                              {format(date, 'd')}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={handleDateChange}
                    min={getDateInputMin()}
                    max={getDateInputMax()}
                  />
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Particulars
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Credit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Balance
                      </th>
                      {filterType === "year" && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Transactions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(filterType === "year" ? aggregatedTransactions : transactions).map((transaction, index) => (
                      <tr key={transaction.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.particulars}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                          {filterType === "year"
                            ? formatCurrency(transaction.details?.credit || 0)
                            : transaction.type === "credit"
                              ? formatCurrency(transaction.amount)
                              : ""}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                          {filterType === "year"
                            ? formatCurrency(transaction.details?.debit || 0)
                            : transaction.type === "debit"
                              ? formatCurrency(transaction.amount)
                              : ""}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                          {formatCurrency(runningBalance[index])}
                        </td>
                        {filterType === "year" && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                            {transaction.details?.transactionCount}
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        Total
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {filterType === "year" 
                          ? "Yearly Summary" 
                          : `${transactions.length} transactions`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                        {formatCurrency(totalCredit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                        {formatCurrency(totalDebit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {formatCurrency(runningBalance[runningBalance.length - 1] || 0)}
                      </td>
                      {filterType === "year" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                          {transactions.length}
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 