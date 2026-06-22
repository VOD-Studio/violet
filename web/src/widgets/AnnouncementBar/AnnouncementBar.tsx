import { useAnnouncements } from "@features/settings/api/queries";

/**
 * AnnouncementBar - 公告条
 *
 * 显示生效公告：优先取置顶的，无则取第一条。
 * 无公告时不渲染（return null），避免占用空间。
 * SSR 已预取公告数据，无 loading 闪烁。
 */
const AnnouncementBar = () => {
	const { data } = useAnnouncements();

	if (!data?.length) return null;

	const top = data.find((a) => a.pinned) ?? data[0];
	if (!top) return null;

	return (
		<div className="bg-primary text-primary-foreground text-center text-sm py-2 px-4">
			{top.content}
		</div>
	);
};

export default AnnouncementBar;
