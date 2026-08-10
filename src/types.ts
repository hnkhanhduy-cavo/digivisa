export interface VisaApplication {
  firstName: string;
  lastName: string;
  passportNumber: string;
  passportExpiry: string;
  nationality: string;
  dateOfBirth: string;
  arrivalDate: string;
  email: string;
  phone: string;
  visaType: string;
  processingSpeed: 'Standard' | 'Express' | 'SuperExpress' | string;
  passportScan: string; // Simulated file name
  passportScanDataUrl?: string; // Base64 Image Data URL saved to Firebase
  photoScan: string; // Simulated file name
  photoScanDataUrl?: string; // Base64 Image Data URL saved to Firebase
  totalFee: number;
  /** Exact VND total. Set only when a referral commission applies, so ordinary orders keep converting from totalFee as before. */
  totalVnd?: number;
  /** Commission the referring partner asked for on this booking, in the currency they typed it in. */
  referralCommission?: number;
  referralCommissionCurrency?: Currency;
  // Dynamic Visa Readiness Check metadata
  readinessPercent?: number;
  readinessChecks?: Array<{ id: string; name: string; description: string; status: 'passed' | 'warning' | 'pending' }>;
  // VAT Invoice options
  wantsInvoice?: boolean;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
  companyEmail?: string;
  // Vietnam eVisa options
  destinationCountry?: string;
  resultsOption?: 'within_2_days' | 'same_day' | string;
  submissionTiming?: 'before_3pm' | 'before_9pm_next_day_5pm' | 'before_9pm_next_day_noon' | string;
}

export interface FastTrackBooking {
  airport?: string;
  serviceDirection?: 'Arrival' | 'Departure';
  airlineName: string;
  flightNumber: string;
  arrivalDate: string;
  arrivalTime: string;
  numberOfPassengers: number;
  packageType: 'Fast Track Standard' | 'Fast Track Business' | 'Fast Track Vip';
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactPref?: 'WhatsApp' | 'Zalo' | 'SMS'; // Kênh liên lạc ưa thích (WhatsApp, Zalo, SMS)
  specialRequests: string;
  totalFee: number;
  /** Exact VND total. Set only when a referral commission applies, so ordinary orders keep converting from totalFee as before. */
  totalVnd?: number;
  /** Commission the referring partner asked for on this booking, in the currency they typed it in. */
  referralCommission?: number;
  referralCommissionCurrency?: Currency;
  // New features
  hasEsim: boolean;
  addAirportPickup: boolean;
  selectedPickupVehicle?: '4 seats' | '7 seats' | '16 seats';
  pickupDestination?: string;
  paymentMethod?: '9pay' | 'bank_transfer';
  // Fast track visa/residence option
  visaType?: 'Free Tourist Visa (15 Days, Exempt)' | 'Tourist (30 Days)' | 'Tourist (90 Days)' | 'Business (30 Days)' | 'Business (90 Days)' | 'Visa / TRC (Temporary Residence Card)';
  visaAttachment?: string; // Uploaded visa or passport/TRC image
  // VAT Invoice options
  wantsInvoice?: boolean;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
  companyEmail?: string;
}

export interface AirportPickupBooking {
  airport?: string;
  pickupDate: string;
  pickupTime: string;
  flightNumber: string;
  destinationAddress: string;
  pickupAddress: string;
  direction: 'Arrival' | 'Departure';
  vehicleType: '4 seats' | '7 seats' | '16 seats';
  passengerName: string;
  passengerPhone: string;
  contactPref?: 'WhatsApp' | 'Zalo' | 'SMS'; // Kênh liên lạc ưa thích (WhatsApp, Zalo, SMS)
  passengerEmail: string;
  luggageCount?: number;
  terminalNumber: string;
  optionalNote?: string;
  totalFee: number;
  /** Exact VND total. Set only when a referral commission applies, so ordinary orders keep converting from totalFee as before. */
  totalVnd?: number;
  /** Commission the referring partner asked for on this booking, in the currency they typed it in. */
  referralCommission?: number;
  referralCommissionCurrency?: Currency;
  // New options
  addFastTrack: boolean;
  fastTrackType?: 'VIP Meet & Assist' | 'Premium Fast Track' | 'Elite Lounges Gate-to-Gate';
  serviceDirection?: 'Arrival' | 'Departure';
  paymentMethod?: '9pay' | 'bank_transfer';
  // VAT Invoice options
  wantsInvoice?: boolean;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
  companyEmail?: string;
}

