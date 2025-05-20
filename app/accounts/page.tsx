"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

interface Transaction {
  id: string
  particulars: string
  amount: number
  type: "credit" | "debit"
  date: string
}

export default function AccountsPage() {
  const router = useRouter()
  const [particulars, setParticulars] = useState("")
  const [amount, setAmount] = useState("")
  const [balance, setBalance] = useState(0)
  const [totalDueBalance, setTotalDueBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Check if user is logged in
    const userJSON = localStorage.getItem("currentUser")
    if (!userJSON) {
      router.push("/login")
      return
    }

    const userData = JSON.parse(userJSON)

    // Check if profile is complete
    if (!userData.profileComplete) {
      router.push("/profile?from=/accounts")
      return
    }

    setUser(userData)

    // Load transactions and balance from localStorage
    const storedTransactions = localStorage.getItem("accountTransactions")
    const storedBalance = localStorage.getItem("accountBalance")
    const storedDueBalance = localStorage.getItem("totalDueBalance")

    if (storedTransactions) {
      setTransactions(JSON.parse(storedTransactions))
    }

    if (storedBalance) {
      setBalance(Number.parseFloat(storedBalance))
    }

    if (storedDueBalance) {
      setTotalDueBalance(Number.parseFloat(storedDueBalance))
    }
  }, [router])

  const saveData = (newTransactions: Transaction[], newBalance: number) => {
    localStorage.setItem("accountTransactions", JSON.stringify(newTransactions))
    localStorage.setItem("accountBalance", newBalance.toString())
    setTransactions(newTransactions)
    setBalance(newBalance)
  }

  const handleCredit = () => {
    if (!particulars || !amount || isNaN(Number.parseFloat(amount)) || Number.parseFloat(amount) <= 0) {
      alert("Please enter valid particulars and amount")
      return
    }

    const amountValue = Number.parseFloat(amount)
    const newBalance = balance + amountValue

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      particulars,
      amount: amountValue,
      type: "credit",
      date: new Date().toISOString(),
    }

    const newTransactions = [...transactions, newTransaction]
    saveData(newTransactions, newBalance)

    // Reset form
    setParticulars("")
    setAmount("")
  }

  const handleDebit = () => {
    if (!particulars || !amount || isNaN(Number.parseFloat(amount)) || Number.parseFloat(amount) <= 0) {
      alert("Please enter valid particulars and amount")
      return
    }

    const amountValue = Number.parseFloat(amount)
    const newBalance = balance - amountValue

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      particulars,
      amount: amountValue,
      type: "debit",
      date: new Date().toISOString(),
    }

    const newTransactions = [...transactions, newTransaction]
    saveData(newTransactions, newBalance)

    // Reset form
    setParticulars("")
    setAmount("")
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString()
  }

  const formatDateOnly = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  const exportToExcel = () => {
    if (transactions.length === 0) {
      alert("No transactions to export")
      return
    }

    // Sort transactions by date (oldest first)
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate running balance for each transaction
    let runningBalance = 0
    const dataToExport = sortedTransactions.map((transaction) => {
      runningBalance =
        transaction.type === "credit" ? runningBalance + transaction.amount : runningBalance - transaction.amount

      return {
        Date: formatDateOnly(transaction.date),
        Particulars: transaction.particulars,
        Type: transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
        Amount: transaction.amount.toFixed(2),
        Balance: runningBalance.toFixed(2),
      }
    })

    // Convert to CSV for Excel compatibility with proper formatting
    const headers = Object.keys(dataToExport[0]).join(",")

    // Format the rows with proper cell width
    const rows = dataToExport.map((row) => {
      return [`"${row.Date}"`, `"${row.Particulars}"`, `"${row.Type}"`, `"${row.Amount}"`, `"${row.Balance}"`].join(",")
    })

    // Create CSV content with headers in CAPS
    const headersCaps = headers
      .split(",")
      .map((h) => `"${h.toUpperCase()}"`)
      .join(",")
    const csvContent = [headersCaps, ...rows].join("\n")

    // Create a blob with Excel styling hints
    const bom = "\uFEFF" // UTF-8 BOM for Excel
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `transactions_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <Link href="/">
          <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>
        <Link href="/accounts/due">
          <Button variant="outline" className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200">
            <FileText className="mr-2 h-4 w-4" /> Manage Due Payments
          </Button>
        </Link>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-4 bg-muted rounded-lg text-center">
              <h2 className="text-lg font-medium mb-2">Current Balance</h2>
              <p className={`text-3xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                ₹{balance.toFixed(2)}
              </p>
            </div>

            <div className="p-4 bg-red-50 rounded-lg text-center">
              <h2 className="text-lg font-medium mb-2">Total Due Balance</h2>
              <p className="text-3xl font-bold text-red-600">-₹{totalDueBalance.toFixed(2)}</p>
              <p className="text-sm text-gray-500 mt-1">
                <Link href="/accounts/due" className="underline hover:text-gray-700">
                  Manage due payments
                </Link>
              </p>
            </div>
          </div>

          {transactions.length > 0 && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Transaction History</h3>
                <Button onClick={exportToExcel} className="bg-blue-600 hover:bg-blue-700">
                  <Download className="mr-2 h-4 w-4" /> Export to Excel
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Date
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Particulars
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Type
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(transaction.date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate md:max-w-none md:whitespace-nowrap">
                            {transaction.particulars}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                transaction.type === "credit"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                            <span className={transaction.type === "credit" ? "text-green-600" : "text-red-600"}>
                              ₹{transaction.amount.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Mobile card view for transactions */}
              <div className="md:hidden mt-4 space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`p-4 rounded-lg border ${
                      transaction.type === "credit" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium">{transaction.particulars}</span>
                      <span
                        className={`font-bold ${transaction.type === "credit" ? "text-green-600" : "text-red-600"}`}
                      >
                        ₹{transaction.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{formatDate(transaction.date)}</span>
                      <span
                        className={`px-2 py-1 rounded-full ${
                          transaction.type === "credit" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
