import React, { useState } from 'react';
import { motion } from 'motion/react';
import { HelpCircle, ChevronDown, BookOpen, ShieldCheck, Mail, Phone, Plane, Sparkles } from 'lucide-react';
import { Language } from '../utils/translations';

interface FaqsProps {
  language?: Language;
}

export default function Faqs({ language = 'EN' }: FaqsProps) {
  const [activeCategory, setActiveCategory] = useState<'visa' | 'fasttrack' | 'pickup'>('visa');
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const isEn = language === 'EN';

  const faqData = {
    EN: {
      visa: [
        {
          q: "What is the DigiVisa electronic ETA authorization code?",
          a: "DigiVisa operates direct priority APIs syncing with global immigration manifests. The Electronic Travel Authorization (eTA) registry lets you complete pre-entry screen procedures before flight. Upon boarding, flight systems verify your biometrics directly, speeding up arrival."
        },
        {
          q: "How long does Super Express processing take?",
          a: "Under the Super Express pipeline, a specialized visa review officer secures authorization coordinates inside of 4 hours. Available 24 hours a day, 365 days a year for urgent flights."
        },
        {
          q: "Are the visa fees refundable if my flight is cancelled?",
          a: "Government administrative fees are non-refundable once authorized by immigration. However, our concierge handling fees are fully refunded or can be transferred to new flight dates within 12 months."
        },
        {
          q: "Do I need to print out the electronic visa clearance code?",
          a: "Printing is highly recommended, but not strictly mandatory. You can scan the unique digital barcode on your mobile device at electronic airport biometrics terminals."
        }
      ],
      fasttrack: [
        {
          q: "Where does the VIP Liaison assistant meet me on arrival?",
          a: "Your dedicated assistant awaits you directly at the aircraft exit gate aerobridge/jetway as you leave the cabin. They hold an electronic tablet marked with your primary passenger board name."
        },
        {
          q: "Can the concierge manage luggage retrievals for my family?",
          a: "Yes. Our assistants coordinate directly with terminal luggage porters. You bypass general carousel queues, relaxing in the diplomatic transfer suite while porters gather and bag-tag all luggage."
        },
        {
          q: "Is immigration line bypass legal?",
          a: "Absolutely. DigiVisa works in official agreement with airport authority bodies and diplomatic teams. VIP Fast Track bookings utilize dedicated official channels reserved for diplomatic, sovereign, and private tier clearances."
        }
      ],
      pickup: [
        {
          q: "What happens if my inbound flight lands late?",
          a: "Our dispatch systems connect with live radar tracking APIs. If your flight is delayed or redirected, your driver is reallocated automatically based on the updated touchdown timestamp. There are no wait charges."
        },
        {
          q: "Where does the driver greeter stand?",
          a: "The greeter stands in the Arrivals Hall, immediately after you exit through customs. They hold a clean digital tablet with your name clearly visible. Driver contact details are SMS-dispatched 2 hours on flight wheels-down."
        },
        {
          q: "How many suitcases can a Premium SUV carry?",
          a: "A Premium Comfort SUV safely fits up to 6 adult passengers and up to 5 large suitcases comfortably. For groups with heavier baggage, we suggest choosing our Executive Business Van."
        }
      ]
    },
    VI: {
      visa: [
        {
          q: "Mã chấp thuận điện tử DigiVisa ETA là gì?",
          a: "DigiVisa hoạt động thông qua kết nối API ưu tiên trực tiếp tới hệ thống kiểm soát nhập cảnh. Mã khai báo điện tử (eTA) cho phép quý khách làm thủ tục sàng lọc trước khi bay. Khi lên máy bay, hãng hàng không sẽ kiểm tra thông tin sinh trắc trực tiếp, giúp đẩy nhanh quá trình làm thủ tục khi hạ cánh."
        },
        {
          q: "Dịch vụ xử lý siêu khẩn (Super Express) mất bao lâu?",
          a: "Trong quy trình siêu khẩn, các chuyên viên duyệt hồ sơ sẽ cấp mã chấp thuận trong vòng dưới 4 tiếng. Hoạt động 24/7/365 phục vụ các chuyến bay gấp."
        },
        {
          q: "Tôi có được hoàn phí visa nếu chuyến bay bị hủy không?",
          a: "Lệ phí hành chính của chính phủ không thể hoàn lại sau khi đã được cơ quan xuất nhập cảnh duyệt. Tuy nhiên, phí dịch vụ hỗ trợ của chúng tôi sẽ được hoàn trả đầy đủ hoặc được bảo lưu để chuyển sang ngày bay mới trong vòng 12 tháng."
        },
        {
          q: "Tôi có cần in mã công văn nhập cảnh điện tử ra giấy không?",
          a: "Việc in ra giấy được khuyến khích nhưng không bắt buộc. Quý khách có thể quét mã vạch kỹ thuật số trực tiếp trên điện thoại tại các quầy sinh trắc học ở sân bay."
        }
      ],
      fasttrack: [
        {
          q: "Nhân viên hỗ trợ VIP đón tôi ở đâu khi đến sân bay?",
          a: "Nhân viên đón tiễn của chúng tôi sẽ đợi sẵn ngay tại cửa ra máy bay (ống lồng) ngay khi quý khách rời khoang hành khách. Họ sẽ cầm bảng tên điện tử hiển thị tên quý khách."
        },
        {
          q: "Nhân viên có hỗ trợ nhận hành lý ký gửi cho gia đình tôi không?",
          a: "Có. Nhân viên đón tiễn sẽ phối hợp với đội ngũ khuân vác tại nhà ga. Quý khách có thể bỏ qua hàng dài chờ đợi tại băng chuyền và thư giãn tại phòng chờ VIP trong khi nhân viên lấy hành lý cho quý khách."
        },
        {
          q: "Việc đi làn ưu tiên để bỏ qua hàng chờ nhập cảnh có đúng quy định không?",
          a: "Hoàn toàn đúng quy định. DigiVisa hợp tác chính thức với các ban quản lý sân bay và cơ quan ngoại giao. Các đặt chỗ VIP Fast Track sử dụng các làn nội bộ dành riêng cho khách ngoại giao và khách VIP."
        }
      ],
      pickup: [
        {
          q: "Nếu chuyến bay hạ cảnh muộn thì tài xế có đợi không?",
          a: "Hệ thống điều phối kết nối trực tiếp với radar hàng không. Nếu chuyến bay bị trễ, tài xế sẽ tự động được xếp lịch lại dựa trên giờ hạ cánh thực tế mà không tính thêm phí chờ."
        },
        {
          q: "Tài xế đón khách sẽ đứng ở đâu?",
          a: "Tài xế sẽ đứng ở Sảnh Đón, ngay sau khi quý khách đi qua cửa hải quan. Họ sẽ cầm bảng tên điện tử rõ ràng. Thông tin tài xế sẽ được gửi qua SMS cho quý khách trước khi hạ cánh 2 giờ."
        },
        {
          q: "Một chiếc SUV cao cấp có thể chứa được bao nhiêu vali?",
          a: "Một chiếc SUV cao cấp có thể chở tối đa 6 hành khách người lớn và tối đa 5 vali cỡ lớn một cách thoải mái. Đối với nhóm đông khách và nhiều hành lý, chúng tôi khuyên dùng xe Limousine VIP 16 chỗ."
        }
      ]
    }
  };

  const currentFaqs = faqData[language][activeCategory];

  return (
    <div className="max-w-4xl mx-auto px-4" id="faqs-container">
      {/* Head banner */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight">
          {isEn ? 'Support Desk & FAQs' : 'Trung tâm Hỗ trợ & Hỏi đáp'}
        </h1>
        <p className="text-slate-500 text-sm mt-2">
          {isEn 
            ? 'Everything you need to know about immigration permits, speedy VIP channels, and highway chauffeur transfers.'
            : 'Tất cả thông tin bạn cần biết về thủ tục nhập cảnh, làn ưu tiên VIP và dịch vụ xe riêng đưa đón sân bay.'}
        </p>
      </div>

      {/* Categories Toggle tab */}
      <div className="flex bg-slate-100 border border-slate-200/60 p-1.5 rounded-2xl max-w-xl mx-auto mb-8">
        {[
          { id: 'visa', label: isEn ? '📋 Visa Clearance' : '📋 Thủ tục Visa' },
          { id: 'fasttrack', label: isEn ? '⚡ Fast Track VIP' : '⚡ Nhập Cảnh VIP' },
          { id: 'pickup', label: isEn ? '🚖 Airport Pickup' : '🚖 Xe Sân Bay' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategory(cat.id as any);
              setOpenIndex(0);
            }}
            className={`flex-1 text-center py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-[#0B132B] text-teal-400 shadow-md font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left pane: Quick support block */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-[#0B132B] text-white rounded-2xl p-6 border border-slate-800 space-y-4 shadow-sm">
            <h3 className="font-display font-bold text-base flex items-center text-teal-400">
              <Sparkles className="h-4.5 w-4.5 mr-2 text-teal-400" />
              <span>{isEn ? 'Need Live Help?' : 'Cần hỗ trợ trực tiếp?'}</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isEn
                ? 'If your flight departs in under 6 hours and you have not received your clearance logs, call our urgent concierge desk instantly.'
                : 'Nếu chuyến bay khởi hành dưới 6 tiếng nữa và bạn chưa có thông tin công văn, hãy gọi cho hotline hỗ trợ khẩn cấp.'}
            </p>

            <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center space-x-2.5">
                <Phone className="h-4 w-4 text-slate-400" />
                <span className="font-mono text-slate-200 font-bold">+18005558472</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-slate-200">hotline@digivisa.gov</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Plane className="h-4 w-4 text-slate-400 animate-pulse" />
                <span className="text-emerald-400 font-bold">
                  {isEn ? 'Immigration Gate-3000 Open' : 'Quầy xuất nhập cảnh mở cửa'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 text-xs text-slate-500 space-y-2 leading-relaxed">
            <div className="flex items-center text-slate-800 font-bold">
              <ShieldCheck className="h-4 w-4 text-emerald-500 mr-2 shrink-0" />
              <span>{isEn ? 'Sovereign Security Registry' : 'Cơ chế Bảo mật Tuyệt đối'}</span>
            </div>
            <p>
              {isEn
                ? 'Your biometric data passport uploads are encrypted using military-grade bank networks and automatically deleted within 48 hours of your verified arrival landing stamp.'
                : 'Ảnh chụp hộ chiếu và dữ liệu sinh trắc của bạn được mã hóa bằng giao thức cấp quân đội và tự động xóa sau 48 tiếng kể từ khi nhập cảnh thành công.'}
            </p>
          </div>
        </div>

        {/* Right pane: FAQ accordions list */}
        <div className="md:col-span-2 space-y-3.5">
          {currentFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="bg-white border border-slate-150 rounded-xl overflow-hidden shadow-sm transition-all text-left"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
                >
                  <span className="font-display font-medium text-slate-800 text-xs sm:text-sm pr-4">
                    {faq.q}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-600' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-slate-500 leading-relaxed border-t border-slate-100 bg-slate-50/20">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
