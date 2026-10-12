import {
	CartoonPopover,
	CartoonPopoverContent,
	CartoonPopoverTrigger,
} from "@shared/ui/cartoon-popover";
import { cn } from "cn";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { AI_PERSONAS, getCommentAuthorPresentation } from "../lib/ai-personas";
import styles from "./AICommentProfile.module.css";
import "./ai-personas.css";

/** children 仅放头像或文字，不可包含按钮、链接等交互节点。 */
export interface AICommentProfileProps {
	name: string;
	children: ReactNode;
	className?: string;
}

const cardStyle = {
	"--cartoon-border": "var(--ai-accent)",
	"--cartoon-bg": "color-mix(in oklch, var(--ai-accent) 5%, var(--card))",
} as CSSProperties;

/** AI 自署名的本站拟人介绍，不提供真人主页或已验证身份声明。 */
export function AICommentProfile({ name, children, className }: AICommentProfileProps) {
	const [open, setOpen] = useState(false);
	const focusRef = useRef({ pointer: false, opened: false });
	const titleId = useId();
	const author = getCommentAuthorPresentation({ author_name: name, is_ai: true });
	const personaId = author.personaId ?? "unknown";
	const persona = AI_PERSONAS[personaId];

	useEffect(() => {
		if (!open) return;
		// 先消费最内层 Escape，外层批注的 document 监听不能同时关闭。
		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			event.preventDefault();
			event.stopPropagation();
			setOpen(false);
		}
		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, [open]);

	return (
		<CartoonPopover
			open={open}
			onOpenChange={setOpen}
			triggerMode="both"
			hoverDelay={120}
			closeDelay={160}
		>
			<CartoonPopoverTrigger
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
					if (focusRef.current.pointer) return;
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
				aria-labelledby={titleId}
				data-ai-persona={personaId}
				className={styles.card}
				style={cardStyle}
				side="top"
				align="center"
				sideOffset={12}
				collisionPadding={16}
				showShine={false}
				onPointerDown={(event) => event.stopPropagation()}
			>
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
							<p id={titleId} className={styles.name}>
								{persona.name}
							</p>
							<p className={styles.caption}>本站拟人形象 · AI 自署名</p>
						</div>
					</div>
					<p className={styles.signature}>自署名：{name.trim() ? name : "未提供署名"}</p>
					<p className={styles.description}>{persona.description}</p>
				</div>
			</CartoonPopoverContent>
		</CartoonPopover>
	);
}
