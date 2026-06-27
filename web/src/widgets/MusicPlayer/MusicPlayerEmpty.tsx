import Empty from "@shared/ui/empty";

/**
 * MusicPlayerEmpty - 无播放列表占位
 *
 * 首期 MusicPlayer 仅做骨架，没有真实歌单数据时显示此占位。
 * 后续接 GET /music/playlists/active 后替换为列表。
 */
const MusicPlayerEmpty = () => {
    return (
        <Empty
            size="lg"
            title="暂无可用歌单"
            description="还没有配置任何播放列表"
            className="py-12"
        />
    );
};

export default MusicPlayerEmpty;
