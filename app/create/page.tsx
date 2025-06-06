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

const ReceiptItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: z.number().min(0.01, "Price must be at least ₹0.01"),
  advanceAmount: z.number().min(0).optional(),
  dueAmount: z.number().min(0).optional(),
});

const PaymentDetailsSchema = z.object({
  phoneNumber: z.string().optional(),
  phoneCountryCode: z.string().optional(),
});

const ReceiptSchema = z.object({
  receiptNumber: z.string().min(1, "Receipt number is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  customerName: z.string().min(1, "Customer name is required"),
  customerContact: z.string().min(10, "Contact must be at least 10 digits"),
  customerCountryCode: z.string().optional(),
  paymentType: z.enum(["cash", "online"]),
  paymentStatus: z.enum(["full", "advance", "due"]),
  notes: z.string().optional(),
  total: z.number().min(0),
  dueTotal: z.number().min(0),
  items: z.array(ReceiptItemSchema).min(1, "At least one item is required"),
  paymentDetails: PaymentDetailsSchema.optional(),
  gstPercentage: z.number().min(0).max(28).nullable().optional(),
  gstAmount: z.number().min(0).optional(),
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
    paymentType: "cash" as "cash" | "online",
    paymentStatus: "full" as "full" | "advance" | "due",
    notes: "",
    items: [{ description: "", quantity: NaN, price: NaN }] as ReceiptItem[],
    total: 0,
    dueTotal: 0,
    gstPercentage: null as number | null,
    gstAmount: 0,
  });

  const [paymentDetails, setPaymentDetails] = useState<{
    phoneNumber?: string;
    phoneCountryCode?: string;
  }>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const initialize = async () => {
      const userJSON = localStorage.getItem("currentUser");
      if (!userJSON) {
        router.push("/login");
        return;
      }

      const userData = JSON.parse(userJSON);

      try {
        const profileRes = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${userData.token}` },
        });
        if (!profileRes.ok) throw new Error("Failed to fetch profile");
        const profile = await profileRes.json();

        if (!profile.isProfileComplete) {
          router.push("/profile?from=/create");
          return;
        }

        const receiptRes = await fetch("/api/receipts/next-number", {
          headers: { Authorization: `Bearer ${userData.token}` },
        });
        if (!receiptRes.ok) throw new Error("Failed to generate receipt number");
        const { receiptNumber } = await receiptRes.json();

        setReceiptData((prev) => ({ ...prev, receiptNumber }));
        setUser(profile);
      } catch (error) {
        console.error("Initialization error:", error);
        setErrors({ form: error.message || "Initialization failed" });
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
      const timestamp = Date.now().toString().slice(-4);
      setReceiptData((prev) => ({
        ...prev,
        receiptNumber: `REC-${timestamp}`,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const subtotal = receiptData.items.reduce(
      (sum, item) => sum + (isNaN(item.quantity) ? 0 : item.quantity) * (isNaN(item.price) ? 0 : item.price),
      0
    );
    
    const gstAmount = receiptData.gstPercentage 
      ? (subtotal * receiptData.gstPercentage) / 100 
      : 0;

    const total = subtotal + gstAmount;
    let dueTotal = 0;

    if (receiptData.paymentStatus === "advance") {
      dueTotal =
        total -
        receiptData.items.reduce(
          (sum, item) => sum + (isNaN(item.advanceAmount) ? 0 : (item.advanceAmount || 0)),
          0
        );
    } else if (receiptData.paymentStatus === "due") {
      dueTotal = receiptData.items.reduce(
        (sum, item) => sum + (isNaN(item.dueAmount) ? 0 : (item.dueAmount || 0)),
        0
      );
    }

    setReceiptData((prev) => ({ ...prev, total, gstAmount, dueTotal }));
  }, [receiptData.items, receiptData.paymentStatus, receiptData.gstPercentage]);

  const addItem = () => {
    setReceiptData((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: NaN, price: NaN }],
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
      const parsedValue =
        typeof value === "string"
          ? field === "description"
            ? value
            : field === "quantity"
            ? value === ""
              ? NaN
              : Math.max(parseInt(value) || NaN, 1)
            : value === ""
            ? NaN
            : parseFloat(value) || NaN
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userJSON = localStorage.getItem("currentUser");
    if (!userJSON) {
      router.push("/login");
      return;
    }
    const user = JSON.parse(userJSON);

    if (!user?.token) {
      setErrors({ form: "Session expired. Please login again." });
      return;
    }

    if (!user) {
      router.push("/login");
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
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

      if (
        receiptData.paymentType === "online" &&
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

      const requestBody = {
        receiptNumber: receiptData.receiptNumber,
        date: receiptData.date,
        customerName: receiptData.customerName,
        customerContact: receiptData.customerContact,
        customerCountryCode: receiptData.customerCountryCode,
        paymentType: receiptData.paymentStatus === "due" ? "cash" : receiptData.paymentType,
        paymentStatus: receiptData.paymentStatus,
        notes: receiptData.notes || undefined,
        total: receiptData.total,
        dueTotal: receiptData.dueTotal,
        items: receiptData.items,
        paymentDetails:
          Object.keys(paymentDetails).length > 0 ? paymentDetails : undefined,
        gstPercentage: receiptData.gstPercentage || undefined,
        gstAmount: receiptData.gstAmount || undefined,
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
        <Link href="/accounts">
          <Button
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
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
                <Label htmlFor="gstPercentage">GST Percentage</Label>
                <Select
  value={receiptData.gstPercentage ? receiptData.gstPercentage.toString() : "none"}
  onValueChange={(value) => {
    const percentage = value === "none" ? null : parseInt(value);
    setReceiptData(prev => ({
      ...prev,
      gstPercentage: percentage,
      gstAmount: percentage ? (prev.total * percentage) / 100 : 0
    }));
  }}
>
  <SelectTrigger id="gstPercentage">
    <SelectValue placeholder="No GST" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="none">No GST</SelectItem>
    <SelectItem value="5">5%</SelectItem>
    <SelectItem value="12">12%</SelectItem>
    <SelectItem value="18">18%</SelectItem>
    <SelectItem value="28">28%</SelectItem>
  </SelectContent>
</Select>
              </div>

              {receiptData.paymentStatus !== "due" && (
                <div className="space-y-2">
                  <Label htmlFor="paymentType">Payment Type</Label>
                  <Select
                    value={receiptData.paymentType}
                    onValueChange={(value) =>
                      setReceiptData((prev) => ({
                        ...prev,
                        paymentType: value as "cash" | "online",
                      }))
                    }
                    required
                  >
                    <SelectTrigger id="paymentType">
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
                    value={receiptData.paymentStatus}
                    onValueChange={(value) =>
                      setReceiptData((prev) => ({
                        ...prev,
                        paymentStatus: value as "full" | "advance" | "due",
                        paymentType: value === "due" ? "cash" : prev.paymentType,
                      }))
                    }
                    required
                  >
                    <SelectTrigger id="paymentStatus">
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

            {receiptData.paymentType === "online" && receiptData.paymentStatus !== "due" && (
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
                      value={isNaN(item.quantity) ? "" : item.quantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        updateItem(index, "quantity", isNaN(value) ? NaN : Math.max(value, 1));
                      }}
                      required
                      onKeyDown={(e) => {
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
                      value={isNaN(item.price) ? "" : item.price}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        updateItem(index, "price", isNaN(value) ? NaN : Math.max(value, 0));
                      }}
                      required
                      onKeyDown={(e) => {
                        if (e.key === "-") e.preventDefault();
                      }}
                    />
                    {errors[`items.${index}.price`] && (
                      <p className="text-xs text-red-500">
                        {errors[`items.${index}.price`]}
                      </p>
                    )}
                  </div>

                  {receiptData.paymentStatus === "advance" && (
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
                {receiptData.gstPercentage && (
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Subtotal</div>
                    <div className="text-lg">
                      ₹{(receiptData.total - receiptData.gstAmount).toFixed(2)}
                    </div>
                  </div>
                )}
                
                {receiptData.gstPercentage && (
                  <div className="text-right">
                    <div className="text-sm text-gray-500">GST ({receiptData.gstPercentage}%)</div>
                    <div className="text-lg">
                      ₹{receiptData.gstAmount.toFixed(2)}
                    </div>
                  </div>
                )}

                <div className="text-right">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="text-xl font-bold">
                    ₹{receiptData.total.toFixed(2)}
                  </div>
                </div>

                {(receiptData.paymentStatus === "advance" ||
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