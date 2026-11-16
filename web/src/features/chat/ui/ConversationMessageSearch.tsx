import { stripPlaceholdersForPreview } from "@shared/ui/rich-text-input/use-rich-text-input";
import {
	Button,
	Input,
	List,
	ListItem,
	ListItemContent,
	ListItemDescription,
	ListItemTitle,
	Popover,
	PopoverContent,
	ScrollArea,
} from "@violet/ui";
import { Search } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage } from "../model/types";

/** 结果只覆盖已加载消息，调用方负责加载历史与定位选中消息。 */
export interface ConversationMessageSearchProps {
	active: boolean;
	messages: ChatMessage[];
	hasNextPage: boolean;
	loading: boolean;
	onLoadMore: () => void;
	onSelect: (id: string) => void;
	onClose: () => void;
}

/** 在已读取的历史中定位消息，显式加载更早记录，不把局部结果冒充全量搜索。 */
export function ConversationMessageSearch({
	active,
	messages,
	hasNextPage,
	loading,
	onLoadMore,
	onSelect,
	onClose,
}: ConversationMessageSearchProps) {
	const [query, setQuery] = useState("");
	const [resultsOpen, setResultsOpen] = useState(false);
	const anchor = useRef<HTMLElement>(null);
	const input = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		if (!active) return;
		setQuery("");
		setResultsOpen(true);
		input.current?.focus();
	}, [active]);
	const term = query.trim().toLocaleLowerCase();
	const matches = term
		? messages.filter(
				(message) =>
					!message.is_deleted &&
					stripPlaceholdersForPreview(message.content ?? "")
						.toLocaleLowerCase()
						.includes(term),
			)
		: [];
	return (
		<Popover open={active && resultsOpen && Boolean(term)} onOpenChange={setResultsOpen}>
			<PopoverPrimitive.Anchor asChild>
				<section
					ref={anchor}
					aria-label="搜索消息"
					className="w-full min-w-0"
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							event.preventDefault();
							event.stopPropagation();
							onClose();
						}
					}}
				>
					<Input
						ref={input}
						aria-label="搜索消息内容"
						type="search"
						clearable
						leading={<Search />}
						placeholder="搜索消息内容"
						value={query}
						onFocus={() => setResultsOpen(true)}
						onChange={(event) => {
							setQuery(event.target.value);
							setResultsOpen(true);
						}}
					/>
				</section>
			</PopoverPrimitive.Anchor>
			<PopoverContent
				aria-label="消息搜索结果"
				align="start"
				className="w-(--radix-popover-trigger-width) min-w-0 max-w-[calc(100vw-2rem)] p-2"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => {
					if (event.target instanceof Node && anchor.current?.contains(event.target)) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onClose();
				}}
			>
				<p role="status" className="px-2 py-2 text-xs text-muted-foreground">
					找到 {matches.length} 条消息
					{hasNextPage ? " · 已加载的历史记录" : " · 全部历史记录"}
				</p>
				<ScrollArea aria-label="匹配消息" className="max-h-64">
					{matches.length > 0 ? (
						<List density="compact">
							{matches.map((message) => (
								<ListItem key={message.id} onClick={() => onSelect(message.id)}>
									<ListItemContent>
										<ListItemTitle>{message.sender.display_name}</ListItemTitle>
										<ListItemDescription>
											{stripPlaceholdersForPreview(message.content ?? "")}
										</ListItemDescription>
									</ListItemContent>
								</ListItem>
							))}
						</List>
					) : (
						<p className="px-2 py-4 text-sm text-muted-foreground">没有匹配的消息</p>
					)}
				</ScrollArea>
				{hasNextPage && (
					<Button
						className="mt-2 w-full"
						variant="ghost"
						size="sm"
						loading={loading}
						onClick={onLoadMore}
					>
						加载更早消息继续搜索
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}
