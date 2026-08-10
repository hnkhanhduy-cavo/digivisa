import { Currency, EXCHANGE_RATES, Order } from '../types';
import { getVietnamPricing, splitCommission } from './pricing';

/**
 * Rebuilds an order's VND total from its option fields. This is how every VND
 * figure in the OMS used to be produced, which meant the screen showed a price
 * list rather than what the customer was actually charged — anything added
 * after the fact, a referral commission for instance, was invisible here.
 * Orders now store the charged amount, so this is only the fallback for orders
 * saved before they did.
 */
function legacyVndTotal(order: Order): number {
  const val = Number((order.details as any)?.totalFee) || 0;
  if (order.type === 'Visa') {
    const details = order.details as any;
    if (details.destinationCountry === 'Vietnam') {
      const pricing = getVietnamPricing(
        details.visaType,
        details.resultsOption || '',
        details.submissionTiming || ''
      );
      return pricing.totalVnd;
    }
  }

  {
    if (order.type === 'Visa') {
      const details = order.details as any;
        const base = details.visaType === 'Tourist (90 Days)' ? 220 : (details.nationality === 'Taiwan' || details.nationality === 'China' ? 130 : 120);
        let baseVnd = base * 25000;
        if (details.nationality === 'Taiwan') baseVnd = 3450000;
        else if (details.nationality === 'China') baseVnd = 3445000;
        else if (details.nationality === 'Korea' || details.nationality === 'Japan' || details.nationality === 'South Korea') {
          if (base === 120) baseVnd = 3120000;
          if (base === 220) baseVnd = 5720000;
        }
        
        let speed = 0;
        
        const speedVnd = speed * 25000;
        const subtotalVnd = baseVnd + speedVnd;
        const taxVnd = Math.round(subtotalVnd * 0.08);
        const totalVnd = subtotalVnd + taxVnd;
        
        return totalVnd;
      }

    if (order.type === 'AirportPickup') {
      const details = order.details as any;
      const airportName = details.airport || '';
      const vehicleType = details.vehicleType || '4 seats';
      
      const isHan = airportName.includes('HAN');
      const isDad = airportName.includes('DAD');
      let baseVnd = 750000;
      if (isHan) {
        if (vehicleType === '4 seats') baseVnd = 765000;
        else if (vehicleType === '7 seats') baseVnd = 1065000;
        else baseVnd = 1565000;
      } else if (isDad) {
        if (vehicleType === '4 seats') baseVnd = 700000;
        else if (vehicleType === '7 seats') baseVnd = 1000000;
        else baseVnd = 1500000;
      } else {
        // SGN
        if (vehicleType === '4 seats') baseVnd = 750000;
        else if (vehicleType === '7 seats') baseVnd = 1050000;
        else baseVnd = 1550000;
      }
      
      const addFastTrack = details.addFastTrack;
      const fastTrackType = details.fastTrackType || 'VIP Meet & Assist';
      let comboVnd = 0;
      if (addFastTrack) {
        if (fastTrackType === 'VIP Meet & Assist') comboVnd = 1150000;
        else if (fastTrackType === 'Premium Fast Track') comboVnd = 1250000;
        else if (fastTrackType === 'Elite Lounges Gate-to-Gate') comboVnd = 1400000;
      }
      
      let totalVnd = baseVnd + comboVnd;
      if (addFastTrack) {
        totalVnd = Math.max(0, totalVnd - 200000);
      }
      return totalVnd;
    }

    if (order.type === 'FastTrack') {
      const details = order.details as any;
      const packageType = details.packageType || 'Fast Track Standard';
      let packageVnd = 1150000;
      if (packageType === 'Fast Track Standard') packageVnd = 1150000;
      else if (packageType === 'Fast Track Business') packageVnd = 1250000;
      else if (packageType === 'Fast Track Vip') packageVnd = 1400000;
      
      let esimVnd = details.hasEsim ? 375000 : 0;
      
      let pickupVnd = 0;
      if (details.addAirportPickup) {
        const airportName = details.airport || '';
        const vehicleType = details.selectedPickupVehicle || '4 seats';
        const isHan = airportName.includes('HAN');
        const isDad = airportName.includes('DAD');
        if (isHan) {
          if (vehicleType === '4 seats') pickupVnd = 765000;
          else if (vehicleType === '7 seats') pickupVnd = 1065000;
          else pickupVnd = 1565000;
        } else if (isDad) {
          if (vehicleType === '4 seats') pickupVnd = 700000;
          else if (vehicleType === '7 seats') pickupVnd = 1000000;
          else pickupVnd = 1500000;
        } else {
          // SGN
          if (vehicleType === '4 seats') pickupVnd = 750000;
          else if (vehicleType === '7 seats') pickupVnd = 1050000;
          else pickupVnd = 1550000;
        }
      }
      
      let totalVnd = packageVnd + esimVnd + pickupVnd;
      if (details.addAirportPickup) {
        totalVnd = Math.max(0, totalVnd - 200000);
      }
      return totalVnd;
    }

    const EXACT_SUMS: Record<number, number> = {
      12: 300000,
      15: 375000,
      24: 600000,
      27: 700000,
      29: 750000,
      38: 1000000,
      39: 1000000,
      40: 1050000,
      42: 1100000,
      45: 1150000,
      48: 1250000,
      51: 1300000,
      54: 1375000,
      55: 1400000,
      57: 1500000,
      59: 1550000,
      60: 1525000,
      61: 1550000,
      63: 1600000,
      64: 1625000,
      65: 1700000,
      66: 1675000,
      67: 1750000,
      69: 1800000,
      70: 1775000,
      72: 1850000,
      73: 1850000,
      74: 1950000,
      75: 1950000,
      76: 2000000,
      78: 2050000,
      79: 2000000,
      80: 2100000,
      81: 2100000,
      82: 2100000,
      83: 2150000,
      84: 2200000,
      85: 2200000,
      86: 2250000,
      87: 2250000,
      88: 2225000,
      89: 2300000,
      91: 2350000,
      93: 2450000,
      94: 2375000,
      95: 2500000,
      96: 2475000,
      97: 2550000,
      99: 2600000,
      102: 2650000,
      103: 2700000,
      104: 2700000,
      105: 2750000,
      106: 2750000,
      108: 2800000,
      112: 2900000,
      114: 2950000,
      120: 3120000,
      130: 3450000,
      132: 3300000,
      135: 3375000,
      144: 3600000,
      147: 3675000,
      159: 3975000,
      162: 4100000,
      177: 4475000,
      195: 4875000,
      207: 5175000,
      210: 5250000,
      219: 5475000,
      220: 5720000,
      222: 5550000,
      234: 5850000,
      237: 5975000,
      252: 6350000,
    };
    
    const matched = EXACT_SUMS[val];
    if (matched !== undefined) {
      return matched;
    }

    return Math.round(val * EXCHANGE_RATES.VND);
  }
}

