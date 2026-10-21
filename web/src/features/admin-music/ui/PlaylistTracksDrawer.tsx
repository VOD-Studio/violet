import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@violet/ui";
import { ChevronLeft, ChevronRight, Disc3, ExternalLink } from "lucide-react";
import { useState } from "react";
import { usePlaylistTracks } from "../api/queries";
import type { MusicFeaturedPlaylist, MusicPlaylist, MusicSong } from "../model/types";

/**
 * 歌单曲目列表弹窗 props。
 */
export interface PlaylistTracksDrawerProps {
	/** 当前选中的歌单；为 null 时不加载 */
	playlist: MusicFeaturedPlaylist | MusicPlaylist | null;
	/** 弹窗是否打开 */
	open: boolean;
	/** 打开状态改变事件 */
	onOpenChange: (open: boolean) => void;
}

/** 格式化毫秒为 mm:ss */
function formatDuration(ms?: number): string {
	if (!ms || ms <= 0) return "—";
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * 歌单曲目列表对话框，展示网易云歌曲名、歌手、专辑与时长。
 */
export function PlaylistTracksDrawer({ playlist, open, onOpenChange }: PlaylistTracksDrawerProps) {
	const [page, setPage] = useState(1);
	const limit = 20;

	const { data, isLoading } = usePlaylistTracks(
		playlist?.id ?? null,
		{ page, limit },
		{ enabled: open && Boolean(playlist?.id) },
	);

	const total = data?.pagination?.total ?? 0;
	const totalPages = Math.ceil(total / limit) || 1;

	return (
		<Dialog
			open={open}
			onOpenChange={(val) => {
				if (!val) setPage(1);
				onOpenChange(val);
			}}
		>
			<DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
				<DialogHeader>
					<div className="flex items-center gap-3">
						{playlist?.cover_url && (
							<img
								src={playlist.cover_url}
								alt={playlist.name}
								className="size-11 rounded-lg object-cover ring-1 ring-border/50"
							/>
						)}
						<div className="space-y-0.5">
							<DialogTitle className="flex items-center gap-2">
								<Disc3 className="size-5 text-primary" />
								<span>{playlist?.name ?? "歌单曲目"}</span>
								{playlist?.id && (
									<a
										href={`https://music.163.com/#/playlist?id=${playlist.id}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-muted-foreground hover:text-foreground"
										title="在网易云打开歌单"
									>
										<ExternalLink className="size-3.5" />
									</a>
								)}
							</DialogTitle>
							<DialogDescription>
								创建者：{playlist?.creator ?? "—"} · 共 {playlist?.track_count ?? 0}{" "}
								首歌曲
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="mt-2 min-h-0 flex-1 overflow-auto rounded-xl border border-border/50">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-12 text-center">#</TableHead>
								<TableHead className="min-w-48">歌曲标题</TableHead>
								<TableHead className="min-w-32">歌手</TableHead>
								<TableHead className="min-w-36">专辑</TableHead>
								<TableHead className="w-20 text-right">时长</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								Array.from({ length: 5 }).map((_, idx) => (
									<TableRow key={`skeleton-${idx}`}>
										<TableCell className="text-center">
											<div className="mx-auto h-4 w-4 animate-pulse rounded bg-muted" />
										</TableCell>
										<TableCell>
											<div className="h-4 w-36 animate-pulse rounded bg-muted" />
										</TableCell>
										<TableCell>
											<div className="h-4 w-24 animate-pulse rounded bg-muted" />
										</TableCell>
										<TableCell>
											<div className="h-4 w-28 animate-pulse rounded bg-muted" />
										</TableCell>
										<TableCell className="text-right">
											<div className="ml-auto h-4 w-10 animate-pulse rounded bg-muted" />
										</TableCell>
									</TableRow>
								))
							) : (data?.data?.length ?? 0) === 0 ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="h-32 text-center text-muted-foreground text-xs"
									>
										该歌单暂无曲目数据或未授权公开读取
									</TableCell>
								</TableRow>
							) : (
								data?.data?.map((song: MusicSong, idx: number) => {
									const artistNames =
										song.artists?.map((a) => a.name).join(" / ") || "未知歌手";
									const songIndex = (page - 1) * limit + idx + 1;

									return (
										<TableRow key={song.id} className="text-sm">
											<TableCell className="text-center font-mono text-muted-foreground text-xs">
												{songIndex}
											</TableCell>
											<TableCell className="font-medium">
												<div className="flex items-center gap-1.5">
													<span>{song.name}</span>
													<a
														href={`https://music.163.com/#/song?id=${song.id}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-muted-foreground hover:text-foreground"
														title="在网易云查看歌曲"
													>
														<ExternalLink className="size-3" />
													</a>
												</div>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{artistNames}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{song.album?.name || "—"}
											</TableCell>
											<TableCell className="text-right font-mono text-muted-foreground text-xs">
												{formatDuration(song.duration_ms)}
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>

				{/* 分页控制 */}
				{total > limit && (
					<div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs">
						<span className="text-muted-foreground">
							第 {page} 页 / 共 {totalPages} 页（共 {total} 首）
						</span>
						<div className="flex items-center gap-1">
							<Button
								size="sm"
								variant="outline"
								className="h-7 px-2"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
							>
								<ChevronLeft className="size-3.5" />
								上一页
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="h-7 px-2"
								disabled={page >= totalPages}
								onClick={() => setPage((p) => p + 1)}
							>
								下一页
								<ChevronRight className="size-3.5" />
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
