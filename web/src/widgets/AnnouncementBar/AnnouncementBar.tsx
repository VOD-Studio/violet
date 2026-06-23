import { useAnnouncements } from "@features/settings/api/queries";

/**
 * AnnouncementBar - 公告条（Nexus 视觉）
 *
 * 极简：dark 用霓虹底 + mono 字体；light 用 primary。
 * 无公告 return null（保持原行为）。
 */
const AnnouncementBar = () => {
	const { data } = useAnnouncements();
	if (!data?.length) return null;
	const top = data.find((a) => a.pinned) ?? data[0];
	if (!top) return null;

	return (
		<div className="border-b border-edge-hairline bg-primary/95 px-4 py-1.5 text-center font-mono text-xs text-primary-foreground dark:bg-neon-purple/20 dark:text-neon-purple">
			<span className="mr-2">◆</span>
			{top.content}
		</div>
	);
};

export default AnnouncementBar;
