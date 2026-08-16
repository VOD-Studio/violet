import { AnnouncementSkeleton } from "@features/lab/announcement/ui/AnnouncementSkeleton";
import { EditorialIndex } from "@features/lab/announcement/ui/EditorialIndex";
import { useAnnouncements } from "@features/settings/api/queries";
import Empty from "@shared/ui/empty";

/**
 * AnnouncementFeed - 首页公告区（编辑索引方向）
 *
 * 公告实验室选型落地：编辑索引方向（/lab/announcement）升为现役（/lab 索引页同款目录语言：栏头 + hairline 行条目 + 序号，字号 / 字重 / 摘要行做层级）。
 * banner 形态在此排除——顶部 AnnouncementBar 已承担，索引只收
 * card / article，避免同一条公告双曝光。排序权威是后端返回顺序
 * （sort_order ASC, created_at DESC），前端不重排（EditorialIndex
 * 纯渲染）。
 */
export default function AnnouncementFeed() {
	const { data, isLoading, isError, error } = useAnnouncements();
	const items = (data ?? []).filter((a) => a.display !== "banner");

	if (isLoading) {
		return <AnnouncementSkeleton direction="editorial" />;
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
		return (
			<Empty
				title="NO EVENTS"
				description="站点安静运行中，没有需要你知道的事。"
				className="py-20"
			/>
		);
	}

	return <EditorialIndex items={items} />;
}
