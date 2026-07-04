/**
 * AnnouncementGrid - 公告展示网格（首页用）
 *
 * 消费 useAnnouncements，过滤出 display=card 和 display=article 的公告，
 * 渲染为网格。article 形态也以事件票据卡片形式展示（点击跳转详情页），
 * 两态共用 AnnouncementCard。
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
                <AnnouncementCard key={a.id} announcement={a} />
            ))}
        </div>
    );
}
