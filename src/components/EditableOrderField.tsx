import React, { useState } from 'react';
import { Pencil } from 'lucide-react';

// NOTE: Callers MUST provide a unique key combining orderId and fieldPath (e.g. key={`${selectedOrder.id}::${fieldPath}`})
// when instantiating this component. The orderId ensures uncommitted drafts are cleared when switching orders,
// and the fieldPath ensures sibling fields have unique keys so React does not mis-reconcile components.

export type FieldInputType = 'text' | 'textarea' | 'date' | 'time' | 'email' | 'tel';

export interface EditableOrderFieldProps {
  key?: string;
  label: string;
  value: string;
  fieldPath: string;
  logLabel: string;
  language?: string;
  inputType?: FieldInputType;
  placeholder?: string;
  uppercase?: boolean;
  validate?: (val: string) => string | null;
  valueClassName?: string;
  containerClassName?: string;
  emptyText?: string;
  trailing?: React.ReactNode;
  onSave: (fieldPath: string, newValue: string, logLabel: string) => Promise<{ success: boolean; error?: string }>;
}

export default function EditableOrderField({
  label,
  value,
  fieldPath,
  logLabel,
  language = 'VI',
  inputType = 'text',
  placeholder,
  uppercase = false,
  validate,
  valueClassName,
  containerClassName,
  emptyText = 'N/A',
  trailing,
  onSave,
}: EditableOrderFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEn = language === 'EN';

  const handleStartEdit = () => {
    setDraft(value || '');
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const rawVal = draft.trim();
    const formattedVal = (uppercase && inputType !== 'date' && inputType !== 'time') ? rawVal.toUpperCase() : rawVal;

    if (validate) {
      const err = validate(formattedVal);
      if (err) {
        setError(err);
        return;
      }
    }

    const currentTrimmed = (value || '').trim();
    if (formattedVal === currentTrimmed) {
      setIsEditing(false);
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);

    const res = await onSave(fieldPath, formattedVal, logLabel);
    setIsSaving(false);

    if (res && res.success) {
      setIsEditing(false);
    } else {
      setError(res?.error || (isEn ? 'Failed to save changes' : 'Không lưu được thay đổi'));
    }
  };

  const defaultContainerClass = "flex items-center justify-between bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 font-mono min-h-[34px]";
  const textClass = inputType === 'textarea'
    ? (valueClassName || 'font-extrabold text-slate-800')
    : `truncate ${valueClassName || 'font-extrabold text-slate-800'}`;

  const isDateTime = inputType === 'date' || inputType === 'time';

  return (
    <div className="space-y-1">
      <span className="text-[9px] font-bold uppercase text-slate-400 block font-mono">
        {label}
      </span>
      {isEditing ? (
        <div className="space-y-1">
          <div className="flex items-start gap-1.5">
            {inputType === 'textarea' ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(uppercase ? e.target.value.toUpperCase() : e.target.value)}
                placeholder={placeholder}
                rows={3}
                className="w-full p-2 bg-white border border-indigo-400 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                autoFocus
              />
            ) : (
              <input
                type={inputType}
                value={draft}
                onChange={(e) => setDraft(uppercase && !isDateTime ? e.target.value.toUpperCase() : e.target.value)}
                placeholder={placeholder}
                className={`w-full px-2.5 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isDateTime ? '' : 'font-mono'}`}
                autoFocus
              />
            )}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[10px] rounded-lg cursor-pointer shrink-0"
              >
                {isSaving ? '...' : (isEn ? 'Save' : 'Lưu')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-bold text-[10px] rounded-lg cursor-pointer shrink-0"
              >
                {isEn ? 'Cancel' : 'Huỷ'}
              </button>
            </div>
          </div>
          {error && (
            <span className="text-[10px] text-rose-500 font-semibold block leading-tight">
              {error}
            </span>
          )}
        </div>
      ) : (
        <div className={containerClassName || defaultContainerClass}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
            <span className={textClass}>
              {value || emptyText}
            </span>
            <button
              type="button"
              onClick={handleStartEdit}
              className="p-0.5 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer shrink-0"
              title={isEn ? `Edit ${label}` : `Sửa ${label}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
      )}
    </div>
  );
}
