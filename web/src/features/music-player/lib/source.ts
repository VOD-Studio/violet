import type { MusicPlaylist, MusicSong } from "@entities/music/model/types";
import {
	getPublicLyric,
	getPublicPlayback,
	getPublicPlaylistTracks,
	getPublicSong,
	musicResourceUrl,
} from "@features/music-player/api/client";
import { toPlayerLyrics } from "@features/music-player/lib/lyrics";
import type { Access, DataSource, Playlist, Track } from "@violetjs/kite-player";

const PAGE_SIZE = 100;

function toTrack(song: MusicSong): Track {
	const access: Access = song.fee === 1 ? "vip" : song.fee === 4 ? "paid" : "free";
	return {
		id: song.id,
		title: song.name,
		artists: song.artists ?? [],
		album: {
			id: song.album?.id ?? "",
			name: song.album?.name ?? "",
			cover: song.album?.cover_url ?? "",
		},
		durationMs: song.duration_ms ?? 0,
		access,
		// 匿名入口不使用站点会员权益；免费曲目仍由流端点按需解析最终地址。
		playable: access === "free",
		stream: musicResourceUrl(song.id, "stream"),
		lyrics: musicResourceUrl(song.id, "lyric"),
	};
}

/**
 * 将本站匿名接口适配为共享播放器的数据源，不读取后台账号状态。
 *
 * @param playlists - 当前公开展示列表；未展示的歌单不读取曲目
 * @returns 按页读取完整歌单、按播放请求解析音频的播放器数据源
 */
export function createMusicSource(playlists: readonly MusicPlaylist[]): DataSource {
	return {
		async playlist(id): Promise<Playlist> {
			const playlist = playlists.find((item) => item.id === id);
			if (!playlist) throw new Error("该歌单未公开展示或已停用");
			const tracks: Track[] = [];
			const seen = new Set<string>();
			let total: number | undefined;
			for (let page = 1; ; page += 1) {
				const response = await getPublicPlaylistTracks(id, { page, limit: PAGE_SIZE });
				const songs = response.data ?? [];
				total = response.pagination?.total ?? total;
				if (songs.length === 0) break;
				for (const song of songs) {
					if (seen.has(song.id))
						throw new Error("歌单分页返回了重复曲目，请检查 Kite 版本");
					seen.add(song.id);
					tracks.push(toTrack(song));
				}
				if (total !== undefined && tracks.length >= total) break;
				if (total === undefined && songs.length < PAGE_SIZE) break;
			}
			if (total !== undefined && tracks.length !== total) {
				throw new Error("歌单曲目未完整返回，请稍后重试");
			}
			return {
				id: playlist.id,
				name: playlist.name,
				cover: playlist.cover_url,
				trackCount: total ?? tracks.length,
				tracks,
			};
		},
		async track(id) {
			const [song, playback] = await Promise.all([getPublicSong(id), getPublicPlayback(id)]);
			const track = toTrack(song);
			track.playable = track.playable && playback.playable && playback.url !== null;
			return track;
		},
		async lyrics(track) {
			return toPlayerLyrics(await getPublicLyric(track.id), track.durationMs);
		},
	};
}
