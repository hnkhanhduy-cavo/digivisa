import { Order } from '../types';

/**
 * Time buffer between flight arrival and airport pickup vehicle meeting in minutes.
 * Customer lands -> immigration clearance with Fast Track staff -> meets chauffeur at pickup.
 */
export const COMBO_LEG_TIME_OFFSET_MINUTES = 30;

/**
 * Helper to adjust date and time strings by an offset in minutes.
 * @param dateStr Date string formatted as 'YYYY-MM-DD'
 * @param timeStr Time string formatted as 'HH:mm'
 * @param offsetMinutes Number of minutes to add (positive) or subtract (negative)
 * @returns { date: string, time: string } or empty strings if invalid/missing
 */
export function adjustDateTimeByMinutes(
  dateStr?: string,
  timeStr?: string,
  offsetMinutes: number = COMBO_LEG_TIME_OFFSET_MINUTES
): { date: string; time: string } {
  if (!dateStr || !timeStr) return { date: '', time: '' };

  const cleanDate = dateStr.trim();
  const cleanTime = timeStr.trim();
  if (!cleanDate || !cleanTime) return { date: '', time: '' };

  const combinedStr = `${cleanDate}T${cleanTime}:00`;
  const dt = new Date(combinedStr);
  if (isNaN(dt.getTime())) return { date: '', time: '' };

  dt.setMinutes(dt.getMinutes() + offsetMinutes);

  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

/**
 * Builds mapped details object for secondary combo leg to ensure correct field names
 * without modifying original primary leg details.
 */
export function buildSecondaryDetails(order: Order, secondaryType: string): Record<string, any> {
  const origDetails = (order.details as Record<string, any>) || {};
  const secDetails: Record<string, any> = { ...origDetails };

  if (secondaryType === 'AirportPickup') {
    // Primary is FastTrack -> Secondary is AirportPickup
    if (!secDetails.passengerName && origDetails.contactName) {
      secDetails.passengerName = origDetails.contactName;
    }
    if (!secDetails.passengerPhone && origDetails.contactPhone) {
      secDetails.passengerPhone = origDetails.contactPhone;
    }
    if (!secDetails.passengerEmail && origDetails.contactEmail) {
      secDetails.passengerEmail = origDetails.contactEmail;
    }

    if (!secDetails.pickupDate || !secDetails.pickupTime) {
      const adjusted = adjustDateTimeByMinutes(
        origDetails.arrivalDate,
        origDetails.arrivalTime,
        COMBO_LEG_TIME_OFFSET_MINUTES
      );
      if (!secDetails.pickupDate && adjusted.date) secDetails.pickupDate = adjusted.date;
      if (!secDetails.pickupTime && adjusted.time) secDetails.pickupTime = adjusted.time;
    }

    if (!secDetails.flightNumber && origDetails.flightNumber) {
      secDetails.flightNumber = origDetails.flightNumber;
    }
    if (!secDetails.airport && origDetails.airport) {
      secDetails.airport = origDetails.airport;
    }
    if (!secDetails.terminalNumber && origDetails.terminalNumber) {
      secDetails.terminalNumber = origDetails.terminalNumber;
    }
    if (!secDetails.optionalNote && origDetails.specialRequests) {
      secDetails.optionalNote = origDetails.specialRequests;
    }
    if (!secDetails.destinationAddress && origDetails.pickupDestination) {
      secDetails.destinationAddress = origDetails.pickupDestination;
    }
    if (!secDetails.vehicleType && origDetails.selectedPickupVehicle) {
      secDetails.vehicleType = origDetails.selectedPickupVehicle;
    }
  } else if (secondaryType === 'FastTrack') {
    // Primary is AirportPickup -> Secondary is FastTrack
    if (!secDetails.contactName && origDetails.passengerName) {
      secDetails.contactName = origDetails.passengerName;
    }
    if (!secDetails.contactPhone && origDetails.passengerPhone) {
      secDetails.contactPhone = origDetails.passengerPhone;
    }
    if (!secDetails.contactEmail && origDetails.passengerEmail) {
      secDetails.contactEmail = origDetails.passengerEmail;
    }

    if (!secDetails.arrivalDate || !secDetails.arrivalTime) {
      const adjusted = adjustDateTimeByMinutes(
        origDetails.pickupDate,
        origDetails.pickupTime,
        -COMBO_LEG_TIME_OFFSET_MINUTES
      );
      if (!secDetails.arrivalDate && adjusted.date) secDetails.arrivalDate = adjusted.date;
      if (!secDetails.arrivalTime && adjusted.time) secDetails.arrivalTime = adjusted.time;
    }

    if (!secDetails.flightNumber && origDetails.flightNumber) {
      secDetails.flightNumber = origDetails.flightNumber;
    }
    if (!secDetails.airport && origDetails.airport) {
      secDetails.airport = origDetails.airport;
    }
    if (!secDetails.terminalNumber && origDetails.terminalNumber) {
      secDetails.terminalNumber = origDetails.terminalNumber;
    }
    if (!secDetails.specialRequests && origDetails.optionalNote) {
      secDetails.specialRequests = origDetails.optionalNote;
    }
    if (!secDetails.packageType && origDetails.fastTrackType) {
      secDetails.packageType = origDetails.fastTrackType;
    }
  }

  delete secDetails.totalFee;

  return secDetails;
}

export function getSplitOrders(orders: Order[]): Array<Order & { isSplitLeg?: boolean; parentId?: string }> {
  const result: any[] = [];
  if (!Array.isArray(orders)) return result;
  for (const order of orders) {
    if (!order || !order.id) continue;
    const isCombo = (order.type === 'FastTrack' && (order.details as any)?.addAirportPickup) ||
                    (order.type === 'AirportPickup' && (order.details as any)?.addFastTrack);
    
    if (isCombo) {
      // 1. Primary Leg
      result.push({
        ...order,
        isSplitLeg: true,
        parentId: order.id,
      });

      // 2. Secondary Leg
      const secondaryType = order.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack';
      const secondaryDetails = buildSecondaryDetails(order, secondaryType);
      
      result.push({
        ...order,
        id: order.id + '_secondary',
        parentId: order.id,
        type: secondaryType,
        details: secondaryDetails as any,
        status: order.secondaryStatus || 'Confirmed',
        subStatus: order.secondarySubStatus,
        staffName: order.secondaryStaffName,
        staffPhone: order.secondaryStaffPhone,
        staffLocation: order.secondaryStaffLocation,
        staffPhoto: order.secondaryStaffPhoto,
        licensePlate: order.secondaryLicensePlate,
        carPhoto: order.secondaryCarPhoto,
        isSplitLeg: true,
      });
    } else {
      result.push(order);
    }
  }
  return result;
}
