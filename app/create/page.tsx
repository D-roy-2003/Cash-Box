"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PhoneInput } from "@/components/phone-input"

export default function CreateReceipt() {
  const router = useRouter()
  const [receiptData, setReceiptData] = useState({
    receiptNumber: "",
    date: "",
    customerName: "",
    customerContact: "",
    customerCountryCode: "+91",
    paymentType: "",
    paymentStatus: "full",
    notes: "",
    items: [{ description: "", quantity: 1, price: 0, advanceAmount: 0, dueAmount: 0 }],
  })

  const [user, setUser] = useState<any>(null)
  const [cardNumber, setCardNumber] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91")
  const [receiptCount, setReceiptCount] = useState(1)
  const [generatedReceiptNumber, setGeneratedReceiptNumber] = useState("")
  const [customerContactError, setCustomerContactError] = useState("")
  const [transactions, setTransactions] = useState<any[]>([])
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    // Get current date in local timezone format
    const today = new Date()
    const localDate = today.toLocaleDateString("en-CA") // Format as YYYY-MM-DD for input[type="date"]

    // Load user data
    const userJSON = localStorage.getItem("currentUser")
    if (!userJSON) {
      router.push("/login")
      return
    }

    const userData = JSON.parse(userJSON)

    // Check if profile is complete
    if (!userData.profileComplete) {
      router.push("/profile?from=/create")
      return
    }

    setUser(userData)

    // Generate receipt number
    if (userData.storeName) {
      // Get receipt count for current year
      const receiptsJSON = localStorage.getItem("receipts")
      const receipts = receiptsJSON ? JSON.parse(receiptsJSON) : []
      const currentYear = new Date().getFullYear()

      // Filter receipts for current user and year
      const userReceipts = receipts.filter(
        (receipt: any) => receipt.userId === userData.id && new Date(receipt.createdAt).getFullYear() === currentYear,
      )

      const count = userReceipts.length + 1
      setReceiptCount(count)

      // Generate receipt number format: XYZ-001
      const firstLetterStore = userData.storeName.charAt(0).toUpperCase()
      const firstLetterUser = userData.name.charAt(0).toUpperCase()
      const lastLetterStore = userData.storeName.charAt(userData.storeName.length - 1).toUpperCase()
      const countFormatted = count.toString().padStart(3, "0")

      const receiptNumber = `${firstLetterStore}${firstLetterUser}${lastLetterStore}-${countFormatted}`
      setGeneratedReceiptNumber(receiptNumber)

      // Update receipt data with generated number and current date
      setReceiptData({
        ...receiptData,
        receiptNumber: receiptNumber,
        date: localDate,
      })
    }

    // Load transactions and balance from local storage
    const storedTransactions = localStorage.getItem("accountTransactions")
    const storedBalance = localStorage.getItem("accountBalance")

    if (storedTransactions) {
      setTransactions(JSON.parse(storedTransactions))
    }

    if (storedBalance) {
      setBalance(Number.parseFloat(storedBalance))
    }
  }, [])

  const addItem = () => {
    setReceiptData({
      ...receiptData,
      items: [...receiptData.items, { description: "", quantity: 1, price: 0, advanceAmount: 0, dueAmount: 0 }],
    })
  }

  const removeItem = (index: number) => {
    const newItems = [...receiptData.items]
    newItems.splice(index, 1)
    setReceiptData({ ...receiptData, items: newItems })
  }

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...receiptData.items]

    // Handle numeric values properly to avoid NaN
    if (field === "quantity") {
      // Ensure quantity is a valid number or default to 1
      const numValue = typeof value === "string" ? Number.parseInt(value) : value
      newItems[index] = {
        ...newItems[index],
        [field]: isNaN(numValue) ? 1 : numValue,
      }
    } else if (field === "price") {
      // Ensure price is a valid number or default to 0
      const numValue = typeof value === "string" ? Number.parseFloat(value) : value
      newItems[index] = {
        ...newItems[index],
        [field]: isNaN(numValue) ? 0 : numValue,
      }
    } else if (field === "advanceAmount") {
      // For advance amount, allow empty or numeric values
      const numValue = typeof value === "string" ? Number.parseFloat(value) : value
      newItems[index] = {
        ...newItems[index],
        [field]: isNaN(numValue) ? "" : numValue,
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value }
    }

    setReceiptData({ ...receiptData, items: newItems })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setReceiptData({ ...receiptData, [name]: value })
  }

  const handlePhoneChange = (value: string, countryCode: string) => {
    setReceiptData({
      ...receiptData,
      customerContact: value,
      customerCountryCode: countryCode,
    })

    if (value.length !== 10) {
      setCustomerContactError("Contact number must be exactly 10 digits")
    } else {
      setCustomerContactError("")
    }
  }

  const handlePaymentPhoneChange = (value: string, countryCode: string) => {
    setPhoneNumber(value)
    setPhoneCountryCode(countryCode)
  }

  const handleSelectChange = (value: string) => {
    setReceiptData({ ...receiptData, paymentType: value })
    // Reset payment-specific fields when changing payment type
    setCardNumber("")
    setPhoneNumber("")
  }

  const calculateTotal = () => {
    try {
      if (receiptData.paymentStatus === "full") {
        return receiptData.items.reduce((total, item) => {
          const quantity = Number(item.quantity) || 0
          const price = Number(item.price) || 0
          return total + quantity * price
        }, 0)
      } else if (receiptData.paymentStatus === "advance") {
        return receiptData.items.reduce((total, item) => {
          const advanceAmount = Number(item.advanceAmount) || 0
          return total + advanceAmount
        }, 0)
      } else if (receiptData.paymentStatus === "due") {
        return receiptData.items.reduce((total, item) => {
          const quantity = Number(item.quantity) || 0
          const price = Number(item.price) || 0
          const dueAmount = Number(item.dueAmount) || 0
          return total + (quantity * price - dueAmount)
        }, 0)
      }
      return 0
    } catch (error) {
      console.error("Error calculating total:", error)
      return 0
    }
  }

  const calculateDueTotal = () => {
    try {
      if (receiptData.paymentStatus === "advance") {
        return receiptData.items.reduce((total, item) => {
          const quantity = Number(item.quantity) || 0
          const price = Number(item.price) || 0
          const advanceAmount = Number(item.advanceAmount) || 0
          return total + (quantity * price - advanceAmount)
        }, 0)
      } else if (receiptData.paymentStatus === "due") {
        return receiptData.items.reduce((total, item) => {
          const dueAmount = Number(item.dueAmount) || 0
          return total + dueAmount
        }, 0)
      }
      return 0
    } catch (error) {
      console.error("Error calculating due total:", error)
      return 0
    }
  }

  const formatCardNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "")

    // Format in groups of 4
    let formatted = ""
    for (let i = 0; i < digits.length && i < 16; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += " "
      }
      formatted += digits[i]
    }

    return formatted
  }

  const validateCardNumber = (value: string) => {
    return value.replace(/\s/g, "").length === 16
  }

  const validatePhoneNumber = (value: string) => {
    return /^\d{10}$/.test(value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate customer contact
    if (receiptData.customerContact.length !== 10) {
      alert("Please enter a valid 10-digit customer contact number")
      return
    }

    // Validate payment details
    // if (receiptData.paymentType === "card" && !validateCardNumber(cardNumber)) {
    //   alert("Please enter a valid 16-digit card number")
    //   return
    // }

    if (receiptData.paymentType === "online" && !validatePhoneNumber(phoneNumber)) {
      alert("Please enter a valid 10-digit phone number")
      return
    }

    // Validate advance or due amounts
    if (receiptData.paymentStatus === "advance") {
      for (const item of receiptData.items) {
        if (!item.advanceAmount && item.advanceAmount !== 0) {
          alert("Please enter advance amount for all items")
          return
        }
        if (item.advanceAmount > item.quantity * item.price) {
          alert("Advance amount cannot be greater than total item price")
          return
        }
      }
    } else if (receiptData.paymentStatus === "due") {
      for (const item of receiptData.items) {
        if (!item.dueAmount && item.dueAmount !== 0) {
          alert("Please enter amount already paid for all items")
          return
        }
        if (item.dueAmount > item.quantity * item.price) {
          alert("Due amount cannot be greater than total item price")
          return
        }
      }
    }

    // Prepare payment details
    let paymentDetails = {}
    if (receiptData.paymentType === "card") {
      paymentDetails = { cardNumber: cardNumber.replace(/\s/g, "") }
    } else if (receiptData.paymentType === "online") {
      paymentDetails = { phoneNumber, phoneCountryCode }
    }

    // Set default notes if empty
    const notes = receiptData.notes.trim() || "Shop again"

    // Store receipt data
    const receiptDataToSave = {
      ...receiptData,
      notes,
      total: calculateTotal(),
      dueTotal: calculateDueTotal(),
      createdAt: new Date().toISOString(),
      userId: user?.id,
      paymentDetails,
      storeInfo: {
        name: user?.storeName || "",
        address: user?.storeAddress || "",
        contact: user?.storeContact || "",
        countryCode: user?.storeCountryCode || "+91",
      },
    }

    localStorage.setItem("receiptData", JSON.stringify(receiptDataToSave))

    // Save receipt to history
    const receiptsJSON = localStorage.getItem("receipts")
    const receipts = receiptsJSON ? JSON.parse(receiptsJSON) : []
    receipts.push(receiptDataToSave)
    localStorage.setItem("receipts", JSON.stringify(receipts))

    // Calculate the amount being paid now based on payment status
    let paidAmount = 0
    if (receiptData.paymentStatus === "full") {
      // For full payment, add the total price to the balance
      paidAmount = receiptData.items.reduce((total, item) => {
        const quantity = Number(item.quantity) || 0
        const price = Number(item.price) || 0
        return total + quantity * price
      }, 0)
    } else if (receiptData.paymentStatus === "advance") {
      // For advance payment, add only the advance amount to the balance
      paidAmount = receiptData.items.reduce((total, item) => {
        const advanceAmount = Number(item.advanceAmount) || 0
        return total + advanceAmount
      }, 0)
    } else if (receiptData.paymentStatus === "due") {
      // For due payment, don't add anything to the balance
      paidAmount = 0
    }

    // Only add transaction and update balance if there's a payment
    if (paidAmount > 0) {
      // Get the latest transactions and balance from localStorage
      const storedTransactions = localStorage.getItem("accountTransactions")
      const storedBalance = localStorage.getItem("accountBalance")

      const currentTransactions = storedTransactions ? JSON.parse(storedTransactions) : []
      const currentBalance = storedBalance ? Number.parseFloat(storedBalance) : 0

      // Add new transaction for the payment received
      const newTransaction = {
        id: Date.now().toString(),
        particulars: `Payment received from ${receiptData.customerName} for ${receiptData.items.map((item) => item.description).join(", ")}`,
        amount: paidAmount,
        type: "credit",
        date: new Date().toISOString(),
      }

      const updatedTransactions = [...currentTransactions, newTransaction]
      const updatedBalance = currentBalance + paidAmount

      // Save updated transactions and balance
      localStorage.setItem("accountTransactions", JSON.stringify(updatedTransactions))
      localStorage.setItem("accountBalance", updatedBalance.toString())
    }

    // If there are due amounts, save to due records
    if ((receiptData.paymentStatus === "advance" || receiptData.paymentStatus === "due") && calculateDueTotal() > 0) {
      const dueRecordsJSON = localStorage.getItem("dueRecords")
      const dueRecords = dueRecordsJSON ? JSON.parse(dueRecordsJSON) : []

      // Create a due record
      const dueRecord = {
        id: Date.now().toString(),
        customerName: receiptData.customerName,
        customerContact: receiptData.customerContact,
        customerCountryCode: receiptData.customerCountryCode,
        productOrdered: receiptData.items.map((item) => item.description).join(", "),
        quantity: receiptData.items.reduce((total, item) => total + item.quantity, 0),
        amountDue: calculateDueTotal(),
        expectedPaymentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Default to 7 days from now
        createdAt: new Date().toISOString(),
        isPaid: false,
        receiptNumber: receiptData.receiptNumber,
      }

      dueRecords.push(dueRecord)
      localStorage.setItem("dueRecords", JSON.stringify(dueRecords))

      // Update total due balance
      const totalDueBalance = dueRecords.reduce((total, record) => {
        if (!record.isPaid) {
          return total + record.amountDue
        }
        return total
      }, 0)

      localStorage.setItem("totalDueBalance", totalDueBalance.toString())
    }

    router.push("/preview")
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-start mb-6">
        <Link href="/">
          <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Create Receipt</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="receiptNumber">Receipt Number</Label>
                <Input
                  id="receiptNumber"
                  name="receiptNumber"
                  value={receiptData.receiptNumber}
                  readOnly
                  className="bg-gray-50 backdrop-blur-sm bg-opacity-50 border border-gray-200 shadow-sm"
                />
                <p className="text-xs text-gray-500">Auto-generated based on your store name</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={receiptData.date}
                  onChange={handleChange}
                  required
                  className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                />
              </div>
              {receiptData.paymentStatus !== "due" && (
                <div className="space-y-2">
                  <Label htmlFor="paymentType">Payment Type</Label>
                  <Select value={receiptData.paymentType} onValueChange={handleSelectChange} required>
                    <SelectTrigger
                      id="paymentType"
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    >
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="paymentStatus">Payment Status</Label>
                <Select
                  value={receiptData.paymentStatus || "full"}
                  onValueChange={(value) => {
                    setReceiptData({ ...receiptData, paymentStatus: value })
                  }}
                  required
                >
                  <SelectTrigger
                    id="paymentStatus"
                    className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                  >
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Payment</SelectItem>
                    <SelectItem value="advance">Advance Payment</SelectItem>
                    <SelectItem value="due">Due Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* {receiptData.paymentType === "card" && (
              <div className="space-y-2 mt-4">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="XXXX XXXX XXXX XXXX"
                  maxLength={19}
                  required
                  className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                />
                <p className="text-xs text-gray-500">Enter the 16-digit card number</p>
                {cardNumber && !validateCardNumber(cardNumber) && (
                  <p className="text-xs text-red-500">Card number must be exactly 16 digits</p>
                )}
              </div>
            )} */}

            {receiptData.paymentType === "online" && (
              <div className="space-y-2 mt-4">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <PhoneInput
                  value={phoneNumber}
                  countryCode={phoneCountryCode}
                  onChange={handlePaymentPhoneChange}
                  placeholder="Enter phone number"
                />
                {phoneNumber && !validatePhoneNumber(phoneNumber) && (
                  <p className="text-xs text-red-500">Phone number must be exactly 10 digits</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                name="customerName"
                value={receiptData.customerName}
                onChange={handleChange}
                placeholder="Enter customer name"
                required
                className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerContact">Customer Contact</Label>
              <PhoneInput
                value={receiptData.customerContact}
                countryCode={receiptData.customerCountryCode}
                onChange={handlePhoneChange}
                placeholder="Enter customer phone number"
              />
              {customerContactError && <p className="text-xs text-red-500">{customerContactError}</p>}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>

              {receiptData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-6 space-y-2">
                    <Label htmlFor={`item-${index}-description`}>Description</Label>
                    <Input
                      id={`item-${index}-description`}
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder="Item description"
                      required
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor={`item-${index}-quantity`}>Quantity</Label>
                    <Input
                      id={`item-${index}-quantity`}
                      type="number"
                      min="1"
                      value={item.quantity.toString()}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <Label htmlFor={`item-${index}-price`}>Rate</Label>
                    <Input
                      id={`item-${index}-price`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.price.toString()}
                      onChange={(e) => updateItem(index, "price", e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                    />
                  </div>

                  {receiptData.paymentStatus === "advance" && (
                    <div className="md:col-span-6 md:col-start-7 space-y-2">
                      <Label htmlFor={`item-${index}-advance`}>Advance Amount</Label>
                      <Input
                        id={`item-${index}-advance`}
                        type="number"
                        min="0"
                        max={item.quantity * item.price}
                        step="0.1"
                        value={item.advanceAmount?.toString() || ""}
                        onChange={(e) => updateItem(index, "advanceAmount", e.target.value)}
                        required
                        className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                      />
                      <p className="text-xs text-gray-500">
                        Due: ₹{(item.quantity * item.price - (item.advanceAmount || 0)).toFixed(2)}
                      </p>
                    </div>
                  )}

                  {receiptData.paymentStatus === "due" && (
                    <div className="md:col-span-6 md:col-start-7 space-y-2">
                      <Label htmlFor={`item-${index}-due`}>Amount Already Paid</Label>
                      <Input
                        id={`item-${index}-due`}
                        type="number"
                        min="0"
                        max={item.quantity * item.price}
                        step="0.1"
                        value={(item.quantity * item.price - (item.dueAmount || 0)).toString()}
                        onChange={(e) => {
                          const paidAmount = Number.parseFloat(e.target.value) || 0
                          const totalAmount = item.quantity * item.price
                          const dueAmount = Math.max(0, totalAmount - paidAmount)
                          updateItem(index, "dueAmount", dueAmount)
                        }}
                        required
                        className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
                      />
                      <p className="text-xs text-gray-500">Due Amount: ₹{(item.dueAmount || 0).toFixed(2)}</p>
                    </div>
                  )}

                  <div className="md:col-span-1 flex justify-end">
                    {receiptData.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="text-xl font-bold">₹{calculateTotal().toFixed(2)}</div>
                  {(receiptData.paymentStatus === "advance" || receiptData.paymentStatus === "due") && (
                    <div className="text-sm text-red-500 mt-1">Due: ₹{calculateDueTotal().toFixed(2)}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={receiptData.notes}
                onChange={handleChange}
                placeholder="Additional notes or information (defaults to 'Shop again' if empty)"
                rows={3}
                className="backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="lg">
                Generate Receipt
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
