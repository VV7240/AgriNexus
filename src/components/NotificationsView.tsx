import React from 'react';
import { Bell, CheckCheck, MessageSquareText } from 'lucide-react';
import { Language, NotificationItem } from '../types';
import { t } from '../utils/i18n';

interface NotificationsViewProps {
  language: Language;
  notifications: NotificationItem[];
  onMarkAllRead: () => Promise<void>;
  onInspectBatch: (batchId: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  language,
  notifications,
  onMarkAllRead,
  onInspectBatch,
}) => {
  const isHi = language === 'hi';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141A15]">
            {t(language, 'navNotifications')}
          </h1>
          <p className="text-sm text-[#4B554D] mt-1">
            {isHi
              ? 'स्पॉइलेज चेतावनी, क्लस्टर पुष्टि और ऑफ़लाइन किसानों के लिए SMS फॉलबैक लॉग'
              : 'Real-time spoilage risk alerts, cluster pooling confirmations, mandi price triggers, and SMS fallback delivery logs.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#D4D9D0] text-xs font-medium text-[#141A15] rounded-lg hover:bg-[#F7F8F6]"
        >
          <CheckCheck className="w-4 h-4 text-emerald-700" />
          {isHi ? 'सभी पठित चिह्नित करें' : 'Mark All Read'}
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-10 text-center text-sm text-[#647066]">
          {isHi ? 'कोई नई सूचना नहीं है।' : 'No notifications right now.'}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E6DF] rounded-xl divide-y divide-[#E2E6DF]">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                n.read ? 'bg-white' : 'bg-[#F9FAF8]'
              }`}
            >
              <div className="flex items-start gap-3">
                <Bell
                  className={`w-4 h-4 mt-1 shrink-0 ${
                    n.type === 'spoilage_alert' ? 'text-red-700' : 'text-emerald-700'
                  }`}
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-sm font-semibold text-[#141A15]">
                      {isHi ? n.titleHi : n.titleEn}
                    </h2>
                    {!n.read && (
                      <span className="text-[11px] font-semibold text-emerald-800">· Unread</span>
                    )}
                  </div>
                  <p className="text-sm text-[#4B554D]">{isHi ? n.messageHi : n.messageEn}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#647066] font-mono pt-1">
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    {n.smsDelivered && (
                      <span className="inline-flex items-center gap-1 text-emerald-800 font-sans">
                        <MessageSquareText className="w-3.5 h-3.5" />
                        SMS Fallback Delivered (+91-{n.smsPhone})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {n.batchId && (
                <button
                  type="button"
                  onClick={() => onInspectBatch(n.batchId!)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-[#D4D9D0] rounded-lg hover:bg-[#F7F8F6] whitespace-nowrap shrink-0 self-start"
                >
                  {t(language, 'inspectBatch')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
