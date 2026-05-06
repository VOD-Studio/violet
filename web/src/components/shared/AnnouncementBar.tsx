/**
 * 公告栏组件
 * 显示在页面顶部，支持不同类型颜色和关闭功能
 */

import { useState, useEffect } from "react";
import {
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
} from "lucide-react";
import { useAnnouncements } from "@/features/announcements";
import type { Announcement, AnnouncementType } from "@/features/announcements";
import { cn } from "@/lib/utils";

/** 公告类型配置 */
const announcementConfig: Record<
  AnnouncementType,
  {
    icon: typeof Info;
    bgClass: string;
    textClass: string;
    iconClass: string;
  }
> = {
  info: {
    icon: Info,
    bgClass: "bg-blue-50 border-blue-200",
    textClass: "text-blue-900",
    iconClass: "text-blue-600",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-amber-50 border-amber-200",
    textClass: "text-amber-900",
    iconClass: "text-amber-600",
  },
  success: {
    icon: CheckCircle,
    bgClass: "bg-green-50 border-green-200",
    textClass: "text-green-900",
    iconClass: "text-green-600",
  },
  error: {
    icon: XCircle,
    bgClass: "bg-red-50 border-red-200",
    textClass: "text-red-900",
    iconClass: "text-red-600",
  },
};

/**
 * 获取已关闭公告的 ID 列表
 */
function getClosedAnnouncements(): number[] {
  try {
    const closed = localStorage.getItem("closed_announcements");
    return closed ? JSON.parse(closed) : [];
  } catch {
    return [];
  }
}

/**
 * 保存已关闭公告的 ID
 */
function saveClosedAnnouncement(id: number): void {
  try {
    const closed = getClosedAnnouncements();
    if (!closed.includes(id)) {
      closed.push(id);
      localStorage.setItem("closed_announcements", JSON.stringify(closed));
    }
  } catch {
    // localStorage 不可用时静默失败
  }
}

/**
 * 公告栏组件
 */
export function AnnouncementBar() {
  const { data, isLoading, error } = useAnnouncements();
  const [visibleAnnouncement, setVisibleAnnouncement] =
    useState<Announcement | null>(null);

  useEffect(() => {
    if (!data?.announcements || data.announcements.length === 0) {
      setVisibleAnnouncement(null);
      return;
    }

    const closedIds = getClosedAnnouncements();
    // 找到第一个未被关闭的公告
    const announcement = data.announcements.find(
      (a) => !closedIds.includes(a.id),
    );
    setVisibleAnnouncement(announcement ?? null);
  }, [data]);

  const handleClose = () => {
    if (visibleAnnouncement) {
      saveClosedAnnouncement(visibleAnnouncement.id);
      setVisibleAnnouncement(null);
    }
  };

  // 加载中、出错或没有公告时不显示
  if (isLoading || error || !visibleAnnouncement) {
    return null;
  }

  const config = announcementConfig[visibleAnnouncement.type] ?? announcementConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "border-b px-4 py-3",
        config.bgClass,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Icon className={cn("h-5 w-5 flex-shrink-0", config.iconClass)} />
        <div className="flex-1">
          <p className={cn("text-sm font-medium", config.textClass)}>
            {visibleAnnouncement.title}
          </p>
          {visibleAnnouncement.content && (
            <p className={cn("mt-1 text-sm", config.textClass, "opacity-90")}>
              {visibleAnnouncement.content}
            </p>
          )}
        </div>
        <button
          onClick={handleClose}
          className={cn(
            "rounded p-1 transition-colors",
            "hover:bg-black/10",
            config.textClass,
          )}
          aria-label="关闭公告"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}