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
  specialRequests: string;
  totalFee: number;
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
  passengerEmail: string;
  luggageCount?: number;
  terminalNumber: string;
  optionalNote?: string;
  totalFee: number;
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

export interface Order {
  id: string;
  type: 'Visa' | 'FastTrack' | 'AirportPickup';
  status: VisaStatus | FastTrackStatus | AirportPickupStatus | string;
  subStatus?: string;
  createdAt: string;
  paymentStatus: PaymentStatus;
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
