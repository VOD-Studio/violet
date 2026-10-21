import {
	useFeaturedPlaylists,
	useMusicAccount,
	useMusicStatus,
} from "@features/admin-music/api/queries";
import type { MusicFeaturedPlaylist, MusicPlaylist } from "@features/admin-music/model/types";
import { AddPlaylistDialog } from "@features/admin-music/ui/AddPlaylistDialog";
import { FeaturedPlaylistsTable } from "@features/admin-music/ui/FeaturedPlaylistsTable";
import { MusicAccountCard } from "@features/admin-music/ui/MusicAccountCard";
import { MusicLoginQrDialog } from "@features/admin-music/ui/MusicLoginQrDialog";
import { PlaylistTracksDrawer } from "@features/admin-music/ui/PlaylistTracksDrawer";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@violet/ui";
import { Plus } from "lucide-react";
import { useState } from "react";

/**
 * /admin/music - 站点音乐管理
 *
 * 聚合 Kite 音乐服务连通性测试、站点网易云账号扫码连接与全站展示歌单管理（排序、启停、曲目查看与移除）。
 */
function AdminMusicPage() {
	const canManage = useHasPermission("music:manage");

	const { data: status, isLoading: isStatusLoading } = useMusicStatus();
	const { data: account, isLoading: isAccountLoading } = useMusicAccount();
	const { data: playlists = [], isLoading: isPlaylistsLoading } = useFeaturedPlaylists();

	// 弹窗状态管理
	const [qrDialogOpen, setQrDialogOpen] = useState(false);
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [inspectingPlaylist, setInspectingPlaylist] = useState<
		MusicFeaturedPlaylist | MusicPlaylist | null
	>(null);

	return (
		<PageShell
			title="音乐管理"
			description="管理全站音乐服务连通性、绑定网易云账号并维护前台公开展示歌单。"
			action={
				canManage ? (
					<Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
						<Plus className="size-4" />
						添加展示歌单
					</Button>
				) : null
			}
		>
			{/* Kite 服务端状态与站点网易云账号卡片 */}
			<MusicAccountCard
				status={status}
				account={account}
				isStatusLoading={isStatusLoading}
				isAccountLoading={isAccountLoading}
				onOpenQrLogin={() => setQrDialogOpen(true)}
			/>

			{/* 站点展示歌单管理表格 */}
			<FeaturedPlaylistsTable
				playlists={playlists}
				isLoading={isPlaylistsLoading}
				onViewTracks={(pl) => setInspectingPlaylist(pl)}
				onAddClick={() => setAddDialogOpen(true)}
			/>

			{/* 扫码登录网易云弹窗 */}
			<MusicLoginQrDialog open={qrDialogOpen} onOpenChange={setQrDialogOpen} />

			{/* 添加展示歌单弹窗 */}
			<AddPlaylistDialog
				open={addDialogOpen}
				onOpenChange={setAddDialogOpen}
				account={account}
				featuredPlaylists={playlists}
				onOpenQrLogin={() => setQrDialogOpen(true)}
			/>

			{/* 歌单曲目抽屉/对话框 */}
			<PlaylistTracksDrawer
				playlist={inspectingPlaylist}
				open={Boolean(inspectingPlaylist)}
				onOpenChange={(open) => !open && setInspectingPlaylist(null)}
			/>
		</PageShell>
	);
}

export const Route = createFileRoute("/admin/music")({
	component: AdminMusicPage,
});
