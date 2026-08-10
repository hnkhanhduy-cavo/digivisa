export interface StatusStep {
  id: string;
  labelEn: string;
  labelVi: string;
  descEn?: string;
  descVi?: string;
}

export interface SubStatusOption {
  id: string;
  labelEn: string;
  labelVi: string;
}

// 1. Core operational flow steps per service type (excluding Cancelled)
export const SERVICE_FLOW_STEPS: Record<string, StatusStep[]> = {
  Visa: [
    { id: 'Confirmed', labelEn: 'Confirmed', labelVi: 'Đã xác nhận', descEn: 'Order confirmed & paid', descVi: 'Đơn hàng đã thanh toán' },
    { id: 'Agency Review', labelEn: 'Agency Review', labelVi: 'Chờ đối tác xử lý', descEn: 'Dossier under agency review', descVi: 'Hồ sơ đang được đối tác kiểm tra' },
    { id: 'Submitted to Embassy', labelEn: 'Submitted to Embassy', labelVi: 'Đã nộp ĐSQ', descEn: 'Submitted to embassy', descVi: 'Đã nộp hồ sơ vào Đại sứ quán' },
    { id: 'Processing', labelEn: 'Processing', labelVi: 'Đang xử lý', descEn: 'Under review at embassy', descVi: 'Đang chờ kết quả từ ĐSQ' },
    { id: 'Completed', labelEn: 'Completed', labelVi: 'Hoàn thành', descEn: 'Visa issued', descVi: 'Đã cấp Visa thành công' },
  ],
  FastTrack: [
    { id: 'Confirmed', labelEn: 'Confirmed', labelVi: 'Đã xác nhận', descEn: 'Order confirmed & paid', descVi: 'Đơn hàng đã thanh toán' },
    { id: 'Staff Assigned', labelEn: 'Staff Assigned', labelVi: 'Đã phân công nhân viên', descEn: 'Staff assigned', descVi: 'Đã phân công nhân viên đón' },
    { id: 'Completed', labelEn: 'Completed', labelVi: 'Hoàn thành', descEn: 'Service completed', descVi: 'Dịch vụ hoàn thành' },
  ],
  AirportPickup: [
    { id: 'Confirmed', labelEn: 'Confirmed', labelVi: 'Đã xác nhận', descEn: 'Order confirmed & paid', descVi: 'Đơn hàng đã thanh toán' },
    { id: 'Staff Assigned', labelEn: 'Staff Assigned', labelVi: 'Đã phân công tài xế', descEn: 'Chauffeur assigned', descVi: 'Đã phân công tài xế' },
    { id: 'Passenger Greet', labelEn: 'Passenger Greet', labelVi: 'Đã đón khách', descEn: 'Passenger met', descVi: 'Tài xế đã đón khách' },
    { id: 'Completed', labelEn: 'Completed', labelVi: 'Hoàn thành', descEn: 'Trip completed', descVi: 'Chuyến đi hoàn thành' },
  ],
};

// 2. Sub-status options mapping (Visa only)
export const VISA_SUB_STATUS_MAP: Record<string, SubStatusOption[]> = {
  'Submitted to Embassy': [
    { id: 'Standard doc check', labelEn: 'Standard doc check', labelVi: 'Kiểm tra hồ sơ tiêu chuẩn' },
    { id: 'More docs required', labelEn: 'More docs required', labelVi: 'Yêu cầu bổ sung giấy tờ' },
  ],
  'Completed': [
    { id: 'Approved', labelEn: 'Approved', labelVi: 'Đã duyệt' },
    { id: 'Rejected', labelEn: 'Rejected', labelVi: 'Từ chối' },
  ],
};

/**
 * Returns available status options for ops status dropdowns/buttons.
 * Includes all service flow steps + 'Cancelled' as exception status.
 */
export function getServiceStatusOptions(serviceType: string): string[] {
  const steps = SERVICE_FLOW_STEPS[serviceType] || SERVICE_FLOW_STEPS['Visa'];
  const stepIds = steps.map((s) => s.id);
  return [...stepIds, 'Cancelled'];
}

/**
 * Returns available sub-status options for a given status.
 * Sub-statuses are ONLY applicable for Visa service. Returns [] for all other services.
 */
