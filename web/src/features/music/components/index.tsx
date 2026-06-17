/**
 * 音乐播放器入口
 * 根据后台设置选择播放器版本，各组件独立管理自己的按钮
 *
 * 2.0 SSR：APlayer/Plyr 依赖浏览器 API（window/DOM），用 lazy 延迟加载，
 * 避免 SSR 阶段模块求值时崩溃。顶层不再静态 import 这两个组件。
 */

import { lazy, Suspense } from "react";
import { useMusicSettings, useActivePlaylists } from "../api";

// 浏览器专属：APlayer/Plyr 顶层访问 window，SSR 阶段不加载
const APlayerMusicPlayer = lazy(() =>
  import("./APlayerMusicPlayer").then((m) => ({
    default: m.APlayerMusicPlayer,
  })),
);
const PlyrMusicPlayer = lazy(() =>
  import("./PlyrMusicPlayer").then((m) => ({ default: m.PlyrMusicPlayer })),
);

/**
 * 音乐播放器入口组件
 * 只负责选择播放器版本，各组件独立管理按钮和状态
 */
export function MusicPlayer() {
  const { data: settings } = useMusicSettings();
  const { data: playlists } = useActivePlaylists();

  // 没有启用的歌单，不显示播放器
  if (!playlists || playlists.length === 0) {
    return null;
  }

  const version = settings?.player_version || "v1";
  const isV2 = version === "v2";

  // Convert to APlayer format
  const aplayerPlaylists = !isV2
    ? playlists.map((p) => ({
        id: p.id,
        server: p.platform,
        type: "playlist",
        playlistId: p.playlist_id,
        title: p.title,
        isActive: p.is_active,
      }))
    : null;

  return (
    <Suspense fallback={null}>
      {isV2 ? (
        <PlyrMusicPlayer playlists={playlists} />
      ) : (
        <APlayerMusicPlayer playlists={aplayerPlaylists ?? []} />
      )}
    </Suspense>
  );
}
