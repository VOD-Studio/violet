import type { RichTextInputHandle } from "@shared/ui/rich-text-input/RichTextInput";
import {
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useBotCommands, useChatMembers } from "../api/queries";
import type { ChatUser, ConversationKind } from "../model/types";
import {
	type BotCommandChoice,
	BotCommandMenu,
	BotTargetMenu,
	botCommandListboxId,
	botCommandOptionId,
	botTargetListboxId,
	botTargetOptionId,
} from "../ui/BotCommandMenu";

/** 会话命令候选绑定的编辑器与会话范围。 */
export interface UseComposerCommandsOptions {
	conversationID: string;
	conversationKind: ConversationKind;
	inputRef: RefObject<RichTextInputHandle | null>;
}

/** 角色命令菜单、键盘选择与发送前寻址的消费契约。 */
export interface UseComposerCommandsReturn {
	isCommandMenuOpen: boolean;
	suggestions: ReactNode;
	listboxId: string;
	activeOptionId: string | undefined;
	onQueryChange: (query: string | null) => void;
	onKeyDown: (event: KeyboardEvent) => boolean;
	onDraftChange: (value: string) => void;
	toggleMenu: () => void;
	dismissActiveMenu: () => boolean;
	clear: () => void;
	/** 多角色未寻址时返回 null，等待用户从菜单选择目标。 */
	resolveTarget: (text: string) => string | null;
}

/** 管理角色命令补全与目标选择，不拥有消息草稿或发送请求。 */
export function useComposerCommands({
	conversationID,
	conversationKind,
	inputRef,
}: UseComposerCommandsOptions): UseComposerCommandsReturn {
	const [query, setQuery] = useState<string | null>(null);
	const [activeCommandIndex, setActiveCommandIndex] = useState(0);
	const [activeTargetIndex, setActiveTargetIndex] = useState(0);
	const [needsTarget, setNeedsTarget] = useState(false);
	const { data: members } = useChatMembers(conversationID);
	const {
		data: catalogs,
		isPending,
		isError,
		refetch,
	} = useBotCommands(conversationID, query !== null);
	const roomBots = useMemo(() => {
		const enabledIDs = catalogs ? new Set(catalogs.bots.map((bot) => bot.bot_user_id)) : null;
		return (members ?? [])
			.map((member) => member.user)
			.filter((user) => user.is_bot && (!enabledIDs || enabledIDs.has(user.id)));
	}, [members, catalogs]);
	const choices = useMemo(() => {
		if (query === null) {
			return [];
		}
		const normalized = query.toLocaleLowerCase().trimStart();
		return (catalogs?.bots ?? []).flatMap((bot) =>
			(bot.commands ?? [])
				.filter((command) => {
					const path = command.path.join(" ").toLocaleLowerCase();
					return (
						!normalized ||
						path.startsWith(normalized) ||
						command.description.toLocaleLowerCase().includes(normalized)
					);
				})
				.map((command): BotCommandChoice => ({ bot, command })),
		);
	}, [catalogs, query]);
	const selectedCommandIndex = Math.min(activeCommandIndex, Math.max(choices.length - 1, 0));
	const selectedTargetIndex = Math.min(activeTargetIndex, Math.max(roomBots.length - 1, 0));
	const commandMenuOpen = query !== null;
	useEffect(() => {
		if (commandMenuOpen) {
			void refetch();
		}
	}, [commandMenuOpen, refetch]);

	const clear = () => {
		setQuery(null);
		setNeedsTarget(false);
	};
	const selectCommand = (choice: BotCommandChoice) => {
		const mention =
			conversationKind === "room"
				? {
						id: choice.bot.bot_user_id,
						username: choice.bot.username,
						displayName: choice.bot.name,
					}
				: undefined;
		inputRef.current?.insertSlashCommand(`/${choice.command.path.join(" ")}\u00a0`, mention);
		clear();
	};
	const selectTarget = (bot: ChatUser) => {
		inputRef.current?.prependMention(bot.id, bot.username, bot.display_name || bot.username);
		clear();
	};
	const dismissActiveMenu = () => {
		if (needsTarget) {
			setNeedsTarget(false);
			return true;
		}
		if (commandMenuOpen) {
			setQuery(null);
			return true;
		}
		return false;
	};
	const onKeyDown = (event: KeyboardEvent): boolean => {
		if (event.nativeEvent.isComposing || (!needsTarget && !commandMenuOpen)) {
			return false;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			return dismissActiveMenu();
		}
		const count = needsTarget ? roomBots.length : choices.length;
		if (count === 0) {
			return false;
		}
		const setActiveIndex = needsTarget ? setActiveTargetIndex : setActiveCommandIndex;
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				setActiveIndex((index) => (index + 1) % count);
				return true;
			case "ArrowUp":
				event.preventDefault();
				setActiveIndex((index) => (index - 1 + count) % count);
				return true;
			case "Enter":
			case "Tab":
				if (event.key === "Enter" && event.shiftKey) {
					return false;
				}
				event.preventDefault();
				if (needsTarget) {
					selectTarget(roomBots[selectedTargetIndex]);
				} else {
					selectCommand(choices[selectedCommandIndex]);
				}
				return true;
			default:
				return false;
		}
	};
	const toggleMenu = () => {
		if (commandMenuOpen) {
			setQuery(null);
			return;
		}
		inputRef.current?.focus();
		setNeedsTarget(false);
		setActiveCommandIndex(0);
		setQuery("");
	};
	const resolveTarget = (text: string): string | null => {
		if (conversationKind !== "room" || !text.startsWith("/") || text.startsWith("//")) {
			return text;
		}
		if (roomBots.length === 1) {
			return `@(${roomBots[0].username}:${roomBots[0].id}) ${text}`;
		}
		if (roomBots.length > 1) {
			setActiveTargetIndex(0);
			setNeedsTarget(true);
			return null;
		}
		return text;
	};

	let suggestions: ReactNode;
	if (needsTarget) {
		suggestions = (
			<BotTargetMenu
				bots={roomBots}
				activeIndex={selectedTargetIndex}
				onActiveIndexChange={setActiveTargetIndex}
				onSelect={selectTarget}
			/>
		);
	} else if (query !== null) {
		suggestions = (
			<BotCommandMenu
				choices={choices}
				activeIndex={selectedCommandIndex}
				onActiveIndexChange={setActiveCommandIndex}
				onSelect={selectCommand}
				isLoading={isPending}
				isError={isError}
				query={query}
				onRetry={() => {
					void refetch();
					inputRef.current?.focus();
				}}
			/>
		);
	}
	return {
		isCommandMenuOpen: commandMenuOpen && !needsTarget,
		suggestions,
		listboxId: needsTarget ? botTargetListboxId : botCommandListboxId,
		activeOptionId: needsTarget
			? botTargetOptionId(selectedTargetIndex)
			: choices.length > 0
				? botCommandOptionId(selectedCommandIndex)
				: undefined,
		onQueryChange(next) {
			setQuery(next);
			setActiveCommandIndex(0);
			if (next === null) {
				setNeedsTarget(false);
			}
		},
		onDraftChange(value) {
			if (!value.trim().startsWith("/")) {
				setNeedsTarget(false);
			}
		},
		onKeyDown,
		toggleMenu,
		dismissActiveMenu,
		clear,
		resolveTarget,
	};
}
