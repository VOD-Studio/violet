import { cn } from "@shared/lib/utils";
import { useEffect, useRef } from "react";
import type { BotCommand, BotCommandCatalog, ChatUser } from "../model/types";

export interface BotCommandChoice {
	bot: BotCommandCatalog;
	command: BotCommand;
}

export const botCommandListboxId = "chat-bot-command-listbox";
export const botCommandOptionId = (index: number) => `chat-bot-command-${index}`;
export const botTargetListboxId = "chat-bot-target-listbox";
export const botTargetOptionId = (index: number) => `chat-bot-target-${index}`;

export function BotCommandMenu({
	choices,
	activeIndex,
	onActiveIndexChange,
	onSelect,
}: {
	choices: BotCommandChoice[];
	activeIndex: number;
	onActiveIndexChange: (index: number) => void;
	onSelect: (choice: BotCommandChoice) => void;
}) {
	const listRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		listRef.current
			?.querySelectorAll('[role="option"]')
			[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	return (
		<div
			aria-label="Bot 命令"
			className="absolute bottom-full left-0 z-30 mb-2 max-h-[min(40vh,320px)] w-full overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1 text-popover-foreground"
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
				const groupStart =
					index === 0 || choices[index - 1].bot.bot_user_id !== choice.bot.bot_user_id;
				return (
					<div key={`${choice.bot.bot_user_id}:${choice.command.id}`}>
						{groupStart && (
							<div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
								{choice.bot.name}
							</div>
						)}
						<button
							aria-label={`${choice.bot.name} ${path} ${argumentsHint} ${choice.command.description}`}
							aria-selected={index === activeIndex}
							className={cn(
								"block w-full rounded-lg px-3 py-2 text-left",
								index === activeIndex ? "bg-accent" : "hover:bg-accent/60",
							)}
							id={botCommandOptionId(index)}
							onClick={() => onSelect(choice)}
							onMouseEnter={() => onActiveIndexChange(index)}
							onPointerDown={(event) => event.preventDefault()}
							role="option"
							type="button"
						>
							<span className="flex min-w-0 items-baseline gap-2">
								<span className="min-w-0 truncate font-mono text-sm text-foreground">
									{path}
								</span>
								{argumentsHint && (
									<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
										{argumentsHint}
									</span>
								)}
							</span>
							<span className="block truncate text-xs text-muted-foreground">
								{choice.command.description}
								{choice.command.scope === "global" ? " · 全局" : ""}
							</span>
						</button>
					</div>
				);
			})}
		</div>
	);
}

export function BotTargetMenu({
	bots,
	activeIndex,
	onActiveIndexChange,
	onSelect,
}: {
	bots: ChatUser[];
	activeIndex: number;
	onActiveIndexChange: (index: number) => void;
	onSelect: (bot: ChatUser) => void;
}) {
	return (
		<div
			aria-label="选择命令目标"
			className="absolute bottom-full left-0 z-30 mb-2 w-full rounded-xl border border-border bg-popover p-1 text-popover-foreground"
			id={botTargetListboxId}
			role="listbox"
		>
			<div className="px-3 py-2 text-xs text-muted-foreground">选择要执行命令的 Bot</div>
			{bots.map((bot, index) => (
				<button
					aria-selected={index === activeIndex}
					className={cn(
						"flex w-full items-center rounded-lg px-3 py-2 text-left text-sm",
						index === activeIndex ? "bg-accent" : "hover:bg-accent/60",
					)}
					id={botTargetOptionId(index)}
					key={bot.id}
					onClick={() => onSelect(bot)}
					onMouseEnter={() => onActiveIndexChange(index)}
					onPointerDown={(event) => event.preventDefault()}
					role="option"
					type="button"
				>
					{bot.display_name || bot.username}
				</button>
			))}
		</div>
	);
}
