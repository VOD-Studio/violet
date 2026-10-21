import { useHasPermission } from "@/features/auth/hooks/usePermissions";
import {
	Badge,
	Button,
	Card,
	ConfirmDialog,
	Switch,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@violet/ui";
import { ArrowDown, ArrowUp, Disc3, ExternalLink, ListMusic, Music, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	useOrderFeaturedPlaylists,
	useRemoveFeaturedPlaylist,
	useSetFeaturedPlaylistEnabled,
} from "../api/queries";
import type { MusicFeaturedPlaylist } from "../model/types";

/**
 * 展示歌单列表组件 props。
 */
export interface FeaturedPlaylistsTableProps {
	/** 展示歌单列表数据 */
	playlists: MusicFeaturedPlaylist[];
	/** 加载状态 */
	isLoading?: boolean;
	/** 点击查看曲目时的回调 */
	onViewTracks: (playlist: MusicFeaturedPlaylist) => void;
	/** 点击添加歌单时的回调 */
	onAddClick?: () => void;
}

/**
 * 站点展示歌单管理列表，支持排序、公开开关切换、曲目查看与移除。
 */
export function FeaturedPlaylistsTable({
	playlists,
	isLoading,
	onViewTracks,
	onAddClick,
}: FeaturedPlaylistsTableProps) {
	const canManage = useHasPermission("music:manage");
	const toggleEnabledMutation = useSetFeaturedPlaylistEnabled();
	const orderMutation = useOrderFeaturedPlaylists();
	const removeMutation = useRemoveFeaturedPlaylist();

	const [deletingPlaylist, setDeletingPlaylist] = useState<MusicFeaturedPlaylist | null>(null);

	const handleToggleEnabled = async (item: MusicFeaturedPlaylist) => {
		try {
			await toggleEnabledMutation.mutateAsync({
				id: item.id,
				enabled: !item.enabled,
			});
			toast.success(
				item.enabled
					? `已停用歌单「${item.name}」公开展示`
					: `已启用歌单「${item.name}」公开展示`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "更新歌单启用状态失败";
			toast.error(message);
		}
	};

	const handleMove = async (index: number, direction: "up" | "down") => {
		const targetIndex = direction === "up" ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= playlists.length) return;

		const reordered = [...playlists];
		const itemA = reordered[index];
		const itemB = reordered[targetIndex];
		if (!itemA || !itemB) return;

		reordered[index] = itemB;
		reordered[targetIndex] = itemA;

		const ids = reordered.map((p) => p.id);
		try {
			await orderMutation.mutateAsync(ids);
			toast.success("歌单顺序已更新");
		} catch (error) {
			const message = error instanceof Error ? error.message : "调整歌单顺序失败";
			toast.error(message);
		}
	};

	const handleConfirmRemove = async () => {
		if (!deletingPlaylist) return;
		try {
			await removeMutation.mutateAsync(deletingPlaylist.id);
			toast.success(`已从站点展示列表中移除歌单「${deletingPlaylist.name}」`);
			setDeletingPlaylist(null);
		} catch (error) {
			const message = error instanceof Error ? error.message : "移除歌单失败";
			toast.error(message);
		}
	};

	const enabledCount = playlists.filter((p) => p.enabled).length;

	return (
		<Card className="flex flex-col overflow-hidden rounded-2xl border border-border shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
			<div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
				<div className="flex items-center gap-2">
					<ListMusic className="size-5 text-muted-foreground" />
					<h3 className="font-semibold text-base">站点展示歌单</h3>
					<span className="text-muted-foreground text-xs">
						（共 {playlists.length} 个，已启用 {enabledCount} 个）
					</span>
				</div>
			</div>

			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-16 text-center">顺序</TableHead>
							<TableHead className="min-w-64">歌单信息</TableHead>
							<TableHead className="w-32">创建者</TableHead>
							<TableHead className="w-24 text-center">曲目数</TableHead>
							<TableHead className="w-28 text-center">公开展示</TableHead>
							<TableHead className="w-36 text-right">操作</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							Array.from({ length: 3 }).map((_, idx) => (
								<TableRow key={`skeleton-${idx}`}>
									<TableCell className="text-center">
										<div className="mx-auto h-4 w-6 animate-pulse rounded bg-muted" />
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-3">
											<div className="size-10 animate-pulse rounded-lg bg-muted" />
											<div className="space-y-1.5">
												<div className="h-4 w-36 animate-pulse rounded bg-muted" />
												<div className="h-3 w-20 animate-pulse rounded bg-muted" />
											</div>
										</div>
									</TableCell>
									<TableCell>
										<div className="h-4 w-20 animate-pulse rounded bg-muted" />
									</TableCell>
									<TableCell className="text-center">
										<div className="mx-auto h-4 w-10 animate-pulse rounded bg-muted" />
									</TableCell>
									<TableCell className="text-center">
										<div className="mx-auto h-5 w-9 animate-pulse rounded-full bg-muted" />
									</TableCell>
									<TableCell className="text-right">
										<div className="ml-auto h-8 w-24 animate-pulse rounded bg-muted" />
									</TableCell>
								</TableRow>
							))
						) : playlists.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="h-48 text-center">
									<div className="flex flex-col items-center justify-center space-y-3">
										<div className="flex size-12 items-center justify-center rounded-full bg-muted">
											<Disc3 className="size-6 text-muted-foreground" />
										</div>
										<div className="space-y-1">
											<p className="font-medium text-foreground text-sm">
												暂无展示歌单
											</p>
											<p className="text-muted-foreground text-xs">
												可从绑定的网易云音乐库中导入，或直接输入公开歌单 ID
												添加
											</p>
										</div>
										{canManage && onAddClick && (
											<Button
												size="sm"
												variant="outline"
												onClick={onAddClick}
												className="mt-2"
											>
												添加展示歌单
											</Button>
										)}
									</div>
								</TableCell>
							</TableRow>
						) : (
							playlists.map((item, index) => (
								<TableRow key={item.id} className="group">
									{/* 排序微调按钮 */}
									<TableCell className="text-center">
										<div className="flex items-center justify-center gap-0.5">
											<Button
												variant="ghost"
												size="sm"
												className="size-7 p-0"
												disabled={
													!canManage ||
													index === 0 ||
													orderMutation.isPending
												}
												onClick={() => handleMove(index, "up")}
												title="上移"
											>
												<ArrowUp className="size-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="size-7 p-0"
												disabled={
													!canManage ||
													index === playlists.length - 1 ||
													orderMutation.isPending
												}
												onClick={() => handleMove(index, "down")}
												title="下移"
											>
												<ArrowDown className="size-3.5" />
											</Button>
										</div>
									</TableCell>

									{/* 歌单信息 */}
									<TableCell>
										<div className="flex items-center gap-3">
											{item.cover_url ? (
												<img
													src={item.cover_url}
													alt={item.name}
													className="size-11 rounded-lg object-cover ring-1 ring-border/50"
												/>
											) : (
												<div className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
													<Music className="size-5" />
												</div>
											)}
											<div className="space-y-0.5">
												<div className="flex items-center gap-1.5 font-medium text-sm">
													<span>{item.name}</span>
													<a
														href={`https://music.163.com/#/playlist?id=${item.id}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-muted-foreground hover:text-foreground"
														title="在网易云音乐打开"
													>
														<ExternalLink className="size-3.5" />
													</a>
												</div>
												<div className="font-mono text-muted-foreground text-xs">
													ID: {item.id}
												</div>
											</div>
										</div>
									</TableCell>

									{/* 创建者 */}
									<TableCell className="text-muted-foreground text-sm">
										{item.creator || "—"}
									</TableCell>

									{/* 曲目数 */}
									<TableCell className="text-center font-mono text-sm">
										<Badge variant="outline" className="font-normal text-xs">
											{item.track_count} 首
										</Badge>
									</TableCell>

									{/* 公开展示 Switch */}
									<TableCell className="text-center">
										<div className="flex items-center justify-center">
											<Switch
												checked={item.enabled}
												onCheckedChange={() => handleToggleEnabled(item)}
												disabled={
													!canManage || toggleEnabledMutation.isPending
												}
												aria-label={`切换歌单 ${item.name} 公开状态`}
											/>
										</div>
									</TableCell>

									{/* 操作列 */}
									<TableCell className="text-right">
										<div className="flex items-center justify-end gap-1.5">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => onViewTracks(item)}
												className="h-8 gap-1 text-xs"
											>
												<Disc3 className="size-3.5 text-muted-foreground" />
												曲目
											</Button>
											{canManage && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setDeletingPlaylist(item)}
													disabled={removeMutation.isPending}
													className="size-8 p-0 text-destructive hover:bg-destructive/10"
													title="移除歌单"
												>
													<Trash2 className="size-3.5" />
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* 移除歌单确认弹窗 */}
			<ConfirmDialog
				open={Boolean(deletingPlaylist)}
				onOpenChange={(open) => !open && setDeletingPlaylist(null)}
				onConfirm={handleConfirmRemove}
				title="确认从站点展示中移除歌单？"
				description={`移除「${deletingPlaylist?.name ?? ""}」只会取消本站的公开展示，不会对网易云原歌单产生任何更改。`}
				confirmLabel="移除歌单"
				loading={removeMutation.isPending}
			/>
		</Card>
	);
}
