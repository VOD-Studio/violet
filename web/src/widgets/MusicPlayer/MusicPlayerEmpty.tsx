import { Music } from "lucide-react";

/**
 * MusicPlayerEmpty - 无播放列表占位
 *
 * 首期 MusicPlayer 仅做骨架，没有真实歌单数据时显示此占位。
 * 后续接 GET /music/playlists/active 后替换为列表。
 */
const MusicPlayerEmpty = () => {
	return (
		<div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
			<Music className="h-12 w-12" />
			<p>暂无可用歌单</p>
		</div>
	);
};

export default MusicPlayerEmpty;
