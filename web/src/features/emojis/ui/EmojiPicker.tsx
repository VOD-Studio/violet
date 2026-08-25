/**
 * EmojiPicker - 表情选择器
 *
 * 基于后端 GET /emojis 返回的分组数据，按分组标签页展示可点击表情网格。
 * 图片表情用 img 渲染，纯文字表情用 text_content 兜底。
 *
 * 登录态下额外追加一个「我的表情」标签页（自传 + 收藏），数据来自
 * GET /custom-emojis/mine，自给自足获取，既有调用方无需新增个人表情数据 prop。
 */
import type { Emoji } from "@entities/emoji/model/types";
import { useCreateCustomEmoji, useMyCustomEmojis } from "@features/customemoji/api/queries";
import { useUploadEmoji } from "@features/emojis/api/mutations";
import { useAllEmojis } from "@features/emojis/api/queries";
import { useSessionStore } from "@shared/api/session";
import { isImageURL } from "@shared/lib/url";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import { ScrollArea } from "@shared/ui/scroll-area";
import { ImagePlus, Loader2, Smile } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface EmojiPickerProps {
	/** 触发器按钮，未传时使用默认笑脸图标 */
	trigger?: React.ReactNode;
	/** 选中表情回调 */
	onSelect: (emoji: Emoji) => void;
	/** 弹窗对齐方式 */
	align?: "start" | "center" | "end";
	/** 已选中的表情 ID 集合，用于禁用/标识已选项 */
	selectedIds?: Set<number>;
	/** 选中表情后是否关闭面板，默认 true */
	closeOnSelect?: boolean;
	/** 是否展示自定义表情 tab；只支持系统表情的回应选择器可关闭。 */
	showMyEmojis?: boolean;
}

/** 「我的表情」伪分组的标签 key，不与真实分组名冲突（分组名不含前后双下划线）。 */
const MINE_TAB_KEY = "__mine__";

/**
 * EmojiPicker - 表情选择浮层
 *
 * 首次打开时拉取全部启用分组，按分组标签展示。选择后自动关闭浮层。
 */
