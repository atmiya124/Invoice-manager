export type BillingCycle = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";
export type BillingType = "HOURLY" | "FIXED";
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE";

export interface Client {
  id: string;
  userId: string;
  name: string;
  companyName: string | null;
  email: string;
  billingAddress: string | null;
  hourlyRate: number | null;
  fixedRate: number | null;
  billingCycle: BillingCycle;
  paymentTerms: string;
  currency: string;
  defaultNotes: string | null;
  emailTemplate: string | null;
  paymentInstructions: string | null;
  isArchived: boolean;
  invoiceStartNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientWithStats {
  id: string;
  userId: string;
  name: string;
  companyName: string | null;
  email: string;
  billingAddress: string | null;
  hourlyRate: number | null;
  fixedRate: number | null;
  billingCycle: BillingCycle;
  paymentTerms: string;
  currency: string;
  defaultNotes: string | null;
  emailTemplate: string | null;
  paymentInstructions: string | null;
  isArchived: boolean;
  invoiceStartNumber?: number;
  createdAt: string;
  updatedAt: string;
  // computed
  unpaidBalance: number;
  totalInvoices: number;
  lastInvoiceDate: string | null;
}

export interface InvoiceWithClient {
  id: string;
  userId: string;
  clientId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  billingType: BillingType;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  hoursWorked: number | null;
  hourlyRate: number | null;
  fixedAmount: number | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  taskSummary: string | null;
  notes: string | null;
  paymentInstructions: string | null;
  privateNotes: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    companyName: string | null;
    email: string;
    billingAddress: string | null;
    currency: string;
  };
}

export interface UserSettings {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  businessName: string | null;
  businessEmail: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  logoUrl: string | null;
  invoicePrefix: string;
  defaultPaymentTerms: string;
  defaultTaxRate: number;
  defaultCurrency: string;
  paymentInstructions: string | null;
  defaultEmailSubject: string;
  defaultEmailBody: string;
}

export interface DashboardStats {
  totalUnpaid: number;
  paidThisMonth: number;
  sentThisMonth: number;
  overdueCount: number;
  overdueAmount: number;
  recentInvoices: InvoiceWithClient[];
  clientsDue: ClientWithStats[];
  monthlyEarnings: { month: string; paid: number; pending: number }[];
  earningsByClient: { name: string; total: number }[];
}

export interface ReportData {
  monthlyIncome: { month: string; amount: number }[];
  clientIncome: { clientName: string; companyName: string | null; amount: number }[];
  unpaidInvoices: InvoiceWithClient[];
  summary: {
    totalPaid: number;
    totalUnpaid: number;
    totalOverdue: number;
    totalDraft: number;
  };
}
