"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PhoneInput } from "@/components/phone-input";
import { format } from "date-fns";
import { z } from "zod";

// Define validation schemas
const ReceiptItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: z.number().min(0.01, "Price must be at least ₹0.01"),
  advanceAmount: z.number().min(0).optional(),
  dueAmount: z.number().min(0).optional(),
});

const PaymentDetailsSchema = z.object({
  cardNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
  phoneCountryCode: z.string().optional(),
});

const ReceiptSchema = z.object({
  receiptNumber: z.string().min(1, "Receipt number is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  customerName: z.string().min(1, "Customer name is required"),
  customerContact: z.string().min(10, "Contact must be at least 10 digits"),
  customerCountryCode: z.string().optional(),
  paymentType: z.enum(["cash", "card", "mobile"]),
  paymentStatus: z.enum(["full", "partial", "due"]),
  notes: z.string().optional(),
  total: z.number().min(0),
  dueTotal: z.number().min(0),
  items: z.array(ReceiptItemSchema).min(1, "At least one item is required"),
  paymentDetails: PaymentDetailsSchema.optional(),
});

interface ReceiptItem {
  description: string;
  quantity: number;
  price: number;
  advanceAmount?: number;
  dueAmount?: number;
}

export default function CreateReceipt() {
  const router = useRouter();
  const [receiptData, setReceiptData] = useState({
    receiptNumber: "",
    date: format(new Date(), "yyyy-MM-dd"),
    customerName: "",
    customerContact: "",
    customerCountryCode: "+91",
    paymentType: "cash" as "cash" | "card" | "mobile",
    paymentStatus: "full" as "full" | "partial" | "due",
    notes: "",
    items: [{ description: "", quantity: 1, price: 0 }] as ReceiptItem[],
    total: 0,
    dueTotal: 0,
  });

  const [paymentDetails, setPaymentDetails] = useState<{
    cardNumber?: string;
    phoneNumber?: string;
    phoneCountryCode?: string;
  }>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Authentication and initialization
  useEffect(() => {
    const initialize = async () => {
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
          router.push("/profile?from=/create");
          return;
        }

        // Generate receipt number
        const receiptRes = await fetch("/api/receipts/next-number", {
          headers: { Authorization: `Bearer ${userData.token}` },
        });
        if (!receiptRes.ok)
          throw new Error("Failed to generate receipt number");
        const { receiptNumber } = await receiptRes.json();

        setReceiptData((prev) => ({ ...prev, receiptNumber }));
        setUser(profile);
      } catch (error) {
        console.error("Initialization error:", error);
        setErrors(error.message || "Initialization failed");
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [router]);

  const generateReceiptNumber = async (token: string) => {
    try {
      const currentYear = new Date().getFullYear();
      const response = await fetch(
        `/api/receipts/last-number?year=${currentYear}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch last receipt number");

      const data = await response.json();
      const count = data.lastNumber + 1;

      const receiptNumber = `REC-${count.toString().padStart(4, "0")}`;
      setReceiptData((prev) => ({ ...prev, receiptNumber }));
    } catch (error) {
      console.error("Error generating receipt number:", error);
      // Fallback to local timestamp
      const timestamp = Date.now().toString().slice(-4);
      setReceiptData((prev) => ({
        ...prev,
        receiptNumber: `REC-${timestamp}`,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate totals whenever items or payment status changes
  useEffect(() => {
    const total = receiptData.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    let dueTotal = 0;

    if (receiptData.paymentStatus === "partial") {
      dueTotal =
        total -
        receiptData.items.reduce(
          (sum, item) => sum + (item.advanceAmount || 0),
          0
        );
    } else if (receiptData.paymentStatus === "due") {
      dueTotal = receiptData.items.reduce(
        (sum, item) => sum + (item.dueAmount || 0),
        0
      );
    }

    setReceiptData((prev) => ({ ...prev, total, dueTotal }));
  }, [receiptData.items, receiptData.paymentStatus]);

  const addItem = () => {
    setReceiptData((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, price: 0 }],
    }));
  };

  const removeItem = (index: number) => {
    if (receiptData.items.length <= 1) return;

    setReceiptData((prev) => {
      const newItems = [...prev.items];
      newItems.splice(index, 1);
      return { ...prev, items: newItems };
    });
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    setReceiptData((prev) => {
      const newItems = [...prev.items];

      // Handle different field types appropriately
      const parsedValue =
        typeof value === "string"
          ? field === "description"
            ? value // Keep description as string
            : field === "quantity"
            ? Math.max(parseInt(value) || 1, 1) // Quantity handling
            : parseFloat(value) || 0 // Price handling
          : value;

      newItems[index] = { ...newItems[index], [field]: parsedValue };
      return { ...prev, items: newItems };
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setReceiptData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (value: string, countryCode: string) => {
    setReceiptData((prev) => ({
      ...prev,
      customerContact: value,
      customerCountryCode: countryCode,
    }));
  };

  const handlePaymentPhoneChange = (value: string, countryCode: string) => {
    setPaymentDetails((prev) => ({
      ...prev,
      phoneNumber: value,
      phoneCountryCode: countryCode,
    }));
  };

  const handleCardNumberChange = (value: string) => {
    const formatted = value
      .replace(/\D/g, "")
      .replace(/(\d{4})(?=\d)/g, "$1 ")
      .trim();
    setPaymentDetails((prev) => ({ ...prev, cardNumber: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userJSON = localStorage.getItem("currentUser");
    if (!userJSON) {
      router.push("/login");
      return;
    }
    const user = JSON.parse(userJSON);

    // Add proper error handling
    if (!user?.token) {
      setErrors({ form: "Session expired. Please login again." });
      return;
    }

    // Additional auth check
    if (!user) {
      router.push("/login");
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Validate form data
      const validation = ReceiptSchema.safeParse({
        ...receiptData,
        paymentDetails:
          Object.keys(paymentDetails).length > 0 ? paymentDetails : undefined,
      });

      if (!validation.success) {
        const validationErrors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          const path = err.path.join(".");
          validationErrors[path] = err.message;
        });
        setErrors(validationErrors);
        return;
      }

      // Additional validation for payment details
      if (
        receiptData.paymentType === "card" &&
        (!paymentDetails.cardNumber ||
          paymentDetails.cardNumber.replace(/\s/g, "").length !== 16)
      ) {
        setErrors((prev) => ({
          ...prev,
          "paymentDetails.cardNumber":
            "Invalid card number (must be 16 digits)",
        }));
        return;
      }

      if (
        receiptData.paymentType === "mobile" &&
        (!paymentDetails.phoneNumber ||
          paymentDetails.phoneNumber.length !== 10)
      ) {
        setErrors((prev) => ({
          ...prev,
          "paymentDetails.phoneNumber":
            "Invalid phone number (must be 10 digits)",
        }));
        return;
      }

      // Prepare the request body
      const requestBody = {
        receiptNumber: receiptData.receiptNumber,
        date: receiptData.date,
        customerName: receiptData.customerName,
        customerContact: receiptData.customerContact,
        customerCountryCode: receiptData.customerCountryCode,
        paymentType: receiptData.paymentType,
        paymentStatus: receiptData.paymentStatus,
        notes: receiptData.notes || undefined,
        total: receiptData.total,
        dueTotal: receiptData.dueTotal,
        items: receiptData.items,
        paymentDetails:
          Object.keys(paymentDetails).length > 0 ? paymentDetails : undefined,
      };

      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create receipt");
      }

      const result = await response.json();
      router.push(`/receipts/${result.receiptId}`);
    } catch (error: any) {
      setErrors((prev) => ({ ...prev, form: error.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-start mb-6">
        <Link href="/">
          <Button
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Create Receipt</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.form && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="receiptNumber">Receipt Number</Label>
                <Input
                  id="receiptNumber"
                  name="receiptNumber"
                  value={receiptData.receiptNumber}
                  readOnly
                  className="bg-gray-50"
                />
                {errors.receiptNumber && (
                  <p className="text-xs text-red-500">{errors.receiptNumber}</p>
                )}
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
                />
                {errors.date && (
                  <p className="text-xs text-red-500">{errors.date}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentType">Payment Type</Label>
                <Select
                  value={receiptData.paymentType}
                  onValueChange={(value) =>
                    setReceiptData((prev) => ({
                      ...prev,
                      paymentType: value as "cash" | "card" | "mobile",
                    }))
                  }
                  required
                >
                  <SelectTrigger id="paymentType">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile">Mobile Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentStatus">Payment Status</Label>
                <Select
                  value={receiptData.paymentStatus}
                  onValueChange={(value) =>
                    setReceiptData((prev) => ({
                      ...prev,
                      paymentStatus: value as "full" | "partial" | "due",
                    }))
                  }
                  required
                >
                  <SelectTrigger id="paymentStatus">
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Payment</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                    <SelectItem value="due">Due Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {receiptData.paymentType === "card" && (
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  value={paymentDetails.cardNumber || ""}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  placeholder="XXXX XXXX XXXX XXXX"
                  maxLength={19}
                />
                {errors["paymentDetails.cardNumber"] && (
                  <p className="text-xs text-red-500">
                    {errors["paymentDetails.cardNumber"]}
                  </p>
                )}
              </div>
            )}

            {receiptData.paymentType === "mobile" && (
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <PhoneInput
                  value={paymentDetails.phoneNumber || ""}
                  countryCode={paymentDetails.phoneCountryCode || "+91"}
                  onChange={handlePaymentPhoneChange}
                  placeholder="Enter phone number"
                />
                {errors["paymentDetails.phoneNumber"] && (
                  <p className="text-xs text-red-500">
                    {errors["paymentDetails.phoneNumber"]}
                  </p>
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
              />
              {errors.customerName && (
                <p className="text-xs text-red-500">{errors.customerName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerContact">Customer Contact</Label>
              <PhoneInput
                value={receiptData.customerContact}
                countryCode={receiptData.customerCountryCode}
                onChange={handlePhoneChange}
                placeholder="Enter customer phone number"
              />
              {errors.customerContact && (
                <p className="text-xs text-red-500">{errors.customerContact}</p>
              )}
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
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
                >
                  <div className="md:col-span-5 space-y-2">
                    <Label htmlFor={`item-${index}-description`}>
                      Description
                    </Label>
                    <Input
                      id={`item-${index}-description`}
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, "description", e.target.value)
                      }
                      placeholder="Item description"
                      required
                    />
                    {errors[`items.${index}.description`] && (
                      <p className="text-xs text-red-500">
                        {errors[`items.${index}.description`]}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor={`item-${index}-quantity`}>Quantity</Label>
                    <Input
                      id={`item-${index}-quantity`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        // Prevent values less than 1
                        updateItem(index, "quantity", Math.max(value || 1, 1));
                      }}
                      required
                      onKeyDown={(e) => {
                        // Prevent negative sign input
                        if (e.key === "-" || e.key === "e") e.preventDefault();
                      }}
                    />
                    {errors[`items.${index}.quantity`] && (
                      <p className="text-xs text-red-500">
                        {errors[`items.${index}.quantity`]}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor={`item-${index}-price`}>Price</Label>
                    <Input
                      id={`item-${index}-price`}
                      type="number"
                      min="0"
                      step="1"
                      value={item.price}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        // Allow decimal values but prevent negative numbers
                        updateItem(index, "price", Math.max(value || 0, 0));
                      }}
                      required
                      onKeyDown={(e) => {
                        // Prevent negative sign input
                        if (e.key === "-") e.preventDefault();
                      }}
                    />
                    {errors[`items.${index}.price`] && (
                      <p className="text-xs text-red-500">
                        {errors[`items.${index}.price`]}
                      </p>
                    )}
                  </div>

                  {receiptData.paymentStatus === "partial" && (
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor={`item-${index}-advance`}>
                        Advance Amount
                      </Label>
                      <Input
                        id={`item-${index}-advance`}
                        type="number"
                        min="0"
                        max={item.quantity * item.price}
                        step="0.01"
                        value={item.advanceAmount || ""}
                        onChange={(e) =>
                          updateItem(index, "advanceAmount", e.target.value)
                        }
                      />
                      {errors[`items.${index}.advanceAmount`] && (
                        <p className="text-xs text-red-500">
                          {errors[`items.${index}.advanceAmount`]}
                        </p>
                      )}
                    </div>
                  )}

                  {receiptData.paymentStatus === "due" && (
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor={`item-${index}-due`}>Due Amount</Label>
                      <Input
                        id={`item-${index}-due`}
                        type="number"
                        min="0"
                        max={item.quantity * item.price}
                        step="0.01"
                        value={item.dueAmount || ""}
                        onChange={(e) =>
                          updateItem(index, "dueAmount", e.target.value)
                        }
                      />
                      {errors[`items.${index}.dueAmount`] && (
                        <p className="text-xs text-red-500">
                          {errors[`items.${index}.dueAmount`]}
                        </p>
                      )}
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

              <div className="flex justify-end gap-4 mt-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="text-xl font-bold">
                    ₹{receiptData.total.toFixed(2)}
                  </div>
                </div>

                {(receiptData.paymentStatus === "partial" ||
                  receiptData.paymentStatus === "due") && (
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Due Amount</div>
                    <div className="text-xl font-bold text-red-500">
                      ₹{receiptData.dueTotal.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={receiptData.notes}
                onChange={handleChange}
                placeholder="Additional notes or information"
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Receipt"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
