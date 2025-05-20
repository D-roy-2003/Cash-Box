"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

interface DueRecord {
  id: string
  customerName: string
  customerContact: string
  customerCountryCode: string
  productOrdered: string
  quantity: number
  amountDue: number
  expectedPaymentDate: string
  createdAt: string
  isPaid: boolean
  paidAt?: string
  receiptNumber?: string
}

const countryCodes = [
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+1", flag: "🇺🇸", name: "United States" },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+7", flag: "🇷🇺", name: "Russia" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "+66", flag: "🇹🇭", name: "Thailand" },
]

export default function DuePage() {
  const router = useRouter()
  const [dueRecords, setDueRecords] = useState<DueRecord[]>([])
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

    // Load due records from localStorage
    const storedRecords = localStorage.getItem("dueRecords")
    if (storedRecords) {
      setDueRecords(JSON.parse(storedRecords))
    }
  }, [router])

  const saveData = (newRecords: DueRecord[]) => {
    localStorage.setItem("dueRecords", JSON.stringify(newRecords))
    setDueRecords(newRecords)

    // Update total due balance
    updateTotalDueBalance(newRecords)
  }

  const updateTotalDueBalance = (records: DueRecord[]) => {
    const totalDue = records.reduce((total, record) => {
      if (!record.isPaid) {
        return total + record.amountDue
      }
      return total
    }, 0)

    localStorage.setItem("totalDueBalance", totalDue.toString())
  }

  const handleMarkAsPaid = (id: string) => {
    const record = dueRecords.find((r) => r.id === id)
    if (!record || record.isPaid) return

    // Update the record to mark as paid
    const updatedRecords = dueRecords.map((r) => {
      if (r.id === id) {
        return { ...r, isPaid: true, paidAt: new Date().toISOString() }
      }
      return r
    })

    // Save updated records
    saveData(updatedRecords)

    // Add the payment to transactions in accounts
    const storedTransactions = localStorage.getItem("accountTransactions")
    const storedBalance = localStorage.getItem("accountBalance")

    let transactions = storedTransactions ? JSON.parse(storedTransactions) : []
    let balance = storedBalance ? Number.parseFloat(storedBalance) : 0

    // Add new transaction for the payment received
    const newTransaction = {
      id: Date.now().toString(),
      particulars: `Payment received from ${record.customerName} for ${record.productOrdered} (Due Payment)`,
      amount: record.amountDue,
      type: "credit",
      date: new Date().toISOString(),
    }

    transactions = [...transactions, newTransaction]
    balance += record.amountDue

    // Save updated transactions and balance
    localStorage.setItem("accountTransactions", JSON.stringify(transactions))
    localStorage.setItem("accountBalance", balance.toString())
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  const isPastDue = (dateString: string) => {
    const dueDate = new Date(dateString)
    const today = new Date()
    return dueDate < today
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <Link href="/accounts">
          <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Accounts
          </Button>
        </Link>
      </div>

      {dueRecords.length > 0 ? (
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Due Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="border rounded-lg overflow-hidden hidden md:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Customer
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Product
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Qty
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Amount
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Due Date
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dueRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{record.customerName}</div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <span className="mr-1">
                              {countryCodes.find((c) => c.code === record.customerCountryCode)?.flag || "🌍"}
                            </span>
                            <span className="truncate max-w-[80px] md:max-w-none">
                              {record.customerCountryCode} {record.customerContact}
                            </span>
                          </div>
                          {record.receiptNumber && (
                            <div className="text-xs text-gray-400 mt-1">Receipt: #{record.receiptNumber}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500 max-w-[80px] truncate md:max-w-none md:whitespace-nowrap">
                          {record.productOrdered}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{record.quantity}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                          ₹{record.amountDue.toFixed(2)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span
                            className={
                              isPastDue(record.expectedPaymentDate) && !record.isPaid ? "text-red-600 font-medium" : ""
                            }
                          >
                            {formatDate(record.expectedPaymentDate)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              record.isPaid
                                ? "bg-green-100 text-green-800"
                                : isPastDue(record.expectedPaymentDate)
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {record.isPaid ? "Paid" : isPastDue(record.expectedPaymentDate) ? "Overdue" : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                          {!record.isPaid ? (
                            <Button
                              onClick={() => handleMarkAsPaid(record.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="mr-1 h-3 w-3" /> Mark Paid
                            </Button>
                          ) : (
                            <span className="text-gray-500 text-xs">Paid on {formatDate(record.paidAt || "")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card view for due records */}
              <div className="md:hidden mt-4 space-y-4">
                {dueRecords.map((record) => (
                  <div
                    key={record.id}
                    className={`p-4 rounded-lg border ${
                      record.isPaid
                        ? "bg-green-50 border-green-200"
                        : isPastDue(record.expectedPaymentDate)
                          ? "bg-red-50 border-red-200"
                          : "bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">{record.customerName}</h3>
                        <p className="text-sm text-gray-600 truncate">{record.productOrdered}</p>
                        {record.receiptNumber && (
                          <p className="text-xs text-gray-400">Receipt: #{record.receiptNumber}</p>
                        )}
                      </div>
                      <span className="font-bold text-red-600">₹{record.amountDue.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                      <div className="flex items-center">
                        <span className="mr-1">
                          {countryCodes.find((c) => c.code === record.customerCountryCode)?.flag || "🌍"}
                        </span>
                        <span>
                          {record.customerCountryCode} {record.customerContact}
                        </span>
                      </div>
                      <span>Qty: {record.quantity}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs text-gray-500 mr-2">Due: </span>
                        <span
                          className={`text-xs ${isPastDue(record.expectedPaymentDate) && !record.isPaid ? "text-red-600 font-medium" : ""}`}
                        >
                          {formatDate(record.expectedPaymentDate)}
                        </span>
                      </div>

                      {!record.isPaid ? (
                        <Button
                          onClick={() => handleMarkAsPaid(record.id)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="mr-1 h-3 w-3" /> Mark Paid
                        </Button>
                      ) : (
                        <span className="text-xs text-green-600">Paid on {formatDate(record.paidAt || "")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-4xl mx-auto text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-xl font-medium text-gray-700 mb-2">No Due Records</h3>
          <p className="text-gray-500 mb-4">
            Due records will appear here when you create receipts with advance or due payments.
          </p>
          <Link href="/create">
            <Button className="bg-blue-600 hover:bg-blue-700">Create Receipt</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
