import {
	Avatar,
	Button,
	Empty,
	List,
	ListItem,
	ListItemContent,
	ListItemDescription,
	ListItemTitle,
	Spinner,
} from "@violet/ui";
import { type MouseEvent, useEffect, useRef } from "react";
import type { BotCommand, BotCommandCatalog, ChatUser } from "../model/types";

export interface BotCommandChoice {
	bot: BotCommandCatalog;
	command: BotCommand;
}

export const botCommandListboxId = "chat-bot-command-listbox";
export const botCommandOptionId = (index: number) => `chat-bot-command-${index}`;
export const botTargetListboxId = "chat-bot-target-listbox";
export const botTargetOptionId = (index: number) => `chat-bot-target-${index}`;

/** 命令候选及目录查询状态；空目录与查询失败不会冒充可执行命令。 */
export interface BotCommandMenuProps {
	choices: BotCommandChoice[];
	activeIndex: number;
	onActiveIndexChange: (index: number) => void;
	onSelect: (choice: BotCommandChoice) => void;
	isLoading?: boolean;
	isError?: boolean;
	query?: string;
	onRetry?: () => void;
}

export function BotCommandMenu({
	choices,
	activeIndex,
	onActiveIndexChange,
	onSelect,
	isLoading = false,
	isError = false,
	query = "",
	onRetry,
}: BotCommandMenuProps) {
	const listRef = useRef<HTMLUListElement>(null);
	useEffect(() => {
		listRef.current
			?.querySelectorAll('[role="option"]')
			[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	return (
		<div className="space-y-2" id={choices.length === 0 ? botCommandListboxId : undefined}>
			<p className="text-xs text-muted-foreground">召唤角色</p>
			{choices.length === 0 ? (
				isLoading ? (
					<div className="flex items-center gap-2" role="status">
						<Spinner aria-hidden="true" />
						<span>正在加载角色命令…</span>
					</div>
				) : isError ? (
					<Empty
						role="alert"
						title="角色命令加载失败"
						variant="plain"
						action={
							onRetry && (
								<Button
									onClick={onRetry}
									onMouseDown={(event) => event.preventDefault()}
									size="sm"
								>
									重新加载
								</Button>
							)
						}
					/>
				) : (
					<Empty
						title={query.trim() ? "没有匹配的角色命令" : "本会话暂无可用的角色命令"}
						variant="plain"
					/>
				)
			) : (
				<List
					aria-label="Bot 命令"
					density="compact"
					id={botCommandListboxId}
					ref={listRef}
					role="listbox"
				>
					{choices.map((choice, index) => {
						const path = `/${choice.command.path.join(" ")}`;
						const argumentsHint = choice.command.arguments
							.map((argument) =>
								argument.required ? `<${argument.name}>` : `[${argument.name}]`,
							)
							.join(" ");
						return (
							<ListItem
								aria-current={index === activeIndex ? true : undefined}
								aria-label={`${choice.bot.name} ${path} ${argumentsHint} ${choice.command.description}`}
								aria-selected={index === activeIndex}
								id={botCommandOptionId(index)}
								key={`${choice.bot.bot_user_id}:${choice.command.id}`}
								onClick={() => onSelect(choice)}
								onMouseDown={(event: MouseEvent<HTMLElement>) =>
									event.preventDefault()
								}
								onMouseMove={() => onActiveIndexChange(index)}
								role="option"
								tabIndex={-1}
							>
								<Avatar alt="" name={choice.bot.name} size={24} />
								<ListItemContent>
									<ListItemTitle mono>
										{path}
										{argumentsHint && ` ${argumentsHint}`}
									</ListItemTitle>
									<ListItemDescription>
										{choice.bot.name} · {choice.command.description}
										{choice.command.scope === "global" ? " · 全局" : ""}
									</ListItemDescription>
								</ListItemContent>
							</ListItem>
						);
					})}
				</List>
			)}
		</div>
	);
}

/** 多角色群聊中未显式寻址的命令目标。 */
export interface BotTargetMenuProps {
	bots: ChatUser[];
	activeIndex: number;
	onActiveIndexChange: (index: number) => void;
	onSelect: (bot: ChatUser) => void;
}

export function BotTargetMenu({
	bots,
	activeIndex,
	onActiveIndexChange,
	onSelect,
}: BotTargetMenuProps) {
	const listRef = useRef<HTMLUListElement>(null);
	useEffect(() => {
		listRef.current
			?.querySelectorAll('[role="option"]')
			[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);
	return (
		<div className="space-y-2">
			<p className="text-xs text-muted-foreground">选择执行命令的角色</p>
			<List
				aria-label="选择命令目标"
				density="compact"
				id={botTargetListboxId}
				ref={listRef}
				role="listbox"
			>
				{bots.map((bot, index) => (
					<ListItem
						aria-current={index === activeIndex ? true : undefined}
						aria-selected={index === activeIndex}
						id={botTargetOptionId(index)}
						key={bot.id}
						onClick={() => onSelect(bot)}
						onMouseDown={(event: MouseEvent<HTMLElement>) => event.preventDefault()}
						onMouseMove={() => onActiveIndexChange(index)}
						role="option"
						tabIndex={-1}
					>
						<Avatar
							alt=""
							name={bot.display_name || bot.username}
							size={24}
							src={bot.avatar_url}
						/>
						<ListItemContent>
							<ListItemTitle>{bot.display_name || bot.username}</ListItemTitle>
							<ListItemDescription>@{bot.username}</ListItemDescription>
						</ListItemContent>
					</ListItem>
				))}
			</List>
		</div>
	);
}
