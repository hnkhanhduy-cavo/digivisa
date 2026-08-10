import React, { useMemo, useState } from 'react';
import { Wallet, HandCoins, Truck, ChevronDown, ChevronRight, Check, AlertTriangle, CalendarDays, Layers } from 'lucide-react';
import { Order } from '../types';
import { orderVndTotal, readReferralCommission, getCostLegs, totalSupplierCost, CostLeg } from '../utils/orderMoney';
import { auth } from '../utils/firebase';

interface OMSMoneyLedgerProps {
  /** Paid orders only. Base orders, never split combo legs — a combo's money belongs to one order. */
  orders: Order[];
  PARTNERS: Record<string, Array<{ id: string; name: string; contact: string; rating: string; activeOrders: number }>>;
  language: string;
  onUpdateOrder?: (orderId: string, fields: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
}

const vnd = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₫`;

/** Refunded money never reached us, so it has no place in a margin or a payout total. */
function isRefunded(order: Order): boolean {
  return order.paymentStatus === 'Refunded' || order.subStatus === 'Refunded';
}

interface Slice {
  revenueVnd: number;
  commissionVnd: number;
  costVnd: number;
  marginVnd: number;
  orderCount: number;
  missingCostCount: number;
}

const emptySlice = (): Slice => ({
  revenueVnd: 0,
  commissionVnd: 0,
  costVnd: 0,
  marginVnd: 0,
  orderCount: 0,
  missingCostCount: 0,
});

function addToSlice(slice: Slice, order: Order) {
  const revenue = orderVndTotal(order);
  const commission = readReferralCommission(order.details).vnd;
  const cost = totalSupplierCost(order);
  slice.revenueVnd += revenue;
  slice.commissionVnd += commission;
  slice.costVnd += cost;
  slice.marginVnd += revenue - commission - cost;
  slice.orderCount += 1;
  if (cost <= 0) slice.missingCostCount += 1;
}

const SERVICE_LABELS: Record<string, { en: string; vi: string }> = {
  Visa: { en: 'Visa', vi: 'Visa' },
  FastTrack: { en: 'Fast Track', vi: 'Fast Track' },
  AirportPickup: { en: 'Airport Transfer', vi: 'Đưa đón sân bay' },
};

export default function OMSMoneyLedger({ orders, PARTNERS, language, onUpdateOrder }: OMSMoneyLedgerProps) {
  const isEn = language === 'EN';
  const [groupBy, setGroupBy] = useState<'month' | 'service'>('month');
  const [expandedReferrer, setExpandedReferrer] = useState<string | null>(null);
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  // One filter per section: a checkbox in one card must never silently filter another.
  const [onlyOwingReferral, setOnlyOwingReferral] = useState(true);
  const [onlyOwingPartner, setOnlyOwingPartner] = useState(true);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const countedOrders = useMemo(() => orders.filter((o) => !isRefunded(o)), [orders]);

  // ---- Referral payouts, grouped by the account that placed the order ----
  const referrerGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; orders: Order[]; totalVnd: number; paidVnd: number }>();

    for (const order of countedOrders) {
      const commission = readReferralCommission(order.details).vnd;
      if (commission <= 0) continue;

      const key = order.userEmail || order.userId || 'unknown';
      const label = order.userEmail || order.userId || (isEn ? 'Unknown account' : 'Không rõ tài khoản');
      const group = map.get(key) || { key, label, orders: [], totalVnd: 0, paidVnd: 0 };
      group.orders.push(order);
      group.totalVnd += commission;
      if ((order as any).referralPayoutStatus === 'Paid') group.paidVnd += commission;
      map.set(key, group);
    }

    return Array.from(map.values())
      .map((g) => ({ ...g, owingVnd: g.totalVnd - g.paidVnd }))
      .sort((a, b) => b.owingVnd - a.owingVnd || b.totalVnd - a.totalVnd);
  }, [countedOrders, isEn]);

  const visibleGroups = onlyOwingReferral ? referrerGroups.filter((g) => g.owingVnd > 0) : referrerGroups;
  const totalOwing = referrerGroups.reduce((sum, g) => sum + g.owingVnd, 0);

  // ---- Service partner payables, grouped by the partner the leg was dispatched to ----
  const partnerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of Object.values(PARTNERS || {})) {
      for (const p of list) map.set(p.id, p.name);
    }
    return map;
  }, [PARTNERS]);

  const partnerGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; legs: CostLeg[]; totalVnd: number; paidVnd: number }>();

    for (const order of countedOrders) {
      for (const leg of getCostLegs(order)) {
        if (leg.costVnd <= 0) continue;

        // Money owed with nobody named still has to appear, or it goes missing.
        const key = leg.partnerId || 'unassigned';
        const label = (leg.partnerId && partnerName.get(leg.partnerId))
          || (isEn ? 'No partner assigned' : 'Chưa phân công đối tác');

        const group = map.get(key) || { key, label, legs: [], totalVnd: 0, paidVnd: 0 };
        group.legs.push(leg);
        group.totalVnd += leg.costVnd;
        if (leg.isPaid) group.paidVnd += leg.costVnd;
        map.set(key, group);
      }
    }

    return Array.from(map.values())
      .map((g) => ({ ...g, owingVnd: g.totalVnd - g.paidVnd }))
      .sort((a, b) => b.owingVnd - a.owingVnd || b.totalVnd - a.totalVnd);
  }, [countedOrders, partnerName, isEn]);

  const visiblePartnerGroups = onlyOwingPartner ? partnerGroups.filter((g) => g.owingVnd > 0) : partnerGroups;
  const totalPartnerOwing = partnerGroups.reduce((sum, g) => sum + g.owingVnd, 0);

  // ---- Margin, by month or by service ----
  const marginRows = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sortKey: string; slice: Slice }>();

    for (const order of countedOrders) {
      let key: string;
      let label: string;
      let sortKey: string;

      if (groupBy === 'month') {
        const d = new Date(order.createdAt);
        if (Number.isNaN(d.getTime())) continue;
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        sortKey = key;
      } else {
        key = order.type;
        const names = SERVICE_LABELS[order.type];
        label = names ? (isEn ? names.en : names.vi) : order.type;
        sortKey = order.type;
      }

      const row = map.get(key) || { key, label, sortKey, slice: emptySlice() };
      addToSlice(row.slice, order);
      map.set(key, row);
    }

    const rows = Array.from(map.values());
    rows.sort((a, b) => (groupBy === 'month' ? b.sortKey.localeCompare(a.sortKey) : a.sortKey.localeCompare(b.sortKey)));
    return rows;
  }, [countedOrders, groupBy, isEn]);

  const grandTotal = useMemo(() => {
    const slice = emptySlice();
    for (const order of countedOrders) addToSlice(slice, order);
    return slice;
  }, [countedOrders]);

  /** One write, keyed so two legs of the same order can be saved independently. */
  const writePayout = async (savingKey: string, orderId: string, fields: Record<string, any>) => {
    if (!onUpdateOrder) return;
    setSaveError(null);
    setSavingIds((prev) => [...prev, savingKey]);
    try {
      const res = await onUpdateOrder(orderId, fields);
      if (res && !res.success) {
        setSaveError(res.error || (isEn ? 'Could not save' : 'Không lưu được'));
      }
    } finally {
      setSavingIds((prev) => prev.filter((k) => k !== savingKey));
    }
  };

  const setReferralPayout = (order: Order, paid: boolean) =>
    writePayout(`${order.id}::referral`, order.id, {
      referralPayoutStatus: paid ? 'Paid' : null,
      referralPaidAt: paid ? new Date().toISOString() : null,
      referralPaidBy: paid ? (auth.currentUser?.email || 'staff') : null,
    });

  const setSupplierPayout = (leg: CostLeg, paid: boolean) =>
    writePayout(`${leg.order.id}::supplier${leg.suffix}`, leg.order.id, {
      [`supplierPayoutStatus${leg.suffix}`]: paid ? 'Paid' : null,
      [`supplierPaidAt${leg.suffix}`]: paid ? new Date().toISOString() : null,
      [`supplierPaidBy${leg.suffix}`]: paid ? (auth.currentUser?.email || 'staff') : null,
    });

  const markReferralGroupPaid = async (groupOrders: Order[]) => {
    for (const order of groupOrders.filter((o) => (o as any).referralPayoutStatus !== 'Paid')) {
      await setReferralPayout(order, true);
    }
  };

  const markSupplierGroupPaid = async (legs: CostLeg[]) => {
    for (const leg of legs.filter((l) => !l.isPaid)) {
      await setSupplierPayout(leg, true);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* ---------- Referral payouts ---------- */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <HandCoins className="h-5 w-5 text-violet-600 shrink-0" />
            <div>
              <h3 className="font-display font-bold text-slate-800 text-base">
                {isEn ? 'Referral commission payouts' : 'Hoa hồng phải trả bên dẫn khách'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEn
                  ? 'Grouped by the account that placed the order. Mark each order once the money has left.'
                  : 'Gộp theo tài khoản đã đặt đơn. Đánh dấu từng đơn khi tiền đã chuyển đi.'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              {isEn ? 'Still owed' : 'Còn phải trả'}
            </span>
            <span className={`font-display font-black text-xl ${totalOwing > 0 ? 'text-violet-700' : 'text-emerald-700'}`}>
              {vnd(totalOwing)}
            </span>
          </div>
        </div>

        {saveError && (
          <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
            {saveError}
          </div>
        )}

        <label className="flex items-center space-x-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={onlyOwingReferral}
            onChange={() => setOnlyOwingReferral(!onlyOwingReferral)}
            className="h-3.5 w-3.5 rounded text-violet-600 border-slate-300 cursor-pointer"
          />
          <span className="text-[11px] font-semibold text-slate-600">
            {isEn ? 'Only show referrers still owed money' : 'Chỉ hiện bên còn nợ tiền'}
          </span>
        </label>

        {visibleGroups.length === 0 ? (
          <div className="px-4 py-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
            {onlyOwingReferral
              ? (isEn ? 'Nothing outstanding.' : 'Không còn khoản nào phải trả.')
              : (isEn ? 'No order carries a referral commission yet.' : 'Chưa có đơn nào có hoa hồng dẫn khách.')}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleGroups.map((group) => {
              const isOpen = expandedReferrer === group.key;
              const unpaidCount = group.orders.filter((o) => (o as any).referralPayoutStatus !== 'Paid').length;

              return (
                <div key={group.key} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedReferrer(isOpen ? null : group.key)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-xs block truncate">{group.label}</span>
                        <span className="text-[10px] text-slate-500">
                          {group.orders.length} {isEn ? 'orders' : 'đơn'}
                          {' · '}
                          {isEn ? 'total' : 'tổng'} {vnd(group.totalVnd)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`font-black font-mono text-sm ${group.owingVnd > 0 ? 'text-violet-700' : 'text-emerald-700'}`}>
                        {vnd(group.owingVnd)}
                      </span>
                      <span className="text-[9.5px] text-slate-400 block">
                        {group.owingVnd > 0
                          ? (isEn ? `${unpaidCount} unpaid` : `${unpaidCount} đơn chưa trả`)
                          : (isEn ? 'All settled' : 'Đã trả hết')}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-slate-100 border-t border-slate-200">
                      {unpaidCount > 0 && onUpdateOrder && (
                        <div className="px-4 py-2.5 bg-violet-50/50 flex justify-end">
                          <button
                            type="button"
                            onClick={() => markReferralGroupPaid(group.orders)}
                            disabled={savingIds.length > 0}
                            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                          >
                            {isEn
                              ? `Mark all ${unpaidCount} as paid`
                              : `Đánh dấu đã trả cả ${unpaidCount} đơn`}
                          </button>
                        </div>
                      )}

                      {group.orders.map((order) => {
                        const commission = readReferralCommission(order.details).vnd;
                        const isPaid = (order as any).referralPayoutStatus === 'Paid';
                        const isSaving = savingIds.includes(`${order.id}::referral`);
                        const paidAt = (order as any).referralPaidAt;

                        return (
                          <div key={order.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="font-mono text-[11px] font-bold text-slate-700 block truncate">{order.id}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(order.createdAt).toLocaleDateString(isEn ? 'en-GB' : 'vi-VN')}
                                {isPaid && paidAt && (
                                  <span className="text-emerald-600 font-semibold">
                                    {' · '}
                                    {isEn ? 'paid' : 'đã trả'} {new Date(paidAt).toLocaleDateString(isEn ? 'en-GB' : 'vi-VN')}
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono font-bold text-[11px] text-slate-800">{vnd(commission)}</span>
                              <button
                                type="button"
                                disabled={!onUpdateOrder || isSaving}
                                onClick={() => setReferralPayout(order, !isPaid)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {isPaid && <Check className="h-3 w-3 shrink-0" />}
                                <span>
                                  {isSaving
                                    ? (isEn ? 'Saving…' : 'Đang lưu…')
                                    : isPaid
                                      ? (isEn ? 'Paid' : 'Đã trả')
                                      : (isEn ? 'Mark paid' : 'Đánh dấu đã trả')}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Service partner payables ---------- */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <Truck className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-display font-bold text-slate-800 text-base">
                {isEn ? 'Service partner payables' : 'Tiền phải trả đối tác dịch vụ'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEn
                  ? 'Grouped by the partner the job was dispatched to. A combo order appears twice — one line per partner.'
                  : 'Gộp theo đối tác được giao việc. Đơn combo xuất hiện hai lần — mỗi đối tác một dòng.'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              {isEn ? 'Still owed' : 'Còn phải trả'}
            </span>
            <span className={`font-display font-black text-xl ${totalPartnerOwing > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {vnd(totalPartnerOwing)}
            </span>
          </div>
        </div>

        <label className="flex items-center space-x-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={onlyOwingPartner}
            onChange={() => setOnlyOwingPartner(!onlyOwingPartner)}
            className="h-3.5 w-3.5 rounded text-amber-600 border-slate-300 cursor-pointer"
          />
          <span className="text-[11px] font-semibold text-slate-600">
            {isEn ? 'Only show partners still owed money' : 'Chỉ hiện đối tác còn nợ tiền'}
          </span>
        </label>

        {visiblePartnerGroups.length === 0 ? (
          <div className="px-4 py-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
            {onlyOwingPartner
              ? (isEn ? 'Nothing outstanding.' : 'Không còn khoản nào phải trả.')
              : (isEn
                  ? 'No cost has been entered on any order yet, so there is nothing to pay out here.'
                  : 'Chưa đơn nào được nhập chi phí, nên chưa có khoản nào để trả.')}
          </div>
        ) : (
          <div className="space-y-2">
            {visiblePartnerGroups.map((group) => {
              const isOpen = expandedPartner === group.key;
              const unpaidCount = group.legs.filter((l) => !l.isPaid).length;

              return (
                <div key={group.key} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedPartner(isOpen ? null : group.key)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                      <div className="min-w-0">
                        <span className={`font-bold text-xs block truncate ${group.key === 'unassigned' ? 'text-rose-700' : 'text-slate-800'}`}>
                          {group.label}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {group.legs.length} {isEn ? 'jobs' : 'lượt việc'}
                          {' · '}
                          {isEn ? 'total' : 'tổng'} {vnd(group.totalVnd)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`font-black font-mono text-sm ${group.owingVnd > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {vnd(group.owingVnd)}
                      </span>
                      <span className="text-[9.5px] text-slate-400 block">
                        {group.owingVnd > 0
                          ? (isEn ? `${unpaidCount} unpaid` : `${unpaidCount} lượt chưa trả`)
                          : (isEn ? 'All settled' : 'Đã trả hết')}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-slate-100 border-t border-slate-200">
                      {unpaidCount > 0 && onUpdateOrder && (
                        <div className="px-4 py-2.5 bg-amber-50/50 flex justify-end">
                          <button
                            type="button"
                            onClick={() => markSupplierGroupPaid(group.legs)}
                            disabled={savingIds.length > 0}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                          >
                            {isEn
                              ? `Mark all ${unpaidCount} as paid`
                              : `Đánh dấu đã trả cả ${unpaidCount} lượt`}
                          </button>
                        </div>
                      )}

                      {group.legs.map((leg) => {
                        const savingKey = `${leg.order.id}::supplier${leg.suffix}`;
                        const isSaving = savingIds.includes(savingKey);
                        const serviceNames = SERVICE_LABELS[leg.serviceType];
                        const serviceLabel = serviceNames ? (isEn ? serviceNames.en : serviceNames.vi) : leg.serviceType;

                        return (
                          <div key={savingKey} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="font-mono text-[11px] font-bold text-slate-700 block truncate">
                                {leg.order.id}
                                {leg.suffix === 'Secondary' && (
                                  <span className="ml-1.5 text-[9px] font-sans font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                                    COMBO
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {serviceLabel}
                                {' · '}
                                {new Date(leg.order.createdAt).toLocaleDateString(isEn ? 'en-GB' : 'vi-VN')}
                                {leg.isPaid && leg.paidAt && (
                                  <span className="text-emerald-600 font-semibold">
                                    {' · '}
                                    {isEn ? 'paid' : 'đã trả'} {new Date(leg.paidAt).toLocaleDateString(isEn ? 'en-GB' : 'vi-VN')}
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono font-bold text-[11px] text-slate-800">{vnd(leg.costVnd)}</span>
                              <button
                                type="button"
                                disabled={!onUpdateOrder || isSaving}
                                onClick={() => setSupplierPayout(leg, !leg.isPaid)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer ${
                                  leg.isPaid
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {leg.isPaid && <Check className="h-3 w-3 shrink-0" />}
                                <span>
                                  {isSaving
                                    ? (isEn ? 'Saving…' : 'Đang lưu…')
                                    : leg.isPaid
                                      ? (isEn ? 'Paid' : 'Đã trả')
                                      : (isEn ? 'Mark paid' : 'Đánh dấu đã trả')}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Margin ---------- */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <Wallet className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-display font-bold text-slate-800 text-base">
                {isEn ? 'Margin' : 'Lãi'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEn
                  ? 'Paid orders only, refunds excluded. Figures are in VND, the currency actually charged.'
                  : 'Chỉ tính đơn đã thanh toán, bỏ đơn hoàn tiền. Số liệu tính bằng VNĐ — loại tiền thực sự thu.'}
              </p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setGroupBy('month')}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                groupBy === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{isEn ? 'By month' : 'Theo tháng'}</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('service')}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                groupBy === 'service' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{isEn ? 'By service' : 'Theo dịch vụ'}</span>
            </button>
          </div>
        </div>

        {grandTotal.missingCostCount > 0 && (
          <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {isEn
                ? `${grandTotal.missingCostCount} of ${grandTotal.orderCount} orders have no service partner cost entered, so every margin below is a ceiling rather than the real figure. Enter the cost on each order in Order Management.`
                : `${grandTotal.missingCostCount}/${grandTotal.orderCount} đơn chưa nhập chi phí đối tác dịch vụ, nên mọi con số lãi dưới đây là mức tối đa chứ chưa phải lãi thật. Nhập chi phí ở từng đơn trong tab Order Management.`}
            </p>
          </div>
        )}

        {marginRows.length === 0 ? (
          <div className="px-4 py-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
            {isEn ? 'No paid orders yet.' : 'Chưa có đơn đã thanh toán nào.'}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-200">
                  <th className="text-left py-2 pr-3">{groupBy === 'month' ? (isEn ? 'Month' : 'Tháng') : (isEn ? 'Service' : 'Dịch vụ')}</th>
                  <th className="text-right py-2 px-2">{isEn ? 'Orders' : 'Số đơn'}</th>
                  <th className="text-right py-2 px-2">{isEn ? 'Collected' : 'Tổng thu'}</th>
                  <th className="text-right py-2 px-2">{isEn ? 'Referral' : 'Hoa hồng'}</th>
                  <th className="text-right py-2 px-2">{isEn ? 'Partner cost' : 'Chi phí đối tác'}</th>
                  <th className="text-right py-2 pl-2">{isEn ? 'Margin' : 'Còn lại'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marginRows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-3 font-bold text-slate-800 whitespace-nowrap">
                      {row.label}
                      {row.slice.missingCostCount > 0 && (
                        <span className="ml-1.5 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {row.slice.missingCostCount} {isEn ? 'no cost' : 'thiếu chi phí'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-600">{row.slice.orderCount}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-800 whitespace-nowrap">{vnd(row.slice.revenueVnd)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-violet-700 whitespace-nowrap">
                      {row.slice.commissionVnd > 0 ? `-${vnd(row.slice.commissionVnd)}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-amber-700 whitespace-nowrap">
                      {row.slice.costVnd > 0 ? `-${vnd(row.slice.costVnd)}` : '—'}
                    </td>
                    <td className={`py-2.5 pl-2 text-right font-mono font-black whitespace-nowrap ${row.slice.marginVnd < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {vnd(row.slice.marginVnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td className="py-2.5 pr-3 font-black text-slate-900">{isEn ? 'All time' : 'Tổng cộng'}</td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-700">{grandTotal.orderCount}</td>
                  <td className="py-2.5 px-2 text-right font-mono font-black text-slate-900 whitespace-nowrap">{vnd(grandTotal.revenueVnd)}</td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-violet-700 whitespace-nowrap">
                    {grandTotal.commissionVnd > 0 ? `-${vnd(grandTotal.commissionVnd)}` : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                    {grandTotal.costVnd > 0 ? `-${vnd(grandTotal.costVnd)}` : '—'}
                  </td>
                  <td className={`py-2.5 pl-2 text-right font-mono font-black whitespace-nowrap ${grandTotal.marginVnd < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {vnd(grandTotal.marginVnd)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
