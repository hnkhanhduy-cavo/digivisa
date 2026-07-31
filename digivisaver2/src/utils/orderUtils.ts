import { Order } from '../types';

export function getSplitOrders(orders: Order[]): Array<Order & { isSplitLeg?: boolean; parentId?: string }> {
  const result: any[] = [];
  for (const order of orders) {
    if (!order) continue;
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
      
      result.push({
        ...order,
        id: order.id + '_secondary',
        parentId: order.id,
        type: secondaryType,
        status: order.secondaryStatus || 'Staff Assigned',
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
