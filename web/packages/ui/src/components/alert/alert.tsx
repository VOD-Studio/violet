import { cn } from "cn";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";

/** 提示的语气；颜色只做辅助，语气由标题文字和图标表达。 */
export type AlertTone = "info" | "success" | "warning" | "danger";

/** 提示里的一个文字动作。 */
export interface AlertAction {
	label: ReactNode;
	/** 点击处理；与 `href` 二选一 */
	onClick?: () => void;
	/** 跳转目标；传了渲染为链接 */
	href?: string;
}

export interface AlertProps extends Omit<ComponentProps<"div">, "title"> {
	/** 语气；默认 info */
	tone?: AlertTone;
	/** 一句话标题 */
	title: ReactNode;
	/** 补充说明，写发生了什么或现在能做什么 */
	description?: ReactNode;
	/** 一个文字动作 */
	action?: AlertAction;
	/** 关闭回调；传了才显示关闭钮 */
	onDismiss?: () => void;
	/** 强制显示或隐藏关闭钮；默认由 `onDismiss` 决定 */
	dismissible?: boolean;
	/** 表单或卡片里的一行提示：不要标题与关闭，只留图标加一句话 */
	compact?: boolean;
}

const ICONS = {
	info: Info,
	success: CircleCheck,
	warning: TriangleAlert,
	danger: CircleAlert,
} as const;

const FOCUSABLE =
	'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function nextFocusable(from: HTMLElement | null) {
	if (!from) return null;
	const candidates = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(element) => element.offsetParent !== null && !from.contains(element),
	);
	return (
		candidates.find(
			(element) => from.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
		) ?? null
	);
}

/**
 * 留在页面里的内联提示，四种语气；可带一个文字动作与关闭。
 *
 * @remarks
 * 危险语气使用 `role="alert"` 立即朗读，其余用 `role="status"`。
 * 关闭先淡出 140ms、再收起高度 200ms，然后把焦点交给提示之后的下一个可聚焦元素；
 * 减弱动态下直接消失。
 */
export function Alert({
	tone = "info",
	title,
	description,
	action,
	onDismiss,
	dismissible,
	compact = false,
	className,
	...props
}: AlertProps) {
	const Icon = ICONS[tone];
	const [phase, setPhase] = useState<"open" | "closing" | "collapsed">("open");
	const rootRef = useRef<HTMLDivElement | null>(null);
	const timers = useRef<number[]>([]);

	useEffect(() => {
		return () => {
			for (const timer of timers.current) window.clearTimeout(timer);
		};
	}, []);

	const canDismiss = !compact && (dismissible ?? onDismiss !== undefined);
	if (phase === "collapsed" && canDismiss) return null;

	function close() {
		const next = nextFocusable(rootRef.current);
		const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
		const fade = reduced ? 0 : 140;
		const collapse = reduced ? 0 : 200;
		setPhase("closing");
		timers.current.push(
			window.setTimeout(() => {
				const element = rootRef.current;
				if (element) {
					element.style.blockSize = `${element.offsetHeight}px`;
					element.style.overflow = "hidden";
					window.setTimeout(() => {
						element.style.blockSize = "0px";
						element.style.paddingBlock = "0px";
						element.style.marginBlock = "0px";
					}, 0);
				}
				timers.current.push(
					window.setTimeout(() => {
						setPhase("collapsed");
						next?.focus();
						onDismiss?.();
					}, collapse),
				);
			}, fade),
		);
	}

	return (
		<div
			ref={rootRef}
			data-slot="alert"
			data-tone={tone}
			data-compact={compact ? "" : undefined}
			data-state={phase}
			role={tone === "danger" ? "alert" : "status"}
			className={cn("v-alert", className)}
			{...props}
		>
			<Icon className="v-alert__icon" aria-hidden="true" />
			{compact ? (
				<span className="v-alert__inline">{title}</span>
			) : (
				<>
					<div className="v-alert__body">
						<b className="v-alert__title">{title}</b>
						{description !== undefined ? (
							<span className="v-alert__description">{description}</span>
						) : null}
					</div>
					{action !== undefined ? (
						action.href !== undefined ? (
							<a className="v-alert__action" href={action.href}>
								{action.label}
							</a>
						) : (
							<button
								type="button"
								className="v-alert__action"
								onClick={action.onClick}
							>
								{action.label}
							</button>
						)
					) : null}
					{canDismiss ? (
						<button
							type="button"
							className="v-alert__close"
							aria-label="关闭"
							onClick={close}
						>
							<X aria-hidden="true" />
						</button>
					) : null}
				</>
			)}
		</div>
	);
}
