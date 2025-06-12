"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";

interface ReceiptItem {
  description: string;
  quantity: number;
  price: number;
  advanceAmount?: number;
  dueAmount?: number;
}

interface ReceiptData {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerContact: string;
  paymentType: string;
  paymentStatus: string;
  notes: string;
  items: ReceiptItem[];
  total: number;
  dueTotal?: number;
  createdAt: string;
  paymentDetails?: {
    phoneNumber?: string;
  };
  storeInfo?: {
    name: string;
    address: string;
    contact: string;
    countryCode?: string;
    gstNumber?: string;
  };
  totalTax: number;
}

export default function ReceiptPreview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);

  const fromView = searchParams.get('from') === 'view';

  useEffect(() => {
    const fetchReceipt = async () => {
      const receiptId = window.location.pathname.split("/").pop();

      if (receiptId) {
        try {
          const response = await fetch(`/api/receipts/${receiptId}`);
          if (!response.ok) throw new Error("Receipt not found");
          const data = await response.json();
          console.log("receiptData.createdAt type:", typeof data.createdAt);
          console.log("receiptData.createdAt value:", data.createdAt);
          setReceiptData(data);
        } catch (err) {
          router.push("/create");
        }
      } else {
        router.push("/create");
      }
      setLoading(false);
    };

    fetchReceipt();
  }, [router]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const receiptHtml = document.getElementById("receipt-content")?.innerHTML;
    if (!receiptHtml) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${receiptData?.receiptNumber}</title>
          <style>
            @page { size: A4; margin: 1cm; }
            body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { font-weight: bold; }
            .receipt-header { text-align: center; margin-bottom: 20px; }
            .receipt-info { margin-bottom: 20px; }
            .receipt-total { font-weight: bold; text-align: right; margin-top: 20px; }
            .receipt-notes { margin-top: 30px; font-style: italic; }
            @media print {
              body { width: 100%; }
              table { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${receiptHtml}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const ensureNumber = (value: any): number => {
    if (value === undefined || value === null) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      return date.toLocaleDateString();
    } catch (error) {
      return "Invalid Date";
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    return dateString; // Return the exact database timestamp
  };

  const calculateSubtotal = () => {
    if (!receiptData) return 0;
    return receiptData.items.reduce((total, item) => {
      return total + ensureNumber(item.quantity) * ensureNumber(item.price);
    }, 0);
  };

  const calculateTotalGST = () => {
    if (!receiptData) return 0;
    return ensureNumber(receiptData.totalTax);
  };

  const calculateTotalAmount = () => {
    return calculateSubtotal() + calculateTotalGST();
  };

  const calculateTotalAdvanceAmount = () => {
    if (!receiptData) return 0;
    return receiptData.items.reduce((total, item) => {
      return total + ensureNumber(item.advanceAmount);
    }, 0);
  };

  const calculateAverageGSTRate = () => {
    if (!receiptData || calculateSubtotal() === 0) return 0;
    const subtotal = calculateSubtotal();
    const totalTax = calculateTotalGST();
    return ensureNumber((totalTax / subtotal) * 100);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!receiptData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p>No receipt data found. Please create a new receipt.</p>
        <Link href="/create">
          <Button className="mt-4">Create Receipt</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        {fromView ? (
          <Link href="/viewreceipts">
            <Button
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to View
            </Button>
          </Link>
        ) : (
          <Link href="/create">
            <Button
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Form
            </Button>
          </Link>
        )}
        <div className="space-x-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </div>
      </div>

      <Card
        className="p-8 shadow-lg print:shadow-none print:p-4 print:border-none"
        id="receipt-content"
      >
        <div className="receipt-header text-center mb-8">
          {receiptData.storeInfo?.name && (
            <h1 className="text-2xl font-bold mb-1 print:text-xl">
              {receiptData.storeInfo.name}
            </h1>
          )}
          {receiptData.storeInfo?.address && (
            <p className="text-gray-600 text-sm mb-1">
              {receiptData.storeInfo.address}
            </p>
          )}
          {receiptData.storeInfo?.gstNumber && (
            <p className="text-gray-600 text-sm mb-1">
              GST NUMBER: {receiptData.storeInfo.gstNumber}
            </p>
          )}
          {receiptData.storeInfo?.contact && (
            <p className="text-gray-600 text-sm mb-3">
              Contact: {receiptData.storeInfo.countryCode || "+91"}{" "}
              {receiptData.storeInfo.contact}
            </p>
          )}
          <h2 className="text-xl font-bold mt-4 print:text-lg">RECEIPT</h2>
          <p className="text-gray-500">#{receiptData.receiptNumber}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8 print:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold mb-2">Receipt Details</h2>
            <div className="space-y-1">
              <div>
                <span className="font-medium">Date: </span>
                {formatDate(receiptData.date)}
              </div>
              {(receiptData.paymentStatus === "full" ||
                receiptData.paymentStatus === "advance") && (
                <div>
                  <span className="font-medium">Payment Method: </span>
                  {receiptData.paymentType === "mobile"
                    ? "Online"
                    : receiptData.paymentType.charAt(0).toUpperCase() +
                      receiptData.paymentType.slice(1)}
                </div>
              )}
              <div>
                <span className="font-medium">Payment Status: </span>
                {receiptData.paymentStatus === "full"
                  ? "Full Payment"
                  : receiptData.paymentStatus === "advance"
                  ? "Advance Payment"
                  : receiptData.paymentStatus === "due" && receiptData.dueTotal === 0
                  ? (
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-xs ml-1">Due Paid</span>
                    )
                  : "Due Payment"}
              </div>
              {receiptData.paymentDetails?.phoneNumber &&
                receiptData.paymentStatus !== "due" && (
                <div>
                  <span className="font-medium">Phone Number: </span>
                  XXXXXXX{receiptData.paymentDetails.phoneNumber.slice(-3)}
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Customer Details</h2>
            <div className="space-y-1">
              <div>
                <span className="font-medium">Name: </span>
                {receiptData.customerName}
              </div>
              {receiptData.customerContact && (
                <div>
                  <span className="font-medium">Contact: </span>
                  {receiptData.customerContact}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8 overflow-x-auto print:overflow-visible">
          <h2 className="text-lg font-semibold mb-4 print:text-base">Items</h2>
          <table className="w-full print:text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">Amount</th>
                {receiptData.paymentStatus === "advance" && (
                  <>
                    <th className="text-right py-2">Advance</th>
                    <th className="text-right py-2">Balance Due</th>
                  </>
                )}
                {receiptData.paymentStatus === "due" && (
                  <>
                    <th className="text-right py-2">Paid Already</th>
                    <th className="text-right py-2">Balance Due</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {receiptData.items.map((item, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2 max-w-[150px] md:max-w-none">
                    {item.description}
                  </td>
                  <td className="text-right py-2">{item.quantity}</td>
                  <td className="text-right py-2">
                    ₹{ensureNumber(item.price).toFixed(2)}
                  </td>
                  <td className="text-right py-2">
                    ₹{ensureNumber(item.quantity * item.price).toFixed(2)}
                  </td>
                  {receiptData.paymentStatus === "advance" && (
                    <>
                      <td className="text-right py-2">
                        ₹{ensureNumber(item.advanceAmount).toFixed(2)}
                      </td>
                      <td className="text-right py-2 font-medium">
                        ₹
                        {(
                          ensureNumber(item.quantity * item.price) -
                          ensureNumber(item.advanceAmount)
                        ).toFixed(2)}
                      </td>
                    </>
                  )}
                  {receiptData.paymentStatus === "due" && (
                    <>
                      <td className="text-right py-2">
                        ₹
                        {(
                          ensureNumber(item.quantity * item.price) -
                          ensureNumber(item.dueAmount)
                        ).toFixed(2)}
                      </td>
                      <td className="text-right py-2 font-medium">
                        ₹{ensureNumber(item.dueAmount).toFixed(2)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 text-right space-y-1">
            <div className="text-base">
              Subtotal: ₹{calculateSubtotal().toFixed(2)}
            </div>
            <div className="text-base">
              GST @ {calculateAverageGSTRate().toFixed(2)}%: ₹{calculateTotalGST().toFixed(2)}
            </div>
            
            {receiptData.paymentStatus === "full" && (
              <div className="text-lg font-bold print:text-base mt-2">
                Total: ₹{calculateSubtotal() + calculateTotalGST()}
              </div>
            )}

            {receiptData.paymentStatus === "advance" && (
              <>
                <div className="text-lg font-bold print:text-base mt-2">
                  Total Amount: ₹{calculateSubtotal() + calculateTotalGST()}
                </div>
                <div className="text-base">
                  Advance Paid: ₹{calculateTotalAdvanceAmount().toFixed(2)}
                </div>
                <div className="text-base font-bold text-red-500 mt-1 print:text-black">
                  Balance Due: ₹{(calculateSubtotal() + calculateTotalGST() - calculateTotalAdvanceAmount()).toFixed(2)}
                </div>
              </>
            )}

            {receiptData.paymentStatus === "due" && (
              <>
                <div className="text-lg font-bold print:text-base mt-2">
                  Total Amount: ₹{calculateSubtotal() + calculateTotalGST()}
                </div>
                <div className="text-base">
                  Already Paid: ₹
                  {(
                    (calculateSubtotal() + calculateTotalGST()) -
                    ensureNumber(receiptData.dueTotal)
                  ).toFixed(2)}
                </div>
                <div className="text-base font-bold text-red-500 mt-1 print:text-black">
                  Balance Due: ₹{ensureNumber(receiptData.dueTotal).toFixed(2)}
                </div>
              </>
            )}
          </div>
        </div>

        {receiptData.notes && (
          <div className="mt-8 border-t pt-4">
            <h2 className="text-lg font-semibold mb-2">Notes</h2>
            <p className="text-gray-700">{receiptData.notes}</p>
          </div>
        )}

        {(receiptData.paymentStatus === "advance" ||
          receiptData.paymentStatus === "due") &&
          receiptData.dueTotal &&
          receiptData.dueTotal > 0 && (
            <div className="mt-4 p-3 border border-red-200 bg-red-50 rounded-md print:border-black print:bg-white">
              <p className="text-red-700 font-medium print:text-black">
                Due Payment Notice
              </p>
              <p className="text-sm text-red-600 print:text-black">
                A balance of ₹{(receiptData.paymentStatus === "advance" 
                  ? (calculateSubtotal() + calculateTotalGST() - calculateTotalAdvanceAmount()).toFixed(2)
                  : ensureNumber(receiptData.dueTotal).toFixed(2))} is
                due for this transaction. Please ensure timely payment to avoid
                any inconvenience.
              </p>
            </div>
          )}

        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Created at: {formatDateTime(receiptData.createdAt)}</p>
          <p>Thank you for your business!</p>
        </div>
      </Card>
    </div>
  );
}