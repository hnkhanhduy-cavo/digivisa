import type { Env } from './env';
import { getOrderFromFirestore, setNotifyFlagInFirestore } from './firestore';
import { createLarkBaseRecord, sendLarkChatMessage, type TicketPayload } from './lark';

function getRawString(fieldObj: any): string | undefined {
  if (!fieldObj) return undefined;
  if (typeof fieldObj.stringValue === 'string') return fieldObj.stringValue;
  return undefined;
}

function getRawNumber(fieldObj: any): number | undefined {
  if (!fieldObj) return undefined;
  if (fieldObj.integerValue !== undefined) return Number(fieldObj.integerValue);
  if (fieldObj.doubleValue !== undefined) return Number(fieldObj.doubleValue);
  return undefined;
}

function getRawBoolean(fieldObj: any): boolean {
  if (!fieldObj) return false;
  return fieldObj.booleanValue === true;
}

export function buildTicketPayload(orderId: string, rawDoc: any): TicketPayload {
  const rootFields = rawDoc?.fields || {};
  const type = getRawString(rootFields.type) || 'Visa';
  const amountVnd = getRawNumber(rootFields.amountVnd) || 0;
  const paymentStatus = getRawString(rootFields.paymentStatus) || 'Paid';
  const status = getRawString(rootFields.status) || 'Pending';
  const trackingToken = getRawString(rootFields.trackingToken) || '';
  const createdAt = getRawString(rootFields.createdAt) || new Date().toISOString();

  const detailsFields = rootFields.details?.mapValue?.fields || {};

  let customerName = '';
  let customerPhone = '';
  let customerEmail = '';
  let serviceDate = '';
  let flightNumber: string | undefined = undefined;
  let airport: string | undefined = undefined;
  let serviceLabel = 'Visa';

  const firstName = getRawString(detailsFields.firstName) || '';
  const lastName = getRawString(detailsFields.lastName) || '';
  const combinedName = `${firstName} ${lastName}`.trim();
  const genericName =
    getRawString(detailsFields.contactName) ||
    getRawString(detailsFields.passengerName) ||
    getRawString(detailsFields.fullName) ||
    combinedName;

  if (type === 'FastTrack') {
    serviceLabel = 'Fast Track';
    customerName = genericName;
    customerPhone = getRawString(detailsFields.contactPhone) || getRawString(detailsFields.phone) || '';
    customerEmail = getRawString(detailsFields.contactEmail) || getRawString(detailsFields.email) || '';
    flightNumber = getRawString(detailsFields.flightNumber);
    airport = getRawString(detailsFields.airport);
    const arrDate = getRawString(detailsFields.arrivalDate) || '';
    const arrTime = getRawString(detailsFields.arrivalTime) || '';
    serviceDate = arrTime ? `${arrDate} (${arrTime})` : arrDate;
  } else if (type === 'AirportPickup') {
    serviceLabel = 'Đưa đón sân bay';
    customerName = genericName;
    customerPhone = getRawString(detailsFields.passengerPhone) || getRawString(detailsFields.phone) || '';
    customerEmail = getRawString(detailsFields.passengerEmail) || getRawString(detailsFields.email) || '';
    flightNumber = getRawString(detailsFields.flightNumber);
    airport = getRawString(detailsFields.airport);
    const pickDate = getRawString(detailsFields.pickupDate) || '';
    const pickTime = getRawString(detailsFields.pickupTime) || '';
    serviceDate = pickTime ? `${pickDate} (${pickTime})` : pickDate;
  } else {
    // Visa
    serviceLabel = 'Visa';
    customerName = genericName;
    customerPhone = getRawString(detailsFields.phone) || getRawString(detailsFields.contactPhone) || '';
    customerEmail = getRawString(detailsFields.email) || getRawString(detailsFields.contactEmail) || '';
    serviceDate = getRawString(detailsFields.arrivalDate) || '';
  }

  // Deduplicate repeated (WhatsApp) / (Zalo) suffixes in phone string
  if (customerPhone) {
    customerPhone = customerPhone
      .replace(/(\(WhatsApp\)\s*)+/gi, '(WhatsApp) ')
      .replace(/(\(Zalo\)\s*)+/gi, '(Zalo) ')
      .trim();
  }

  const isCombo =
    getRawBoolean(detailsFields.addAirportPickup) || getRawBoolean(detailsFields.addFastTrack);

  return {
    orderId,
    type,
    serviceLabel,
    customerName,
    customerPhone,
    customerEmail,
    serviceDate,
    flightNumber,
    airport,
    amountVnd,
    paymentStatus,
    status,
    trackingToken,
    createdAt,
    isCombo,
  };
}

export async function notifyNewOrder(
  orderId: string,
  env: Env
): Promise<{ ok: boolean; skipped?: boolean }> {
  try {
    const hasBaseConfig = Boolean(
      env.LARK_APP_ID && env.LARK_APP_SECRET && env.LARK_BASE_APP_TOKEN && env.LARK_BASE_TABLE_ID
    );
    const hasChatConfig = Boolean(
      env.LARK_APP_ID && env.LARK_APP_SECRET && env.LARK_CHAT_ID
    );

    if (!hasBaseConfig && !hasChatConfig) {
      return { ok: true, skipped: true };
    }

    const order = await getOrderFromFirestore(orderId, env);
    if (!order.ok) {
      console.error(`[Lark Notify] Failed to fetch order ${orderId} from Firestore:`, order.reason);
      return { ok: false };
    }

    if (order.fields.larkNotifiedAt) {
      return { ok: true, skipped: true };
    }

    const payload = buildTicketPayload(orderId, order.raw);

    const tasks: Promise<any>[] = [];
    let baseIndex = -1;

    if (hasBaseConfig) {
      baseIndex = tasks.length;
      tasks.push(createLarkBaseRecord(payload, env));
    }

    if (hasChatConfig) {
      tasks.push(sendLarkChatMessage(payload, env));
    }

    const results = await Promise.allSettled(tasks);

    let atLeastOneSuccess = false;
    let larkRecordId: string | undefined = undefined;

    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        atLeastOneSuccess = true;
        if (idx === baseIndex && typeof res.value === 'string') {
          larkRecordId = res.value;
        }
      } else {
        console.error(`[Lark Notify] Task ${idx} failed:`, res.reason);
      }
    });

    if (atLeastOneSuccess) {
      const larkNotifiedAt = new Date().toISOString();
      await setNotifyFlagInFirestore(orderId, { larkNotifiedAt, larkRecordId }, env);
      return { ok: true };
    }

    return { ok: false };
  } catch (err) {
    console.error('[Lark Notify] Unexpected error in notifyNewOrder:', err);
    return { ok: false };
  }
}
