export interface Account {
  id: string;
  name: string;
}

export interface ExpenseGroup {
  id: string;
  accountId: string;
  description: string;
  date: string;
  paymentMethod: string;
  labels: string[];
  paidUsers?: string[]; // array of split names marked as paid
  lat?: number;         // geo-tag coordinates for location suggestions
  lng?: number;
  receiptImage?: string; // base64 encoded receipt image
}

export interface ExpenseItem {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  category: string;
  splitUser?: string;   // KKB assignee name (e.g. "Alice", "Bob")
}

export interface Category {
  id: string;
  accountId: string;
  name: string;
  icon: string;
  bgColor: string;
  textColor: string;
}

export interface Label {
  id: string;
  accountId: string;
  name: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
}

export interface KkbQr {
  id: string;
  name: string;
  base64: string;
}
