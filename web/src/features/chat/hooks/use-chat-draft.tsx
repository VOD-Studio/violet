import type { ImageUploadReference } from "@shared/lib/image-upload-task";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { ChatMessage } from "../model/types";

type ChatDraft = {
	content: string;
	images: ImageUploadReference[];
	reply: ChatMessage | null;
};

type DraftCache = Map<string, Partial<ChatDraft> & { releases?: (() => void)[] }>;
const DraftContext = createContext<DraftCache | null>(null);
const EMPTY_DRAFT: ChatDraft = { content: "", images: [], reply: null };

/** 草稿只在本次工作区内按会话隔离；离开工作区后释放图片预览，不写浏览器存储。 */
export function ChatDraftProvider({ children }: { children: ReactNode }) {
	const [cache] = useState<DraftCache>(() => new Map());
	useEffect(
		() => () => {
			for (const draft of cache.values()) {
				for (const release of draft.releases ?? []) release();
			}
			cache.clear();
		},
		[cache],
	);
	return <DraftContext value={cache}>{children}</DraftContext>;
}

/** 保留输入字段的即时值，组件卸载后仍可从当前工作区恢复。 */
export function useChatDraftField<K extends keyof ChatDraft>(conversationID: string, field: K) {
	const cache = useContext(DraftContext);
	const [state, setState] = useState(() => ({
		conversationID,
		value: cache?.get(conversationID)?.[field] ?? EMPTY_DRAFT[field],
	}));
	let value = state.value;
	if (state.conversationID !== conversationID) {
		value = cache?.get(conversationID)?.[field] ?? EMPTY_DRAFT[field];
		setState({ conversationID, value });
	}
	const update = useCallback(
		(next: ChatDraft[K]) => {
			if (cache) {
				const draft = cache.get(conversationID) ?? {};
				if (field === "images") {
					const images = next as ChatDraft["images"];
					const releases = images.map((image) => image.task.retain());
					for (const release of draft.releases ?? []) release();
					draft.releases = releases;
				}
				cache.set(conversationID, { ...draft, [field]: next });
			}
			setState({ conversationID, value: next });
		},
		[cache, conversationID, field],
	);
	return [value, update] as const;
}
