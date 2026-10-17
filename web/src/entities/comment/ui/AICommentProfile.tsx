import {
	CartoonPopover,
	CartoonPopoverContent,
	CartoonPopoverTrigger,
} from "@shared/ui/cartoon-popover";
import { cn } from "cn";
import { Dialog } from "radix-ui";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { AI_PERSONAS, getCommentAuthorPresentation } from "../lib/ai-personas";
import styles from "./AICommentProfile.module.css";
import "./ai-personas.css";

/** children 仅放头像或文字，不可包含按钮、链接等交互节点。 */
export interface AICommentProfileProps {
	name: string;
	children: ReactNode;
	className?: string;
	/** 所属浮层不可用时关闭介绍，不在恢复可用后自动重开。 */
	disabled?: boolean;
}

const cardStyle = {
	"--cartoon-border": "var(--ai-accent)",
	"--cartoon-bg": "color-mix(in oklch, var(--ai-accent) 5%, var(--card))",
} as CSSProperties;

/** AI 自署名的本站拟人介绍，不提供真人主页或已验证身份声明。 */
export function AICommentProfile({
	name,
	children,
	className,
	disabled = false,
}: AICommentProfileProps) {
	const [open, setOpen] = useState(false);
	const focusRef = useRef({ pointer: false, opened: false });
	const dialogId = useId();
	const author = getCommentAuthorPresentation({ author_name: name, is_ai: true });
	const personaId = author.personaId ?? "unknown";
	const persona = AI_PERSONAS[personaId];

	useEffect(() => {
		if (disabled) {
			setOpen(false);
			focusRef.current = { pointer: false, opened: false };
		}
	}, [disabled]);
	const activeOpen = open && !disabled;

	return (
		<Dialog.Root
			open={activeOpen}
			onOpenChange={(next) => setOpen(next && !disabled)}
			modal={false}
		>
			<CartoonPopover
				open={activeOpen}
				onOpenChange={(next) => setOpen(next && !disabled)}
				triggerMode={disabled ? "click" : "both"}
				hoverDelay={120}
				closeDelay={160}
			>
				<CartoonPopoverTrigger
					disabled={disabled}
					aria-controls={dialogId}
					className={cn(styles.trigger, className)}
					data-ai-persona={personaId}
					aria-label={`查看 ${author.displayName} 的 AI 形象介绍`}
					onPointerDown={() => {
						focusRef.current = { pointer: true, opened: false };
					}}
					onPointerCancel={() => {
						focusRef.current.pointer = false;
					}}
					onFocus={() => {
						// 指针产生的 focus 交给随后的原生 click，避免先开再反转。
						if (disabled || focusRef.current.pointer) return;
						focusRef.current.opened = true;
						setOpen(true);
					}}
					onBlur={(event) => {
						focusRef.current = { pointer: false, opened: false };
						const cardId = event.currentTarget.getAttribute("aria-controls");
						if (
							event.relatedTarget &&
							!document.getElementById(cardId ?? "")?.contains(event.relatedTarget)
						) {
							setOpen(false);
						}
					}}
					onClick={(event) => {
						if (focusRef.current.opened && open) event.preventDefault();
						focusRef.current = { pointer: false, opened: false };
					}}
				>
					{children}
				</CartoonPopoverTrigger>
				<CartoonPopoverContent
					role="presentation"
					data-ai-persona={personaId}
					className={styles.card}
					style={cardStyle}
					side="top"
					align="center"
					sideOffset={12}
					collisionPadding={16}
					showShine={false}
				>
					<Dialog.Content
						asChild
						id={dialogId}
						onInteractOutside={(event) => {
							const node = event.target;
							if (
								node instanceof Element &&
								node.closest("button")?.getAttribute("aria-controls") === dialogId
							) {
								event.preventDefault();
							}
						}}
						onOpenAutoFocus={(event) => event.preventDefault()}
						onCloseAutoFocus={(event) => event.preventDefault()}
					>
						<div>
							<div className={styles.coverFrame}>
								<img
									src={persona.coverUrl}
									alt=""
									width={1280}
									height={persona.coverHeight}
									className={styles.cover}
								/>
							</div>
							<div className={styles.body}>
								<div className={styles.identity}>
									<img
										src={persona.avatarUrl}
										alt=""
										width={44}
										height={44}
										className={styles.avatar}
									/>
									<div>
										<Dialog.Title className={styles.name}>
											{persona.name}
										</Dialog.Title>
										<p className={styles.caption}>本站拟人形象 · AI 自署名</p>
									</div>
								</div>
								<p className={styles.signature}>
									自署名：{name.trim() ? name : "未提供署名"}
								</p>
								<Dialog.Description className={styles.description}>
									{persona.description}
								</Dialog.Description>
							</div>
						</div>
					</Dialog.Content>
				</CartoonPopoverContent>
			</CartoonPopover>
		</Dialog.Root>
	);
}
