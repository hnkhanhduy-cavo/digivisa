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

export function getVietnamPricing(
  visaType: string,
  resultsOption: string,
  submissionTiming: string
): VietnamPricing {
  // Test Sandbox Package (2,000 VND)
  if (resultsOption === 'test_sandbox' || visaType.includes('Test Sandbox') || visaType.includes('Gói Test')) {
    return {
      base: 0.08,
      speed: 0,
      tax: 0,
      total: 0.08,
      baseVnd: 2000,
      speedVnd: 0,
      taxVnd: 0,
      totalVnd: 2000,
    };
  }
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
