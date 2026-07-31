import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:MM" in 24h format e.g. "14:30"
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  isEn?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  error,
  isEn = true,
  id,
  placeholder = '--:-- --',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeColumn, setActiveColumn] = useState<'hour' | 'minute' | 'period'>('hour');

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasValue = !!value && value.includes(':');

  // Parse current hour, minute and period
  const [internalHour, internalMinute, internalPeriod] = (() => {
    if (!hasValue) {
      return ['12', '00', isEn ? 'PM' : 'CH'];
    }
    const [hStr, mStr] = value.split(':');
    const h24 = parseInt(hStr, 10);
    const m = mStr || '00';
    
    const period = h24 >= 12 ? (isEn ? 'PM' : 'CH') : (isEn ? 'AM' : 'SA');
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const h12Str = h12.toString().padStart(2, '0');
    return [h12Str, m, period];
  })();

  const updateTime = (h12: string, m: string, period: string) => {
    let h24 = parseInt(h12, 10);
    const isPM = period === 'PM' || period === 'CH';
    if (isPM) {
      if (h24 !== 12) h24 += 12;
    } else {
      if (h24 === 12) h24 = 0;
    }
    const h24Str = h24.toString().padStart(2, '0');
    const mStr = m.padStart(2, '0');
    onChange(`${h24Str}:${mStr}`);
  };

  const allHours = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const allMinutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const allPeriods = isEn ? ['AM', 'PM'] : ['SA', 'CH'];

  // Generate lists starting from the next value chronologically
  const hourIndex = allHours.indexOf(internalHour);
  const otherHours = hourIndex === -1 ? allHours : [
    ...allHours.slice(hourIndex + 1),
    ...allHours.slice(0, hourIndex)
  ];

  const minuteIndex = allMinutes.indexOf(internalMinute);
  const otherMinutes = minuteIndex === -1 ? allMinutes : [
    ...allMinutes.slice(minuteIndex + 1),
    ...allMinutes.slice(0, minuteIndex)
  ];

  const otherPeriods = allPeriods.filter(p => p !== internalPeriod);

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label id={id ? `lbl-${id}` : undefined} className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          type="text"
          id={id}
          readOnly
          value={hasValue ? `${internalHour}:${internalMinute} ${internalPeriod}` : ''}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full bg-slate-50 border rounded-xl pl-4 pr-11 py-3 text-slate-700 text-sm font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none cursor-pointer transition-all ${
            error ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
          } ${className}`}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 text-slate-400 hover:text-teal-600 p-1.5 rounded-lg transition-colors cursor-pointer"
          aria-label="Select time"
        >
          <Clock className="h-4 w-4" />
        </button>
      </div>

      {error && <span className="text-[11px] text-red-500 block mt-1">{error}</span>}

      {isOpen && (
        <div className="absolute z-50 bottom-full mb-2 w-64 bg-white rounded-md shadow-lg border border-slate-200 p-3 right-0 sm:left-0 select-none">
          <style>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          
          <div className="grid grid-cols-3 gap-2">
            {/* Hour Column */}
            <div className="flex flex-col items-stretch">
              <button
                type="button"
                onClick={() => setActiveColumn('hour')}
                className={`py-2 text-center text-sm font-bold text-white bg-[#0076FF] rounded-md transition-all ${
                  activeColumn === 'hour' 
                    ? 'ring-2 ring-slate-950 border border-slate-950' 
                    : 'border border-transparent'
                }`}
              >
                {internalHour}
              </button>
              
              <div 
                className="max-h-56 overflow-y-auto no-scrollbar pt-2 space-y-1 text-center"
                style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
              >
                {otherHours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      updateTime(h, internalMinute, internalPeriod);
                      setActiveColumn('hour');
                    }}
                    className="w-full py-1 text-sm font-medium text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minute Column */}
            <div className="flex flex-col items-stretch">
              <button
                type="button"
                onClick={() => setActiveColumn('minute')}
                className={`py-2 text-center text-sm font-bold text-white bg-[#0076FF] rounded-md transition-all ${
                  activeColumn === 'minute' 
                    ? 'ring-2 ring-slate-950 border border-slate-950' 
                    : 'border border-transparent'
                }`}
              >
                {internalMinute}
              </button>
              
              <div 
                className="max-h-56 overflow-y-auto no-scrollbar pt-2 space-y-1 text-center"
                style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
              >
                {otherMinutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      updateTime(internalHour, m, internalPeriod);
                      setActiveColumn('minute');
                    }}
                    className="w-full py-1 text-sm font-medium text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Period Column */}
            <div className="flex flex-col items-stretch">
              <button
                type="button"
                onClick={() => setActiveColumn('period')}
                className={`py-2 text-center text-sm font-bold text-white bg-[#0076FF] rounded-md transition-all ${
                  activeColumn === 'period' 
                    ? 'ring-2 ring-slate-950 border border-slate-950' 
                    : 'border border-transparent'
                }`}
              >
                {internalPeriod}
              </button>
              
              <div 
                className="max-h-56 overflow-y-auto no-scrollbar pt-2 space-y-1 text-center"
                style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
              >
                {otherPeriods.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      updateTime(internalHour, internalMinute, p);
                      setActiveColumn('period');
                    }}
                    className="w-full py-1 text-sm font-medium text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
