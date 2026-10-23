import type { MusicPlaylist } from "@entities/music/model/types";
import {
	usePublicMusicPlaylists,
	usePublicPlaybackDetail,
	usePublicPlaybackStatus,
} from "@features/music-player/api/queries";
import { createMusicSource } from "@features/music-player/lib/source";
import type { MusicPlaybackMode } from "@features/music-player/model/types";
import { Button } from "@violet/ui";
import { getPlayer, type Player } from "@violetjs/kite-player";
import { KitePlayer } from "@violetjs/kite-player/react";
import { RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import "@features/music-player/ui/music-player.css";

interface PlayerFailureProps {
	error: Error;
	loading: boolean;
	onRetry: () => void;
}

function PlayerFailure({ error, loading, onRetry }: PlayerFailureProps) {
	return (
		<div className="site-music-failure fixed bottom-24 left-4 z-60 flex max-w-80 items-center gap-3 rounded-xl border border-border bg-card p-3 lg:bottom-4">
			<div className="min-w-0 text-xs" role="status">
				<p className="font-medium">音乐暂时无法加载</p>
				<p className="mt-1 text-muted-foreground">{error.message}</p>
			</div>
			<Button
				size="sm"
				variant="outline"
				loading={loading}
				leftIcon={<RotateCcw className="size-3.5" />}
				onClick={onRetry}
			>
				重试
			</Button>
		</div>
	);
}

const PLAYBACK_MODE_KEY = "violet:music-playback-mode";

/** 模式与上次应用不一致时返回 true；队列里的旧权限判定随之作废，需重建。 */
function playbackModeChanged(mode: MusicPlaybackMode): boolean {
	try {
		if (globalThis.localStorage.getItem(PLAYBACK_MODE_KEY) === mode) return false;
		globalThis.localStorage.setItem(PLAYBACK_MODE_KEY, mode);
		return true;
	} catch {
		return false;
	}
}

interface MusicPlayerSessionProps {
	playlists: MusicPlaylist[];
	mode: MusicPlaybackMode;
	theme: "light" | "dark";
	onRetry: () => void;
}

function MusicPlayerSession({ playlists, mode, theme, onRetry }: MusicPlayerSessionProps) {
	const playerRef = useRef<Player | null>(null);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [loading, setLoading] = useState(false);
	const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);

	useEffect(() => () => playerRef.current?.pause(), []);

	useEffect(() => {
		let active = true;
		async function initialize() {
			if (!active) return;
			const player = getPlayer({ storageKey: "violet:music-player" });
			playerRef.current = player;
			player.setSource(createMusicSource(playlists, mode));
			const staleQueue =
				playbackModeChanged(mode) ||
				(player.state.playlist !== null &&
					!playlists.some((item) => item.id === player.state.playlist?.id));
			if (staleQueue) {
				player.pause();
				player.setQueue([], 0, null, false);
			}
			if (player.state.queue.length === 0) {
				for (const item of playlists) {
					const playlist = await player.loadPlaylist(item.id);
					if (!active) return;
					if (playlist.tracks.length === 0) continue;
					const first = Math.max(
						0,
						playlist.tracks.findIndex((track) => track.playable),
					);
					player.setQueue(
						playlist.tracks,
						first,
						{ id: playlist.id, name: playlist.name },
						false,
					);
					break;
				}
				if (player.state.queue.length === 0) throw new Error("展示歌单暂无曲目");
			}
			if (!active) return;
			setReady(true);
			setError(null);
		}
		// 跳过 StrictMode 首次 Effect 重放，避免重复装载歌单。
		queueMicrotask(() => {
			if (!active) return;
			setLoading(true);
			initialize()
				.catch((reason: unknown) => {
					if (active)
						setError(reason instanceof Error ? reason : new Error("音乐加载失败"));
				})
				.finally(() => {
					if (active) setLoading(false);
				});
		});
		return () => {
			active = false;
		};
	}, [playlists, mode]);

	// 当前曲目变化时查询解析结果，仅用于「仅试听」提示；不参与播放控制。
	const { data: playbackDetail } = usePublicPlaybackDetail(
		currentTrackId,
		currentTrackId !== null,
	);

	useEffect(() => {
		if (!ready) return;
		const player = playerRef.current;
		if (!player) return;
		let lastId: string | null = null;
		return player.subscribe((state) => {
			const id = state.current?.id ?? null;
			if (id === lastId) return;
			lastId = id;
			setCurrentTrackId(id);
		});
	}, [ready]);

	if (error) return <PlayerFailure error={error} loading={loading} onRetry={onRetry} />;
	if (!ready) return null;
	return (
		<>
			{playbackDetail?.trial && (
				<div
					className="site-music-trial fixed bottom-24 left-4 z-60 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground lg:bottom-24 lg:mb-12"
					role="status"
				>
					当前曲目仅提供试听片段
				</div>
			)}
			<KitePlayer
				className="site-music-player"
				playlists={playlists.map((item) => item.id).join(",")}
				position="left"
				theme={theme}
			/>
		</>
	);
}

/** 从公开展示列表装配播放器；手动重试创建新的初始化会话。 */
export default function MusicPlayerClient() {
	const { data: playlists, error, isFetching, refetch } = usePublicMusicPlaylists();
	const { data: playbackStatus, isError: playbackFailed } = usePublicPlaybackStatus();
	const { resolvedTheme } = useTheme();
	const [attempt, setAttempt] = useState(0);
	if (error && !playlists) {
		return <PlayerFailure error={error} loading={isFetching} onRetry={() => void refetch()} />;
	}
	if (!playlists?.length) return null;
	// 模式未确认前不初始化，避免 anonymous→account 闪切重建队列；查询失败按匿名兜底。
	if (!playbackStatus && !playbackFailed) return null;
	const mode: MusicPlaybackMode = playbackStatus?.mode ?? "anonymous";
	return (
		<MusicPlayerSession
			key={`${attempt}:${mode}`}
			playlists={playlists}
			mode={mode}
			theme={resolvedTheme === "dark" ? "dark" : "light"}
			onRetry={() => setAttempt((value) => value + 1)}
		/>
	);
}