export function EmojiPicker({
	trigger,
	onSelect,
	align = "start",
	selectedIds = new Set(),
	closeOnSelect = true,
	showMyEmojis = true,
}: EmojiPickerProps) {
	const [open, setOpen] = useState(false);
	const { data: groups = [], isLoading } = useAllEmojis();
	const isLoggedIn = useSessionStore((state) => state.sessionActive);

	const firstGroup = groups[0]?.name ?? "";
	// 登录且开启我的表情时默认选中「我的」：聊天场景下自传/收藏的使用频率高于系统分组
	const defaultTab = isLoggedIn && showMyEmojis ? MINE_TAB_KEY : firstGroup;
	const [activeGroup, setActiveGroup] = useState(defaultTab);
	const tabsListRef = useRef<HTMLDivElement>(null);
	const activeButtonRef = useRef<HTMLButtonElement>(null);

	// 每次打开浮层重置回默认 tab；分组异步加载完成（defaultTab 随之变化）时同步一次
	useEffect(() => {
		if (open) setActiveGroup(defaultTab);
	}, [open, defaultTab]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 需要监听 activeGroup 变化以滚动当前标签到可视区
	useEffect(() => {
		activeButtonRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
			inline: "center",
		});
	}, [activeGroup]);

	const handleSelect = (emoji: Emoji) => {
		onSelect(emoji);
		if (closeOnSelect) {
			setOpen(false);
		}
	};

	const tabCount = groups.length + (isLoggedIn && showMyEmojis ? 1 : 0);
	const activeIndex =
		activeGroup === MINE_TAB_KEY
			? groups.length
			: groups.findIndex((g) => g.name === activeGroup);
	const activeGroupData =
		groups[activeIndex] ?? (activeGroup === MINE_TAB_KEY ? undefined : groups[0]);
	const showingMine = isLoggedIn && showMyEmojis && activeGroup === MINE_TAB_KEY;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				{trigger ?? (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						aria-label="添加表情"
						className="text-muted-foreground hover:text-foreground"
					>
						<Smile className="size-3.5" />
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent
				align={align}
				sideOffset={4}
				className="w-85 p-0"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onFocusOutside={(e) => {
					if (!closeOnSelect) {
						e.preventDefault();
					}
				}}
			>
				<div className="flex flex-col">
					{isLoading ? (
						<div className="flex items-center justify-center py-8 text-muted-foreground">
							<Loader2 className="mr-2 size-4 animate-spin" />
							加载中…
						</div>
					) : tabCount === 0 ? (
						<div className="py-8 text-center text-sm text-muted-foreground">
							暂无可用表情
						</div>
					) : (
						<div className="w-full">
							<div
								ref={tabsListRef}
								className="relative mx-3 mt-3 flex flex-nowrap gap-1 overflow-x-auto bg-muted [&::-webkit-scrollbar]:hidden"
								style={{ scrollbarWidth: "none" }}
							>
								<div
									className="absolute size-7 bg-popover transition-transform duration-200 ease-out"
									style={{
										transform: `translateX(calc(${Math.max(activeIndex, 0)} * (1.75rem + 0.25rem)))`,
									}}
								/>
								{groups.map((group) => {
									const isActive = group.name === activeGroup;
									return (
										<button
											key={group.name}
											ref={isActive ? activeButtonRef : undefined}
											type="button"
											onClick={() => setActiveGroup(group.name)}
											title={group.name}
											className={`relative z-10 flex size-7 shrink-0 items-center justify-center text-xs transition-colors ${
												isActive
													? "font-medium text-foreground"
													: "text-muted-foreground hover:text-foreground"
											}`}
										>
											{group.cover_url && isImageURL(group.cover_url) ? (
												<img
													src={group.cover_url}
													alt={group.name}
													className="size-5 shrink-0 object-contain"
													loading="lazy"
												/>
											) : (
												<span className="truncate">{group.name}</span>
											)}
										</button>
									);
								})}
								{isLoggedIn && showMyEmojis && (
									<button
										key={MINE_TAB_KEY}
										ref={showingMine ? activeButtonRef : undefined}
										type="button"
										onClick={() => setActiveGroup(MINE_TAB_KEY)}
										title="我的表情"
										className={`relative z-10 flex size-7 shrink-0 items-center justify-center text-xs transition-colors ${
											showingMine
												? "font-medium text-foreground"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										<span className="truncate">我的</span>
									</button>
								)}
							</div>
							<ScrollArea className="h-48 px-3 pb-3">
								{showingMine ? (
									<MyEmojisPanel onSelect={handleSelect} />
								) : (
									activeGroupData && (
										<EmojiGrid
											emojis={activeGroupData.emojis}
											groupType={activeGroupData.type}
											metaSize={activeGroupData.meta?.size}
											selectedIds={selectedIds}
											onSelect={handleSelect}
										/>
									)
								)}
							</ScrollArea>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

// 分组类型常量：1=文字（颜文字组），2=图片。
const GROUP_TYPE_TEXT = 1;

/** EmojiGrid - 单分组内的表情网格 */
function EmojiGrid({
	emojis,
	groupType,
	metaSize,
	selectedIds,
	onSelect,
}: {
	emojis: Emoji[];
	groupType: number;
	metaSize?: number;
	selectedIds: Set<number>;
	onSelect: (emoji: Emoji) => void;
}) {
	if (emojis.length === 0) {
		return <div className="py-6 text-center text-sm text-muted-foreground">该分组暂无表情</div>;
	}

	// 文字组固定 4 列；图片组按 size 决定列数（10/size，size=1→10 列，size=2→5 列）。
	const isTextGroup = groupType === GROUP_TYPE_TEXT;
	const gridCols = isTextGroup ? "grid-cols-4" : metaSize === 2 ? "grid-cols-5" : "grid-cols-10";

	return (
		<div className={cn("grid gap-1 pt-2", gridCols)}>
			{emojis.map((emoji) => {
				const isSelected = selectedIds.has(emoji.id);
				const text = emoji.text_content ?? emoji.name;
				const imageUrl = emoji.gif_url || emoji.url;
				const isText = !imageUrl || !isImageURL(imageUrl);
				return (
					<button
						key={emoji.id}
						type="button"
						onClick={() => onSelect(emoji)}
						title={isSelected ? `${emoji.name}（已选择）` : emoji.name}
						disabled={isSelected}
						className={cn(
							"flex items-center justify-center overflow-hidden rounded-md transition-colors",
							isText ? "h-9 w-full px-1" : "aspect-square w-full p-0.5",
							isSelected ? "cursor-not-allowed opacity-40" : "hover:bg-accent",
						)}
					>
						{imageUrl && isImageURL(imageUrl) ? (
							<img
								src={imageUrl}
								alt={emoji.name}
								className="h-full w-full object-contain"
								loading="lazy"
							/>
						) : (
							<span className="block overflow-hidden whitespace-nowrap text-sm leading-none">
								{text}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

/** 单用户表情上传大小上限（与后端 UploadEmoji 校验一致） */
const MAX_EMOJI_SIZE = 10 * 1024 * 1024;

/** 「我的表情」标签页内容。 */
export interface MyEmojisPanelProps {
	/** 选中表情回调 */
	onSelect: (emoji: Emoji) => void;
}

/** 自定义表情网格项属性。 */
export interface CustomEmojiTileProps {
	/** 表情读模型 */
	emoji: Emoji;
	/** 选中表情回调 */
	onSelect: (emoji: Emoji) => void;
}

/**
 * MyEmojisPanel - 「我的表情」标签页内容：我传的 + 收藏来的两个分组 + 上传入口。
 *
 * 删除自己的表情 / 移出收藏均由全站右键菜单处理（渲染在此的 img 也带
 * data-custom-emoji-id/data-relation，右键行为与消息正文内一致），本组件
 * 不重复造轮子。
 */
function MyEmojisPanel({ onSelect }: MyEmojisPanelProps) {
	const { data: mine, isLoading } = useMyCustomEmojis(true);
	const uploadEmoji = useUploadEmoji();
	const createEmoji = useCreateCustomEmoji();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [pending, setPending] = useState<{ file: File; preview: string; name: string } | null>(
		null,
	);

	const busy = uploadEmoji.isPending || createEmoji.isPending;

	const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (file.size > MAX_EMOJI_SIZE) {
			toast.error("表情图片不能超过 10MB");
			return;
		}
		const defaultName = file.name.replace(/\.[^./]+$/, "").slice(0, 50) || "表情";
		setPending({ file, preview: URL.createObjectURL(file), name: defaultName });
	};

	const cancelPending = () => {
		if (pending) URL.revokeObjectURL(pending.preview);
		setPending(null);
	};

	const confirmUpload = async () => {
		if (!pending?.name.trim()) return;
		try {
			const uploaded = await uploadEmoji.mutateAsync(pending.file);
			await createEmoji.mutateAsync({ name: pending.name.trim(), url: uploaded.url });
			URL.revokeObjectURL(pending.preview);
			setPending(null);
		} catch {
			// 错误已由 mutation 的 onError 统一 toast，此处仅保留输入态供用户重试。
		}
	};

	if (pending) {
		return (
			<div className="flex flex-col gap-2 pt-2">
				<div className="flex items-center gap-2">
					<img
						src={pending.preview}
						alt="预览"
						className="size-12 shrink-0 rounded-md object-contain"
					/>
					<Input
						value={pending.name}
						onChange={(e) => setPending({ ...pending, name: e.target.value })}
						placeholder="给表情起个名字"
						maxLength={50}
						disabled={busy}
						autoFocus
					/>
				</div>
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={cancelPending}
						disabled={busy}
					>
						取消
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={confirmUpload}
						disabled={busy || !pending.name.trim()}
					>
						{busy ? <Loader2 className="size-3.5 animate-spin" /> : "上传"}
					</Button>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8 text-muted-foreground">
				<Loader2 className="mr-2 size-4 animate-spin" />
				加载中…
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 pt-2">
			<input
				ref={fileInputRef}
				type="file"
				accept="image/png,image/jpeg,image/gif,image/webp"
				className="hidden"
				onChange={handleFilePicked}
			/>
			<section>
				<div className="mb-1 flex items-center justify-between">
					<h4 className="text-xs font-medium text-muted-foreground">我传的</h4>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					>
						<ImagePlus className="size-3.5" />
						上传
					</button>
				</div>
							{mine && mine.owned.length > 0 ? (
				<div className="grid grid-cols-6 gap-1">
						{mine.owned.map((emoji) => (
							<CustomEmojiTile
								key={emoji.custom_emoji_id}
								emoji={emoji}
								onSelect={onSelect}
							/>
						))}
					</div>
				) : (
					<div className="py-2 text-center text-xs text-muted-foreground">
						还没有自己上传的表情
					</div>
				)}
			</section>
			<section>
				<h4 className="mb-1 text-xs font-medium text-muted-foreground">收藏来的</h4>
							{mine && mine.favorited.length > 0 ? (
				<div className="grid grid-cols-6 gap-1">
						{mine.favorited.map((emoji) => (
							<CustomEmojiTile
								key={emoji.custom_emoji_id}
								emoji={emoji}
								onSelect={onSelect}
							/>
						))}
					</div>
				) : (
					<div className="py-2 text-center text-xs text-muted-foreground">
						右键别人发的表情即可收藏
					</div>
				)}
			</section>
		</div>
	);
}

/** CustomEmojiTile - 自定义表情网格项；img 挂 data-custom-emoji-id/data-relation 供全站右键菜单识别。 */
function CustomEmojiTile({ emoji, onSelect }: CustomEmojiTileProps) {
	return (
		<button
			type="button"
			onClick={() => onSelect(emoji)}
			title={emoji.name}
			className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md p-0.5 transition-colors hover:bg-accent"
		>
			<img
				src={emoji.url}
				alt={emoji.name}
				data-custom-emoji-id={emoji.custom_emoji_id}
				data-relation={emoji.relation}
				className="h-full w-full object-contain"
				loading="lazy"
			/>
		</button>
	);
}
