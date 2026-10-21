import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Segmented,
	type SegmentedItem,
} from "@violet/ui";
import {
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Headphones,
	ListPlus,
	Music,
	Plus,
	Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAddFeaturedPlaylist, useSearchMusicPlaylists, useUserPlaylists } from "../api/queries";
import type { MusicAccount, MusicFeaturedPlaylist, MusicPlaylist } from "../model/types";

/**
 * 添加展示歌单对话框 props。
 */
export interface AddPlaylistDialogProps {
	/** 对话框是否打开 */
	open: boolean;
	/** 打开状态改变事件 */
	onOpenChange: (open: boolean) => void;
	/** 站点网易云账号连接状态 */
	account?: MusicAccount;
	/** 当前已加入展示的歌单列表，用于判断是否已添加 */
	featuredPlaylists: MusicFeaturedPlaylist[];
	/** 打开扫码登录弹窗的回调 */
	onOpenQrLogin: () => void;
}

type AddPlaylistTab = "library" | "manual";

const SEGMENTS: SegmentedItem<AddPlaylistTab>[] = [
	{
		value: "library",
		label: "从我的网易云歌单",
		icon: <Headphones className="size-4" />,
	},
	{
		value: "manual",
		label: "按 ID 或关键字搜索",
		icon: <Search className="size-4" />,
	},
];

/**
 * 添加展示歌单对话框，支持从绑定的账号歌单库选入，或直接输入 ID 与关键字搜索公开歌单。
 */
