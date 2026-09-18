"use client";

import { useEffect } from "react";

export type WorldNotification = {
  id: string;
  kind: "info" | "success" | "error" | "level-up";
  title: string;
  detail?: string;
};

const styles: Record<WorldNotification["kind"], string> = {
  info: "border-[#6c8a73] bg-[#eef4df]",
  success: "border-[#4f772d] bg-[#e6f3c8]",
  error: "border-[#9b3d25] bg-[#ffe0c7]",
  "level-up": "border-[#d59424] bg-[#ffe28a]",
};

function NotificationItem({ notification, onDismiss }: { notification: WorldNotification; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timeout = setTimeout(() => onDismiss(notification.id), notification.kind === "level-up" ? 4500 : 3000);
    return () => clearTimeout(timeout);
  }, [notification.id, notification.kind, onDismiss]);

  return (
    <div role="status" className={`w-[min(88vw,360px)] rounded-xl border-2 px-4 py-2 text-center text-[#3f2d1d] shadow-xl ${styles[notification.kind]}`}>
      <div className="text-sm font-black sm:text-base">{notification.title}</div>
      {notification.detail && <div className="text-xs font-bold sm:text-sm">{notification.detail}</div>}
    </div>
  );
}

export default function WorldNotifications({ notifications, onDismiss }: { notifications: WorldNotification[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-40 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} onDismiss={onDismiss} />)}
    </div>
  );
}
