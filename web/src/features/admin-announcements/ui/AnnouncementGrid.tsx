/**
 * AnnouncementGrid - 公告展示瀑布流（首页用）
 *
 * 消费 useAnnouncements，过滤出 display=card 和 display=article 的公告。
 * 用 CSS columns 实现瀑布流：卡片高度差异大时不会强制同高，
 * 避免短卡片下方留白。article 形态可点击跳转详情页，card 形态自包含。
 *
 * banner 形态不在此展示（由 AnnouncementBar 顶部横幅承担）。
 * 加载中展示骨架屏，失败展示错误空状态，无公告展示空提示。
 */
import { useAnnouncements } from "@features/settings/api/queries";
import Empty from "@shared/ui/empty";
import AnnouncementCard from "./AnnouncementCard";
import AnnouncementGridSkeleton from "./AnnouncementGridSkeleton";

export default function AnnouncementGrid() {
    const { data, isLoading, isError, error } = useAnnouncements();
    const items = (data ?? []).filter((a) => a.display === "card" || a.display === "article");

    if (isLoading) {
        return <AnnouncementGridSkeleton />;
    }

    if (isError) {
        return (
            <Empty
                title="加载失败"
                description={error instanceof Error ? error.message : "未知错误"}
                className="py-20"
            />
        );
    }

    if (items.length === 0) {
        return <Empty title="暂无公告" description="还没有任何公告" className="py-20" />;
    }

    return (
        <div className="gap-6 sm:columns-2 lg:columns-3 *:mb-6 *:break-inside-avoid">
            {items.map((a) => (
                <AnnouncementCard key={a.id} announcement={a} />
            ))}
        </div>
    );
}
