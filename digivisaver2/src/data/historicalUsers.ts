export interface HistoricalProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  dateOfBirth: string;
  passportNumber: string;
  passportExpiry: string;
  // Documents
  passportScan: string;
  photoScan: string;
  // Invoice Details
  wantsInvoice: boolean;
  companyName: string;
  taxCode: string;
  companyAddress: string;
  companyEmail: string;
  // FastTrack & Airport details
  vehicleType: '4 seats' | '7 seats' | '16 seats';
  pickupDestination: string;
  destinationAddress: string;
  pickupAddress: string;
  flightNumber: string;
  specialRequests?: string;
}

export const HISTORICAL_PROFILES: HistoricalProfile[] = [
  {
    id: "HP-8902",
    name: "Min-ji Kim (Korea Tourist)",
    firstName: "MIN-JI",
    lastName: "KIM",
    email: "minji.kim@traveler.com",
    phone: "+8225550143",
    nationality: "Korea",
    dateOfBirth: "1991-05-14",
    passportNumber: "KR9082341",
    passportExpiry: "2032-11-20",
    passportScan: "passport_minji_kim.jpg",
    photoScan: "photo_minji_kim.jpg",
    wantsInvoice: false,
    companyName: "",
    taxCode: "",
    companyAddress: "",
    companyEmail: "",
    vehicleType: "4 seats",
    pickupDestination: "InterContinental Saigon, District 1, HCMC",
    destinationAddress: "InterContinental Saigon, District 1, HCMC",
    pickupAddress: "Tan Son Nhat International Airport Terminal 2",
    flightNumber: "UA869",
    specialRequests: "Nonsmoking driver requested. Extra space for luggage."
  },
  {
    id: "HP-3415",
    name: "Dr. Kenji Takahashi (Japan Business)",
    firstName: "KENJI",
    lastName: "TAKAHASHI",
    email: "k.takahashi@hanoitech.org",
    phone: "+81355556211",
    nationality: "Japan",
    dateOfBirth: "1978-09-22",
    passportNumber: "JP5501862",
    passportExpiry: "2029-04-12",
    passportScan: "passport_kenji_takahashi.jpg",
    photoScan: "photo_kenji_takahashi.jpg",
    wantsInvoice: true,
    companyName: "HANOI HIGH-TECH SOLUTIONS CO. LTD",
    taxCode: "0108923485",
    companyAddress: "Floor 12, Keangnam Landmark 72, Me Tri, Nam Tu Liem, Hanoi",
    companyEmail: "finance@hanoitech.org",
    vehicleType: "7 seats",
    pickupDestination: "Lotte Center Residence, Lieu Giai, Hanoi",
    destinationAddress: "Lotte Center Residence, Lieu Giai, Hanoi",
    pickupAddress: "Noi Bai International Airport Terminal 2",
    flightNumber: "JL751",
    specialRequests: "Needs dual entry permit. Wants corporate billing setup."
  },
  {
    id: "HP-7209",
    name: "Chen-Wei Chen (Taiwan Educator)",
    firstName: "CHEN-WEI",
    lastName: "CHEN",
    email: "chenwei.chen@educator.tw",
    phone: "+886279460192",
    nationality: "Taiwan",
    dateOfBirth: "1985-02-03",
    passportNumber: "TW2049187",
    passportExpiry: "2031-08-30",
    passportScan: "passport_chenwei_chen.jpg",
    photoScan: "photo_chenwei_chen.jpg",
    wantsInvoice: false,
    companyName: "",
    taxCode: "",
    companyAddress: "",
    companyEmail: "",
    vehicleType: "4 seats",
    pickupDestination: "Novotel Danang Han River",
    destinationAddress: "Novotel Danang Han River",
    pickupAddress: "Danang International Airport Terminal 2",
    flightNumber: "SQ172",
    specialRequests: "Frequent flyer. Needs fast track meet and assist if arrival delayed."
  },
  {
    id: "HP-1102",
    name: "Ying Li (China Tech Lead)",
    firstName: "YING",
    lastName: "LI",
    email: "ying.li@tech.cn",
    phone: "+861012345678",
    nationality: "China",
    dateOfBirth: "1990-12-05",
    passportNumber: "CN901234",
    passportExpiry: "2034-03-15",
    passportScan: "passport_ying_li.jpg",
    photoScan: "photo_ying_li.jpg",
    wantsInvoice: true,
    companyName: "NORDIC VENTURES VIETNAM REP OFFICE",
    taxCode: "0312345678",
    companyAddress: "29A Dong Khoi Street, District 1, Ho Chi Minh City",
    companyEmail: "vietnam@nordicventures.se",
    vehicleType: "16 seats",
    pickupDestination: "Caravelle Hotel, 19 Lam Son Square, District 1, HCMC",
    destinationAddress: "Caravelle Hotel, 19 Lam Son Square, District 1, HCMC",
    pickupAddress: "Tan Son Nhat International Airport Terminal 2",
    flightNumber: "EK392",
    specialRequests: "Traveling with delegation, heavy group bags require 16-seater transporter."
  }
];
