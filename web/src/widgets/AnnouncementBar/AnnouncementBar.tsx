import { useAnnouncements } from "@features/settings/api/queries";

/**
 * AnnouncementBar - 公告条（柔和阅读风）
 *
 * 简洁 primary 底 + 居中文字。无公告 return null。
 */
const AnnouncementBar = () => {
	const { data } = useAnnouncements();
	if (!data?.length) return null;
	const top = data.find((a) => a.pinned) ?? data[0];
	if (!top) return null;

	return (
		<div className="bg-primary px-4 py-1.5 text-center text-xs text-primary-foreground">
			{top.content}
		</div>
	);
};

export default AnnouncementBar;
