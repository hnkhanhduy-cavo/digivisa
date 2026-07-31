import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, FileWarning, HardDriveUpload } from 'lucide-react';
import { Language } from '../utils/translations';

export interface UploadErrorModalData {
  isOpen: boolean;
  type: 'format' | 'size';
  fileName: string;
  fileSizeMb?: string;
  uploadType: 'passport' | 'photo';
}

interface UploadErrorModalProps {
  data: UploadErrorModalData | null;
  onClose: () => void;
  language: Language;
}

export default function UploadErrorModal({ data, onClose, language }: UploadErrorModalProps) {
  if (!data || !data.isOpen) return null;

  const isEn = language === 'EN';
  const isFormatError = data.type === 'format';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          className="relative w-full max-w-md bg-white border border-rose-100 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 text-slate-800"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Icon header */}
          <div className="flex flex-col items-center text-center space-y-3 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-inner">
              {isFormatError ? <FileWarning className="h-7 w-7" /> : <HardDriveUpload className="h-7 w-7" />}
            </div>
            
            <div className="space-y-1">
              <span className="inline-block px-2.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                {isEn ? 'Upload Restriction' : 'Yêu Cầu Tệp Không Đạt'}
              </span>
              <h3 className="text-xl font-bold font-display text-slate-900">
                {isFormatError
                  ? (isEn ? 'Invalid File Format' : 'Định Dạng Tệp Không Hợp Lệ')
                  : (isEn ? 'File Size Exceeds 2MB Limit' : 'Dung Lượng Tệp Vượt Quá 2MB')}
              </h3>
            </div>
          </div>

          {/* Detailed Explanation */}
          <div className="bg-rose-50/50 border border-rose-200/60 rounded-2xl p-4 mb-6 space-y-2 text-xs leading-relaxed text-slate-700">
            <div className="font-mono text-[11px] font-bold text-slate-800 truncate border-b border-rose-200/60 pb-1.5 mb-1.5 flex items-center justify-between">
              <span>📄 {data.fileName}</span>
              {data.fileSizeMb && <span className="text-rose-600 text-[10px]">({data.fileSizeMb} MB)</span>}
            </div>

            {isFormatError ? (
              <p>
                {isEn
                  ? 'Only image files in JPG, JPEG, or PNG format are supported. Please convert or re-select a supported photo.'
                  : 'Hệ thống chỉ chấp nhận định dạng ảnh JPG, JPEG hoặc PNG. Vui lòng kiểm tra lại định dạng tệp của bạn (Không hỗ trợ PDF, ZIP hoặc các định dạng khác).'}
              </p>
            ) : (
              <p>
                {isEn
                  ? `The selected file size is ${data.fileSizeMb} MB, which exceeds the maximum limit of 2.00 MB. Please compress or choose a smaller image.`
                  : `Dung lượng tệp bạn chọn là ${data.fileSizeMb} MB, vượt quá giới hạn tối đa 2MB cho phép. Vui lòng nén hoặc chọn ảnh dung lượng nhỏ hơn.`}
              </p>
            )}

            <div className="pt-1 flex items-center space-x-1.5 text-[10.5px] font-bold text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span>
                {isEn 
                  ? 'Accepted formats: .JPG, .JPEG, .PNG | Max size: 2.00 MB'
                  : 'Định dạng hỗ trợ: .JPG, .JPEG, .PNG | Dung lượng tối đa: 2.00 MB'}
              </span>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={onClose}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
          >
            <span>{isEn ? 'Got It & Choose Another File' : 'Đã Hiểu & Chọn Ảnh Khác'}</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