/** The VND the customer was actually charged for this order. */
export function orderVndTotal(order: Order): number {
  if (typeof order.amountVnd === 'number' && Number.isFinite(order.amountVnd) && order.amountVnd > 0) {
    return Math.round(order.amountVnd);
  }
  const stored = Number((order.details as any)?.totalVnd);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  return legacyVndTotal(order);
}

export function formatOrderMoney(usdAmount: any, currency: Currency, order?: Order): string {
  const val = typeof usdAmount === 'number' ? usdAmount : (parseFloat(usdAmount) || 0);
  if (currency !== 'VND') return `$ ${val.toFixed(2)}`;
  if (!order) return `${Math.round(val * EXCHANGE_RATES.VND).toLocaleString('en-US')} ₫`;

  // Scale by the order's own rate rather than the global one, so a part of the
  // order and the whole of it still add up on screen.
  const totalUsd = Number((order.details as any)?.totalFee) || 0;
  const totalVnd = orderVndTotal(order);
  const vnd =
    totalUsd > 0 && totalVnd > 0
      ? Math.round((val / totalUsd) * totalVnd)
      : Math.round(val * EXCHANGE_RATES.VND);
  return `${vnd.toLocaleString('en-US')} ₫`;
}

/**
 * Reads the referral commission off an order.
 *
 * Orders taken before the field was renamed still carry the old `agencyCommission`
 * name in Firestore, and nothing migrates them, so both names have to be understood
 * for as long as those orders exist. Reading only the new name made the commission
 * silently vanish from the fulfilment ledger for every order already on file.
 */
export function readReferralCommission(details: any): { usd: number; vnd: number } {
  const asked = Number(details?.referralCommission ?? details?.agencyCommission) || 0;
  if (asked <= 0) return { usd: 0, vnd: 0 };
  const currency = (details?.referralCommissionCurrency
    ?? details?.agencyCommissionCurrency
    ?? 'USD') as Currency;
  return splitCommission(asked, currency);
}
