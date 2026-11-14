import { stripPlaceholdersForPreview } from "@shared/ui/rich-text-input/use-rich-text-input";
import {
	Button,
	List,
	ListItem,
	ListItemContent,
	ListItemDescription,
	ListItemTitle,
	SearchInput,
} from "@violet/ui";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../model/types";

/** 结果只覆盖已加载消息，调用方负责加载历史与定位选中消息。 */
export interface ConversationMessageSearchProps {
	messages: ChatMessage[];
	hasNextPage: boolean;
	loading: boolean;
	onLoadMore: () => void;
	onSelect: (id: string) => void;
	onClose: () => void;
}

/** 在已读取的历史中定位消息，显式加载更早记录，不把局部结果冒充全量搜索。 */
export function ConversationMessageSearch({
	messages,
	hasNextPage,
	loading,
	onLoadMore,
	onSelect,
	onClose,
}: ConversationMessageSearchProps) {
	const [query, setQuery] = useState("");
	const input = useRef<HTMLInputElement>(null);
	useEffect(() => {
		input.current?.focus();
	}, []);
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
		<section
			aria-label="搜索消息"
			className="shrink-0 border-b border-border bg-card px-4 py-3"
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.stopPropagation();
					onClose();
				}
			}}
		>
			<div className="flex items-center gap-2">
				<SearchInput
					ref={input}
					aria-label="搜索消息内容"
					placeholder="搜索消息内容"
					value={query}
					onValueChange={setQuery}
					classNames={{ control: "min-w-0 flex-1" }}
				/>
				<Button
					iconOnly
					variant="ghost"
					size="sm"
					aria-label="关闭消息搜索"
					onClick={onClose}
				>
					<X className="size-4" />
				</Button>
			</div>
			<p role="status" className="mt-2 text-xs text-muted-foreground">
				{term ? `找到 ${matches.length} 条消息` : "输入关键词定位消息"}
				{hasNextPage ? " · 已加载的历史记录" : " · 全部历史记录"}
			</p>
			{matches.length > 0 && (
				<List density="compact" className="mt-2 max-h-40 overflow-y-auto p-1 -mx-1">
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
			)}
			{hasNextPage && (
				<Button
					className="mt-2"
					variant="ghost"
					size="sm"
					loading={loading}
					onClick={onLoadMore}
				>
					加载更早消息继续搜索
				</Button>
			)}
		</section>
	);
}
