/**
 * AnnouncementGrid - 公告展示瀑布流（首页用）
 *
 * 消费 useAnnouncements，过滤出 display=card 和 display=article 的公告。
 * 用 CSS columns 实现瀑布流：卡片高度差异大时不会强制同高，
 * 避免短卡片下方留白。article 形态可点击跳转详情页，card 形态自包含。
 *
 * banner 形态不在此展示（由 AnnouncementBar 顶部横幅承担）。
 * 无公告时返回 null（不占首页空间）。
 */
import { useAnnouncements } from "@features/settings/api/queries";
import AnnouncementCard from "./AnnouncementCard";

export default function AnnouncementGrid() {
    const { data } = useAnnouncements();
    const items = (data ?? []).filter((a) => a.display === "card" || a.display === "article");

    if (items.length === 0) return null;

    return (
        <div className="gap-6 sm:columns-2 lg:columns-3 *:mb-6 *:break-inside-avoid">
            {items.map((a) => (
                <AnnouncementCard key={a.id} announcement={a} />
            ))}
        </div>
    );
}
