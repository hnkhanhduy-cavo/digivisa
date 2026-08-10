import { Currency, EXCHANGE_RATES } from '../types';

export interface VietnamPricing {
  base: number;
  speed: number;
  tax: number;
  total: number;
  baseVnd: number;
  speedVnd: number;
  taxVnd: number;
  totalVnd: number;
}

/** Exact USD→VND display/charge table used across the app. */
export const USD_TO_VND_EXACT: Record<number, number> = {
  0.4: 10000,
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
  49: 1250000,
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
  66: 1700000,
  67: 1750000,
  69: 1800000,
  70: 1775000,
  72: 1850000,
  73: 1850000,
  74: 1950000,
  75: 1950000,
  76: 2000000,
  77: 2000000,
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
  93: 2400000,
  94: 2375000,
  95: 2500000,
  96: 2475000,
  97: 2550000,
  99: 2600000,
  102: 2650000,
  103: 2700000,
  104: 2700000,
  105: 2700000,
  106: 2750000,
  108: 2800000,
  112: 2900000,
  114: 2950000,
  120: 3120000,
  122: 3150000,
  130: 3450000,
  132: 3300000,
  135: 3375000,
  144: 3600000,
  147: 3675000,
  150: 3850000,
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
  300: 7800000,
};

/** Convert a USD fee to VND for 9Pay (exact table first, then EXCHANGE_RATES). */
export function usdToVnd(usdAmount: number): number {
  const val = typeof usdAmount === 'number' ? usdAmount : parseFloat(String(usdAmount)) || 0;
  const matched = USD_TO_VND_EXACT[val];
  if (matched !== undefined) return matched;
  return Math.round(val * EXCHANGE_RATES.VND);
}

export function formatConvertedPrice(usdAmount: number, currency: Currency): string {
  const val = typeof usdAmount === 'number' ? usdAmount : parseFloat(String(usdAmount)) || 0;
  if (currency === 'VND') {
    return `${usdToVnd(val).toLocaleString('en-US')} ₫`;
  }
  return `$ ${val.toFixed(2)}`;
}

/**
 * An agency types their commission in whichever currency is on screen. Both totals
 * need it, so express it in each: the one they typed is kept exact, the other is
 * converted. Charging happens in VND, so a commission entered in VND reaches 9Pay
 * to the dong with no round trip through USD.
 */
export function splitCommission(
  amount: number,
  currency: Currency
): { usd: number; vnd: number } {
  if (!amount || !Number.isFinite(amount) || amount <= 0) {
    return { usd: 0, vnd: 0 };
  }
  if (currency === 'VND') {
    return { usd: amount / EXCHANGE_RATES.VND, vnd: Math.round(amount) };
  }
  return { usd: amount, vnd: usdToVnd(amount) };
}

/**
 * Resolve chargeable VND for an order. Prefer explicit amountVnd / totalVnd;
 * never invent a sub-minimum placeholder amount.
 */
export function resolveOrderAmountVnd(order: {
  amountVnd?: number;
  details?: { totalFee?: number; totalVnd?: number };
}): number {
  if (typeof order.amountVnd === 'number' && Number.isFinite(order.amountVnd)) {
    return Math.round(order.amountVnd);
  }
  const details = order.details;
  if (typeof details?.totalVnd === 'number' && Number.isFinite(details.totalVnd)) {
    return Math.round(details.totalVnd);
  }
  if (typeof details?.totalFee === 'number' && Number.isFinite(details.totalFee)) {
    return usdToVnd(details.totalFee);
  }
  return 0;
}

export function getVietnamPricing(
  visaType: string,
  resultsOption: string,
  submissionTiming: string
): VietnamPricing {
  // Single eVisa
  if (visaType === 'Single eVisa') {
    if (resultsOption === 'same_day') {
      return {
        base: 50,
        speed: 62.96,
        tax: 9.04,
        total: 122,
        baseVnd: 1250000,
        speedVnd: 1666667,
        taxVnd: 233333,
        totalVnd: 3150000,
      };
    } else {
      // within_2_days
      if (submissionTiming === 'before_9pm_next_day_5pm') {
        return {
          base: 50,
          speed: 21.30,
          tax: 5.70,
          total: 77,
          baseVnd: 1250000,
          speedVnd: 601852,
          taxVnd: 148148,
          totalVnd: 2000000,
        };
      } else if (submissionTiming === 'before_9pm_next_day_noon') {
        return {
          base: 50,
          speed: 28.70,
          tax: 6.30,
          total: 85,
          baseVnd: 1250000,
          speedVnd: 787037,
          taxVnd: 162963,
          totalVnd: 2200000,
        };
      } else {
        // before_3pm (default)
        return {
          base: 50,
          speed: 11.11,
          tax: 4.89,
          total: 66,
          baseVnd: 1250000,
          speedVnd: 324074,
          taxVnd: 125926,
          totalVnd: 1700000,
        };
      }
    }
  }

  // Multiple eVisa
  if (visaType === 'Multiple eVisa') {
    if (resultsOption === 'same_day') {
      return {
        base: 80,
        speed: 58.89,
        tax: 11.11,
        total: 150,
        baseVnd: 2000000,
        speedVnd: 1564815,
        taxVnd: 285185,
        totalVnd: 3850000,
      };
    } else {
      // within_2_days
      if (submissionTiming === 'before_9pm_next_day_5pm') {
        return {
          base: 80,
          speed: 17.22,
          tax: 7.78,
          total: 105,
          baseVnd: 2000000,
          speedVnd: 500000,
          taxVnd: 200000,
          totalVnd: 2700000,
        };
      } else if (submissionTiming === 'before_9pm_next_day_noon') {
        return {
          base: 80,
          speed: 23.70,
          tax: 8.30,
          total: 112,
          baseVnd: 2000000,
          speedVnd: 685185,
          taxVnd: 214815,
          totalVnd: 2900000,
        };
      } else {
        // before_3pm (default)
        return {
          base: 80,
          speed: 6.11,
          tax: 6.89,
          total: 93,
          baseVnd: 2000000,
          speedVnd: 222222,
          taxVnd: 177778,
          totalVnd: 2400000,
        };
      }
    }
  }

  // Vietnam approval letter on arrival
  return {
    base: 120,
    speed: 157.78,
    tax: 22.22,
    total: 300,
    baseVnd: 3000000,
    speedVnd: 4222222,
    taxVnd: 577778,
    totalVnd: 7800000,
  };
}