export function AddPlaylistDialog({
	open,
	onOpenChange,
	account,
	featuredPlaylists,
	onOpenQrLogin,
}: AddPlaylistDialogProps) {
	const addMutation = useAddFeaturedPlaylist();

	// 当前激活分段："library" | "manual"
	const isConnected = account?.state === "connected";
	const [activeTab, setActiveTab] = useState<AddPlaylistTab>("library");

	// Tab 1: 账号歌单库分页
	const [libraryPage, setLibraryPage] = useState(1);
	const libraryLimit = 10;
	const { data: userPlaylistsData, isLoading: isLibraryLoading } = useUserPlaylists(
		{ page: libraryPage, limit: libraryLimit },
		{ enabled: open && isConnected },
	);
	const libraryTotal = userPlaylistsData?.pagination?.total ?? 0;
	const libraryTotalPages = Math.ceil(libraryTotal / libraryLimit) || 1;

	// Tab 2: 手动输入 ID 或搜索
	const [inputPlaylistId, setInputPlaylistId] = useState("");
	const [searchKeyword, setSearchKeyword] = useState("");
	const [searchSubmitted, setSearchSubmitted] = useState("");
	const [searchPage, setSearchPage] = useState(1);

	const { data: searchResultsData, isLoading: isSearchLoading } = useSearchMusicPlaylists(
		{ q: searchSubmitted, page: searchPage, limit: 10 },
		{ enabled: open && Boolean(searchSubmitted.trim()) },
	);

	// 已添加歌单 ID 集合
	const featuredIdSet = useMemo(
		() => new Set(featuredPlaylists.map((p) => p.id)),
		[featuredPlaylists],
	);

	const handleAddById = async (id: string, name?: string) => {
		const targetId = id.trim();
		if (!/^[1-9]\d*$/.test(targetId)) {
			toast.error("歌单 ID 必须为正整数十进制数字");
			return;
		}

		try {
			await addMutation.mutateAsync({ playlist_id: targetId });
			toast.success(
				name ? `已成功添加展示歌单「${name}」` : `已成功添加歌单 ID: ${targetId}`,
			);
			setInputPlaylistId("");
		} catch (error) {
			const message = error instanceof Error ? error.message : "添加歌单失败";
			toast.error(message);
		}
	};

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = searchKeyword.trim();
		if (!trimmed) {
			toast.error("请输入搜索关键词");
			return;
		}
		setSearchPage(1);
		setSearchSubmitted(trimmed);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[620px] max-h-[90dvh] w-full flex-col overflow-hidden sm:max-w-2xl">
				<DialogHeader className="shrink-0 pb-1">
					<DialogTitle className="flex items-center gap-2">
						<ListPlus className="size-5 text-primary" />
						添加展示歌单
					</DialogTitle>
					<DialogDescription>
						选入网易云公开歌单作为本站展示歌单，支持按序展示并供前台访客浏览试听。
					</DialogDescription>
				</DialogHeader>

				<div className="mt-2 shrink-0">
					<Segmented<AddPlaylistTab>
						value={activeTab}
						onValueChange={setActiveTab}
						segments={SEGMENTS}
						block
						className="w-full"
					/>
				</div>

				{/* Tab 1: 我的账号歌单库 */}
				{activeTab === "library" ? (
					<div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
						{!isConnected ? (
							<div className="flex flex-1 flex-col items-center justify-center space-y-3 py-12 text-center">
								<Headphones className="size-10 text-muted-foreground" />
								<p className="font-medium text-foreground text-sm">
									未连接站点网易云账号
								</p>
								<p className="max-w-xs text-muted-foreground text-xs leading-relaxed">
									连接后可直接在此浏览并快速选入您的个人创建与收藏歌单。
								</p>
								<Button
									size="sm"
									onClick={() => {
										onOpenChange(false);
										onOpenQrLogin();
									}}
									className="mt-1 gap-1.5"
								>
									立即扫码连接
								</Button>
							</div>
						) : (
							<div className="flex min-h-0 flex-1 flex-col">
								<div className="min-h-0 flex-1 overflow-y-auto pr-1">
									{isLibraryLoading ? (
										<div className="space-y-2 py-2">
											{Array.from({ length: 4 }).map((_, idx) => (
												<div
													key={`skeleton-${idx}`}
													className="flex items-center justify-between rounded-xl border border-border/40 p-3"
												>
													<div className="flex items-center gap-3">
														<div className="size-10 animate-pulse rounded-lg bg-muted" />
														<div className="space-y-1.5">
															<div className="h-4 w-32 animate-pulse rounded bg-muted" />
															<div className="h-3 w-16 animate-pulse rounded bg-muted" />
														</div>
													</div>
													<div className="h-8 w-16 animate-pulse rounded bg-muted" />
												</div>
											))}
										</div>
									) : (userPlaylistsData?.data?.length ?? 0) === 0 ? (
										<div className="flex h-full items-center justify-center text-muted-foreground text-xs">
											暂无歌单数据
										</div>
									) : (
										<div className="space-y-2 py-1">
											{userPlaylistsData?.data?.map((item: MusicPlaylist) => {
												const isAdded = featuredIdSet.has(item.id);
												return (
													<div
														key={item.id}
														className="flex items-center justify-between rounded-xl border border-border/40 p-3 transition-colors hover:bg-muted/30"
													>
														<div className="flex items-center gap-3">
															{item.cover_url ? (
																<img
																	src={item.cover_url}
																	alt={item.name}
																	className="size-10 rounded-lg object-cover ring-1 ring-border/40"
																/>
															) : (
																<div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
																	<Music className="size-4" />
																</div>
															)}
															<div>
																<div className="flex items-center gap-1.5 font-medium text-sm">
																	<span>{item.name}</span>
																	<a
																		href={`https://music.163.com/#/playlist?id=${item.id}`}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-muted-foreground hover:text-foreground"
																		title="在网易云打开"
																	>
																		<ExternalLink className="size-3" />
																	</a>
																</div>
																<div className="flex items-center gap-2 text-muted-foreground text-xs">
																	<span>
																		{item.track_count} 首
																	</span>
																	<span>·</span>
																	<span>{item.creator}</span>
																</div>
															</div>
														</div>

														<Button
															size="sm"
															variant={isAdded ? "ghost" : "default"}
															disabled={
																isAdded || addMutation.isPending
															}
															onClick={() =>
																handleAddById(item.id, item.name)
															}
															className="h-8 gap-1 text-xs"
														>
															{isAdded ? (
																<span className="text-muted-foreground">
																	已添加
																</span>
															) : (
																<>
																	<Plus className="size-3.5" />
																	选入
																</>
															)}
														</Button>
													</div>
												);
											})}
										</div>
									)}
								</div>

								{/* 分页控制 */}
								{libraryTotal > libraryLimit && (
									<div className="flex shrink-0 items-center justify-between border-t border-border/40 pt-3 text-xs">
										<span className="text-muted-foreground">
											第 {libraryPage} 页 / 共 {libraryTotalPages} 页
										</span>
										<div className="flex items-center gap-1">
											<Button
												size="sm"
												variant="outline"
												className="h-7 px-2"
												disabled={libraryPage <= 1}
												onClick={() => setLibraryPage((p) => p - 1)}
											>
												<ChevronLeft className="size-3.5" />
												上一页
											</Button>
											<Button
												size="sm"
												variant="outline"
												className="h-7 px-2"
												disabled={libraryPage >= libraryTotalPages}
												onClick={() => setLibraryPage((p) => p + 1)}
											>
												下一页
												<ChevronRight className="size-3.5" />
											</Button>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				) : (
					/* Tab 2: 按 ID 添加或关键字搜索 */
					<div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden space-y-4">
						{/* 直接输入 ID 快捷添加 */}
						<div className="shrink-0 rounded-xl border border-border/50 bg-muted/20 p-4">
							<p className="mb-2 font-medium text-xs">通过歌单 ID 直接选入</p>
							<div className="flex items-center gap-2">
								<Input
									placeholder="输入网易云歌单十进制 ID（如 3778678）"
									value={inputPlaylistId}
									onChange={(e) => setInputPlaylistId(e.target.value)}
									className="flex-1 font-mono text-sm"
								/>
								<Button
									size="sm"
									disabled={!inputPlaylistId.trim() || addMutation.isPending}
									onClick={() => handleAddById(inputPlaylistId)}
									className="gap-1.5 shrink-0"
								>
									<Plus className="size-3.5" />
									添加
								</Button>
							</div>
						</div>

						{/* 关键词搜索公开歌单 */}
						<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
							<form
								onSubmit={handleSearchSubmit}
								className="flex shrink-0 items-center gap-2"
							>
								<Input
									placeholder="搜索网易云公开歌单关键词..."
									value={searchKeyword}
									onChange={(e) => setSearchKeyword(e.target.value)}
									className="flex-1 text-sm"
								/>
								<Button
									type="submit"
									variant="outline"
									size="sm"
									disabled={!searchKeyword.trim() || isSearchLoading}
									className="gap-1.5 shrink-0"
								>
									<Search className="size-3.5" />
									搜索
								</Button>
							</form>

							<div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
								{isSearchLoading ? (
									<div className="flex h-32 items-center justify-center text-muted-foreground text-xs">
										正在搜索网易云歌单...
									</div>
								) : searchSubmitted &&
									(searchResultsData?.data?.length ?? 0) === 0 ? (
									<div className="flex h-32 items-center justify-center text-muted-foreground text-xs">
										未找到匹配的歌单
									</div>
								) : !searchSubmitted ? (
									<div className="flex h-32 flex-col items-center justify-center text-muted-foreground text-xs space-y-1">
										<Search className="size-5 opacity-40" />
										<span>输入关键词可检索网易云全网公开歌单</span>
									</div>
								) : (
									<div className="space-y-2">
										{searchResultsData?.data?.map((item: MusicPlaylist) => {
											const isAdded = featuredIdSet.has(item.id);
											return (
												<div
													key={item.id}
													className="flex items-center justify-between rounded-xl border border-border/40 p-3 transition-colors hover:bg-muted/30"
												>
													<div className="flex items-center gap-3">
														{item.cover_url ? (
															<img
																src={item.cover_url}
																alt={item.name}
																className="size-10 rounded-lg object-cover ring-1 ring-border/40"
															/>
														) : (
															<div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
																<Music className="size-4" />
															</div>
														)}
														<div>
															<div className="flex items-center gap-1.5 font-medium text-sm">
																<span>{item.name}</span>
																<a
																	href={`https://music.163.com/#/playlist?id=${item.id}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-muted-foreground hover:text-foreground"
																	title="在网易云打开"
																>
																	<ExternalLink className="size-3" />
																</a>
															</div>
															<div className="flex items-center gap-2 text-muted-foreground text-xs">
																<Badge
																	variant="outline"
																	className="font-normal text-xs"
																>
																	{item.track_count} 首
																</Badge>
																<span>·</span>
																<span>{item.creator}</span>
															</div>
														</div>
													</div>

													<Button
														size="sm"
														variant={isAdded ? "ghost" : "default"}
														disabled={isAdded || addMutation.isPending}
														onClick={() =>
															handleAddById(item.id, item.name)
														}
														className="h-8 gap-1 text-xs"
													>
														{isAdded ? (
															<span className="text-muted-foreground">
																已添加
															</span>
														) : (
															<>
																<Plus className="size-3.5" />
																选入
															</>
														)}
													</Button>
												</div>
											);
										})}
									</div>
								)}
							</div>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
