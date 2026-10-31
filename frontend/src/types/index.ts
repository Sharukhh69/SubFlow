export enum Role {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

export enum BillingPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum PaymentTerms {
  IMMEDIATE = 'IMMEDIATE',
  NET_15 = 'NET_15',
  NET_30 = 'NET_30',
  NET_60 = 'NET_60',
}

export enum SubscriptionStatus {
  DRAFT = 'DRAFT',
  QUOTATION = 'QUOTATION',
  CONFIRMED = 'CONFIRMED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  UPI = 'UPI',
  CARD = 'CARD',
  CHEQUE = 'CHEQUE',
  OTHER = 'OTHER',
}

export enum DiscountType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

export enum DiscountScope {
  SPECIFIC_PRODUCTS = 'SPECIFIC_PRODUCTS',
  WHOLE_SUBSCRIPTION = 'WHOLE_SUBSCRIPTION',
}

// ==================== MODELS ====================

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  customerProfile?: CustomerProfile | null;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  company?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  user?: {
    name: string;
    email: string;
  };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  company?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  attributeName: string;
  attributeValue: string;
  extraPrice: number;
  isActive: boolean;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  type: string;
  salesPrice: number;
  costPrice: number;
  isActive: boolean;
  defaultTaxId?: string | null;
  defaultTax?: Tax | null;
  variants?: ProductVariant[];
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  minQuantity: number;
  availableFrom?: string | null;
  availableTo?: string | null;
  isActive: boolean;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
}

export interface QuotationTemplateLine {
  id: string;
  templateId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  product?: Product;
  variant?: ProductVariant;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  planId: string;
  validityDays: number;
  isActive: boolean;
  plan?: Plan;
  lines?: QuotationTemplateLine[];
}

export interface SubscriptionLine {
  id: string;
  subscriptionId: string;
  productId: string;
  variantId?: string | null;
  taxId?: string | null;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  product?: Product;
  variant?: ProductVariant;
  tax?: Tax;
}

export interface Subscription {
  id: string;
  number: string;
  customerId: string;
  planId: string;
  startDate: string;
  expiryDate?: string | null;
  paymentTerms: PaymentTerms;
  nextBillingDate?: string | null;
  status: SubscriptionStatus;
  notes?: string | null;
  quoteExpiryDate?: string | null;
  createdAt: string;
  customer?: CustomerProfile;
  plan: Plan;
  lines: SubscriptionLine[];
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  productName: string;
  variantLabel?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  number: string;
  subscriptionId: string;
  customerId: string;
  snapshotCustomerName: string;
  snapshotCustomerEmail: string;
  snapshotCustomerAddress?: string | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  subscription?: {
    number: string;
  };
}

export interface Payment {
  id: string;
  invoiceId: string;
  method: PaymentMethod;
  amount: number;
  paymentDate: string;
  referenceNumber?: string | null;
  note?: string | null;
  createdAt: string;
  invoice?: {
    number: string;
    grandTotal: number;
    amountPaid: number;
    snapshotCustomerName: string;
  };
}

export interface BillingRun {
  id: string;
  triggeredBy: string;
  isDryRun: boolean;
  startedAt: string;
  completedAt?: string | null;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  errors?: any;
}

export interface Discount {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  minPurchaseAmount?: number | null;
  minQuantity?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  usageLimit?: number | null;
  usedCount: number;
  scope: DiscountScope;
  isActive: boolean;
}

// ==================== REPORT DTOS ====================

export interface DashboardSummaryDto {
  activeSubscriptions: number;
  mrr: number;
  arr: number;
  totalRevenueCollected: number;
  totalOutstanding: number;
  overdueInvoicesCount: number;
  generatedAt: string;
  isCached: boolean;
}

export interface PlanMrrBreakdownDto {
  planId: string;
  planName: string;
  billingPeriod: BillingPeriod;
  activeSubscriptionsCount: number;
  totalMrr: number;
  totalArr: number;
}

export interface PeriodMrrBreakdownDto {
  billingPeriod: BillingPeriod;
  activeSubscriptionsCount: number;
  totalMrr: number;
}

export interface MrrReportDto {
  totalMrr: number;
  totalArr: number;
  activeSubscriptionsCount: number;
  byPlan: PlanMrrBreakdownDto[];
  byPeriod: PeriodMrrBreakdownDto[];
  generatedAt: string;
}

export interface AgingInvoiceItemDto {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  dueDate: string;
  daysPastDue: number;
  grandTotal: number;
  amountPaid: number;
  outstandingAmount: number;
}

export interface AgingBucketDto {
  bucket: string;
  label: string;
  invoiceCount: number;
  totalAmount: number;
  invoices: AgingInvoiceItemDto[];
}

export interface AgingReportDto {
  totalOverdueAmount: number;
  totalOverdueCount: number;
  asOfDate: string;
  buckets: AgingBucketDto[];
  generatedAt: string;
}

export interface MonthlyTrendDto {
  month: string;
  collectedRevenue: number;
  invoicedRevenue: number;
  paymentCount: number;
  invoiceCount: number;
}

export interface RevenueTrendDto {
  months: MonthlyTrendDto[];
  totalCollected: number;
  totalInvoiced: number;
  generatedAt: string;
}
