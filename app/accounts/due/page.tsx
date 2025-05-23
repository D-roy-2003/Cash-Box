"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [user, setUser] = useState<{ token: string } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userJSON = localStorage.getItem('currentUser')
        if (!userJSON) {
          router.push('/login')
          return
        }

        const userData = JSON.parse(userJSON)
        setUser(userData)

        const response = await fetch('/api/due', {
          headers: { Authorization: `Bearer ${userData.token}` }
        })

        if (!response.ok) throw new Error('Failed to fetch due records')
        
        const data = await response.json()
        
        // Ensure all records have proper data structure with default values
        const sanitizedRecords = data.map((record: any) => ({
          id: record.id || '',
          customerName: record.customerName || 'Unknown Customer',
          customerContact: record.customerContact || '',
          customerCountryCode: record.customerCountryCode || '+91',
          productOrdered: record.productOrdered || 'Unknown Product',
          quantity: Number(record.quantity) || 0,
          amountDue: Number(record.amountDue) || 0,
          expectedPaymentDate: record.expectedPaymentDate || new Date().toISOString(),
          createdAt: record.createdAt || new Date().toISOString(),
          isPaid: Boolean(record.isPaid),
          paidAt: record.paidAt,
          receiptNumber: record.receiptNumber
        }))
        
        setDueRecords(sanitizedRecords)
      } catch (error) {
        console.error('Fetch error:', error)
        toast.error('Failed to load due records')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleMarkAsPaid = async (record: DueRecord) => {
    if (!user || isProcessing) return

    try {
      setIsProcessing(true)
      const response = await fetch('/api/due', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ id: record.id })
      })
      
      if (!response.ok) throw new Error('Payment processing failed')
      
      // Optimistic UI update
      setDueRecords(prev => prev.filter(r => r.id !== record.id))
      toast.success(`Payment from ${record.customerName} recorded`)
    } catch (err) {
      console.error('Payment error:', err)
      toast.error(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'N/A'
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch (error) {
      return 'Invalid Date'
    }
  }

  const isPastDue = (dateString: string) => {
    try {
      if (!dateString) return false
      const dueDate = new Date(dateString)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return dueDate < today
    } catch (error) {
      return false
    }
  }

  // Helper function to safely format currency
  const formatCurrency = (amount: number | undefined | null) => {
    const safeAmount = Number(amount) || 0
    return `₹${safeAmount.toFixed(2)}`
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
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
              {/* Desktop Table View */}
              <div className="border rounded-lg overflow-hidden hidden md:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                            {record.customerCountryCode} {record.customerContact}
                          </div>
                          {record.receiptNumber && (
                            <div className="text-xs text-gray-400 mt-1">Receipt: #{record.receiptNumber}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {record.productOrdered}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.quantity}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                          {formatCurrency(record.amountDue)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={isPastDue(record.expectedPaymentDate) && !record.isPaid ? "text-red-600 font-medium" : ""}>
                            {formatDate(record.expectedPaymentDate)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            record.isPaid
                              ? "bg-green-100 text-green-800"
                              : isPastDue(record.expectedPaymentDate)
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {record.isPaid ? "Paid" : isPastDue(record.expectedPaymentDate) ? "Overdue" : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                          {!record.isPaid ? (
                            <Button
                              onClick={() => handleMarkAsPaid(record)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <span className="flex items-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Processing...
                                </span>
                              ) : (
                                <>
                                  <Check className="mr-1 h-3 w-3" /> Mark Paid
                                </>
                              )}
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
              
              {/* Mobile Card View */}
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
                        <p className="text-sm text-gray-600">{record.productOrdered}</p>
                        {record.receiptNumber && (
                          <p className="text-xs text-gray-400">Receipt: #{record.receiptNumber}</p>
                        )}
                      </div>
                      <span className="font-bold text-red-600">{formatCurrency(record.amountDue)}</span>
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
                        <span className={`text-xs ${
                          isPastDue(record.expectedPaymentDate) && !record.isPaid ? "text-red-600 font-medium" : ""
                        }`}>
                          {formatDate(record.expectedPaymentDate)}
                        </span>
                      </div>

                      {!record.isPaid ? (
                        <Button
                          onClick={() => handleMarkAsPaid(record)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </span>
                          ) : (
                            <>
                              <Check className="mr-1 h-3 w-3" /> Mark Paid
                            </>
                          )}
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
