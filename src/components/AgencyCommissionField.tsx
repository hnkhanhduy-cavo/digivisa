import React from 'react';
import { Currency } from '../types';

interface AgencyCommissionFieldProps {
  /** Raw text as typed. Kept as a string so a half-typed number is not fought over. */
  value: string;
  onChange: (next: string) => void;
  currency: Currency;
  language?: string;
}

/**
 * Shown only to accounts carrying the `agency` custom claim. Whatever they enter is
 * added on top of the service price, in the currency currently on screen — the same
 * currency the rest of the form is quoted in, so there is nothing to convert in their head.
 */
export default function AgencyCommissionField({
  value,
  onChange,
  currency,
  language = 'EN',
}: AgencyCommissionFieldProps) {
  const isEn = language === 'EN';
  const symbol = currency === 'VND' ? '₫' : '$';

  return (
    <div className="p-4 bg-violet-50/60 border border-violet-200 rounded-2xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-violet-800">
          {isEn ? 'Your commission' : 'Hoa hồng của bạn'}
        </label>
        <span className="text-[9px] font-black uppercase tracking-wider text-violet-700 bg-violet-100 border border-violet-200 px-2 py-0.5 rounded-full">
          {isEn ? 'Agency' : 'Đại lý'}
        </span>
      </div>

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm pointer-events-none">
          {symbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            // Digits and at most one separator; anything else is a typo, not a price.
            const cleaned = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
            onChange(cleaned);
          }}
          placeholder={currency === 'VND' ? '500000' : '20'}
          className="w-full bg-white border border-violet-200 rounded-xl pl-8 pr-4 py-3 text-base sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all"
        />
      </div>

      <p className="text-[11px] text-violet-800/80 leading-relaxed">
        {isEn
          ? `Added to the total below, in ${currency}. Leave empty to take none.`
          : `Sẽ được cộng vào tổng tiền bên dưới, tính bằng ${currency === 'VND' ? 'VNĐ' : 'USD'}. Để trống nếu không lấy hoa hồng.`}
      </p>
    </div>
  );
}