export type VisaStatus = 'Confirmed' | 'Submitted to Embassy' | 'Processing' | 'Completed' | 'Pending Review' | 'Cancelled' | 'Pending Documents' | 'Needs Resubmission' | 'Document Checked' | 'Approved & Issued' | 'Declined';
export type FastTrackStatus = 'Confirmed' | 'Staff Assigned' | 'Flying' | 'Delay' | 'On Time' | 'Completed' | 'Active' | 'Cancelled' | 'Pending Landing Info' | 'Awaiting Flight Landing' | 'Passenger Greeted' | 'Clearance Dynamic Sync' | 'Service Completed';
export type AirportPickupStatus = 'Confirmed' | 'Staff Assigned' | 'Flying' | 'Delay' | 'On Time' | 'Completed' | 'Active' | 'Cancelled' | 'Awaiting Dispatch' | 'Driver Assigned' | 'Driver Waiting At Gate' | 'In Transit' | 'Luggage Handover Completed' | 'Journey Completed';
export type PaymentStatus = 'Paid (Bank Transfer)' | 'Paid (9Pay)' | 'Pending' | 'Refunded';

/** Public fields returned by /api/order-lookup (no PII / passport scans). */
export interface PublicOrderSummary {
  id: string;
  type: 'Visa' | 'FastTrack' | 'AirportPickup' | string;
  status: string;
  paymentStatus: PaymentStatus | string;
  createdAt: string;
}

export interface OrderEditLogEntry {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  by: string;
  at: string;
  reason?: string;
}

export interface Order {
  id: string;
  type: 'Visa' | 'FastTrack' | 'AirportPickup';
  status: VisaStatus | FastTrackStatus | AirportPickupStatus | string;
  subStatus?: string;
  createdAt: string;
  paymentStatus: PaymentStatus;
  /** Chargeable VND amount sent to 9Pay (must be ≥ 10,000). */
  amountVnd?: number;
  /** 9Pay payment_no stored after verified IPN / return_url. */
  ninepayPaymentNo?: string;
  /** Opaque guest Tracker token (≥32 chars). Not the same as order id. */
  trackingToken?: string;
  /** Link mời nhóm chat riêng của đơn. Chỉ host chat.whatsapp.com. */
  whatsappGroupUrl?: string;
  /** Link mời nhóm Zalo riêng của đơn. Chỉ host zalo.me. */
  zaloGroupUrl?: string;
  /** ISO timestamp lần cuối staff cập nhật link nhóm. */
  groupLinkUpdatedAt?: string;
  /** Link mời nhóm chat riêng chặng phụ của đơn combo. Chỉ host chat.whatsapp.com. */
  whatsappGroupUrlSecondary?: string;
  /** Link mời nhóm Zalo riêng chặng phụ của đơn combo. Chỉ host zalo.me. */
  zaloGroupUrlSecondary?: string;
  /** ISO timestamp lần cuối staff cập nhật link nhóm chặng phụ. */
  groupLinkUpdatedAtSecondary?: string;
  larkRecordId?: string;
  larkNotifiedAt?: string;
  userId?: string;
  userEmail?: string;
  details: VisaApplication | FastTrackBooking | AirportPickupBooking;
  // Agency staff / vehicle details
  staffName?: string;
  staffPhone?: string;
  staffLocation?: string;
  staffPhoto?: string;
  licensePlate?: string;
  carPhoto?: string;
  // Secondary leg details for combo orders
  secondaryStatus?: string;
  secondarySubStatus?: string;
  secondaryStaffName?: string;
  secondaryStaffPhone?: string;
  secondaryStaffLocation?: string;
  secondaryStaffPhoto?: string;
  secondaryLicensePlate?: string;
  secondaryCarPhoto?: string;
  checklist?: Record<string, boolean>;
  checklistSecondary?: Record<string, boolean>;
  invoiceStatus?: 'Draft' | 'Sent to Customer' | 'Issued & Tax Stamped' | 'Archived';
  /** Số hoá đơn VAT do kế toán cấp. Không bắt buộc; chỉ cảnh báo khi đã đánh dấu xuất mà còn trống. */
  invoiceNumber?: string;
  editLog?: OrderEditLogEntry[];
}

export type Currency = 'USD' | 'VND';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  VND: '₫',
};

export const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  VND: 25000,
};

export const NATIONALITIES = [
  'Korea', 'Japan', 'Taiwan', 'China'
];