export function getSubStatusOptions(status: string, serviceType?: string): string[] {
  if (status === 'Cancelled') {
    return ['Refunded'];
  }
  if (serviceType !== 'Visa') {
    return [];
  }
  const options = VISA_SUB_STATUS_MAP[status];
  return options ? options.map((o) => o.id) : [];
}

/**
 * Returns master operational step list for OrderTracker timeline.
 */
export function getTimelineStepsForOrder(serviceType: string): { id: string; label: string; desc: string }[] {
  const steps = SERVICE_FLOW_STEPS[serviceType] || SERVICE_FLOW_STEPS['Visa'];
  return steps.map((s) => ({
    id: s.id,
    label: s.id,
    desc: s.descEn || s.id,
  }));
}

/**
 * Returns customer-facing timeline step list.
 * Excludes internal operational steps (e.g. 'Agency Review' for Visa) so customers see a clean 4-step progress flow.
 */
export function getCustomerTimelineStepsForOrder(serviceType: string): { id: string; label: string; desc: string }[] {
  const steps = getTimelineStepsForOrder(serviceType);
  if (serviceType === 'Visa') {
    return steps.filter((step) => step.id !== 'Agency Review');
  }
  return steps;
}

/**
 * Master operational status normalizer for OrderTracker timeline indexing.
 */
export function normalizeStatusForTimeline(status: string | undefined, serviceType: string): string {
  if (!status || !status.trim()) {
    return 'Confirmed';
  }

  const s = status.trim();
  const lower = s.toLowerCase();

  const validSteps = (SERVICE_FLOW_STEPS[serviceType] || SERVICE_FLOW_STEPS['Visa']).map((x) => x.id);
  const matched = validSteps.find((opt) => opt.toLowerCase() === lower);
  if (matched) return matched;

  if (lower === 'cancelled' || lower === 'canceled') {
    return 'Cancelled';
  }

  if (lower === 'pending payment' || lower === 'pending' || lower === 'pending review') {
    return s;
  }

  if (lower === 'completed' || lower === 'service completed' || lower === 'journey completed' || lower === 'approved & issued') {
    return 'Completed';
  }
  if (lower === 'processing' || lower === 'under review' || lower === 'standard processing') {
    return 'Processing';
  }
  if (lower === 'submitted to embassy' || lower === 'submitted') {
    return 'Submitted to Embassy';
  }
  if (lower === 'agency review' || lower === 'assigned' || lower === 'partner assigned') {
    return serviceType === 'Visa' ? 'Agency Review' : 'Confirmed';
  }
  if (lower === 'staff assigned' || lower === 'chauffeur assigned') {
    return 'Staff Assigned';
  }
  if (lower === 'passenger greet' || lower === 'passenger greeted') {
    return 'Passenger Greet';
  }

  return s;
}

/**
 * Customer-facing status normalizer for timeline display.
 * Maps internal operational statuses like 'Agency Review' to customer-visible statuses (e.g. 'Confirmed').
 */
export function normalizeCustomerStatusForTimeline(status: string | undefined, serviceType: string): string {
  const normalized = normalizeStatusForTimeline(status, serviceType);
  if (serviceType === 'Visa' && normalized === 'Agency Review') {
    return 'Confirmed';
  }
  return normalized;
}

/**
 * Gets bilingual label for status.
 */
export function getStatusLabel(status: string, lang: 'EN' | 'VI' = 'VI'): string {
  if (status === 'Cancelled') {
    return lang === 'EN' ? 'Cancelled' : 'Đã huỷ';
  }
  for (const list of Object.values(SERVICE_FLOW_STEPS)) {
    const found = list.find((s) => s.id === status);
    if (found) {
      return lang === 'EN' ? found.labelEn : found.labelVi;
    }
  }
  return status;
}

/**
 * Gets bilingual label for sub-status.
 */
export function getSubStatusLabel(subStatus: string, lang: 'EN' | 'VI' = 'VI'): string {
  if (subStatus === 'Refunded') {
    return lang === 'EN' ? 'Refunded' : 'Đã hoàn tiền';
  }
  for (const list of Object.values(VISA_SUB_STATUS_MAP)) {
    const found = (list as SubStatusOption[]).find((s) => s.id === subStatus);
    if (found) {
      return lang === 'EN' ? found.labelEn : found.labelVi;
    }
  }
  return subStatus;
}
