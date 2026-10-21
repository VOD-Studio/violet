import type { MusicPlaylist } from "@entities/music/model/types";
import { usePublicMusicPlaylists } from "@features/music-player/api/queries";
import { createMusicSource } from "@features/music-player/lib/source";
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
		<div className="site-music-failure fixed right-4 bottom-24 z-60 flex max-w-80 items-center gap-3 rounded-xl border border-border bg-card p-3 lg:bottom-4">
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

interface MusicPlayerSessionProps {
	playlists: MusicPlaylist[];
	theme: "light" | "dark";
	onRetry: () => void;
}

function MusicPlayerSession({ playlists, theme, onRetry }: MusicPlayerSessionProps) {
	const playerRef = useRef<Player | null>(null);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => () => playerRef.current?.pause(), []);

	useEffect(() => {
		let active = true;
		async function initialize() {
			if (!active) return;
			const player = getPlayer({ storageKey: "violet:music-player" });
			playerRef.current = player;
			player.setSource(createMusicSource(playlists));
			if (
				player.state.playlist &&
				!playlists.some((item) => item.id === player.state.playlist?.id)
			) {
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
	}, [playlists]);

	if (error) return <PlayerFailure error={error} loading={loading} onRetry={onRetry} />;
	if (!ready) return null;
	return (
		<KitePlayer
			className="site-music-player"
			playlists={playlists.map((item) => item.id).join(",")}
			theme={theme}
			collapse="none"
		/>
	);
}

/** 从公开展示列表装配播放器；手动重试创建新的初始化会话。 */
export default function MusicPlayerClient() {
	const { data: playlists, error, isFetching, refetch } = usePublicMusicPlaylists();
	const { resolvedTheme } = useTheme();
	const [attempt, setAttempt] = useState(0);
	if (error && !playlists) {
		return <PlayerFailure error={error} loading={isFetching} onRetry={() => void refetch()} />;
	}
	if (!playlists?.length) return null;
	return (
		<MusicPlayerSession
			key={attempt}
			playlists={playlists}
			theme={resolvedTheme === "dark" ? "dark" : "light"}
			onRetry={() => setAttempt((value) => value + 1)}
		/>
	);
}
