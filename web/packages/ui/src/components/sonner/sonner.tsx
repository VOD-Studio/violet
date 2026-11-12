import { cn } from "cn";
import { XIcon } from "lucide-react";
import { type CSSProperties, useSyncExternalStore } from "react";
import { Toaster as Sonner, type ToastClassnames, type ToasterProps } from "sonner";
import { Spinner } from "../indicator";
import { ToastErrorIcon, ToastInfoIcon, ToastSuccessIcon, ToastWarningIcon } from "./toast-icons";
import { useToastPolicy } from "./use-toast-policy";

/** Toaster 的属性：sonner 的全部配置，位置、时长与划走方向已按设计稿设好默认值。 */
export interface VioletToasterProps extends ToasterProps {
	/** 明暗主题，默认由 sonner 自行推断；宿主可传自身主题系统的当前值 */
	theme?: ToasterProps["theme"];
}

/** sonner 自带的窄屏断点：此宽度及以下通知区改为底部通栏。 */
const NARROW_QUERY = "(max-width: 600px)";

const subscribeNarrow = (notify: () => void) => {
	const query = window.matchMedia(NARROW_QUERY);
	query.addEventListener("change", notify);
	return () => query.removeEventListener("change", notify);
};
const isNarrow = () => window.matchMedia(NARROW_QUERY).matches;

const OFFSET = { right: 24, bottom: 24 };
const MOBILE_OFFSET = {
	left: 12,
	right: 12,
	bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
};
const NARROW_SWIPE: ToasterProps["swipeDirections"] = ["bottom"];

const CLASS_NAMES: ToastClassnames = {
	toast: "v-toast",
	icon: "v-toast__icon",
	loader: "v-toast__loader",
	content: "v-toast__content",
	title: "v-toast__title",
	description: "v-toast__description",
	actionButton: "v-toast__action",
	cancelButton: "v-toast__cancel",
	closeButton: "v-toast__close",
	success: "v-toast--success",
	error: "v-toast--error",
	warning: "v-toast--warning",
	info: "v-toast--info",
	loading: "v-toast--loading",
};

/** 内置类名在前，调用方传入的同名项追加其后。 */
function mergeClassNames(extra: ToastClassnames | undefined): ToastClassnames {
	const merged: ToastClassnames = { ...extra };
	for (const key of Object.keys(CLASS_NAMES) as (keyof ToastClassnames)[]) {
		merged[key] = cn(CLASS_NAMES[key], extra?.[key]);
	}
	return merged;
}

/** 18 线框；颜色由 CSS 按类型只落在图标上。加载中沿用指示器的控件圆弧。 */
const ICONS: NonNullable<ToasterProps["icons"]> = {
	success: (
		<span className="v-toast__glyph">
			<ToastSuccessIcon size={18} />
		</span>
	),
	error: (
		<span className="v-toast__glyph">
			<ToastErrorIcon size={18} />
		</span>
	),
	warning: (
		<span className="v-toast__glyph">
			<ToastWarningIcon size={18} />
		</span>
	),
	info: (
		<span className="v-toast__glyph">
			<ToastInfoIcon size={18} />
		</span>
	),
	// 指示器尺寸档没有 18，直接覆盖它的尺寸变量
	loading: <Spinner aria-hidden="true" style={{ "--v-spinner-size": "18px" } as CSSProperties} />,
	close: <XIcon size={10} strokeWidth={2.4} />,
};

/**
 * 轻提示容器：sonner 做引擎（叠放、划走、计时、热键），外观与动效由 `sonner.css` 的
 * `.v-toast` 系列类提供。站点根部挂一个即可，调用方仍然直接用 `sonner` 的 `toast`。
 *
 * @remarks
 * - 默认右下角离边 24、宽 356；窄屏（≤600px）为底部通栏，左右各 12、离底 12 加安全区，
 *   且只能向下划走。
 * - 通知区标为「通知（⌥T）」，⌥T 把焦点移进去并展开列表；指针移入或展开时所有计时暂停。
 * - 出错不自动关、带操作 8 秒、警告 6 秒、其余 4 秒；同时最多保留 6 条。
 * - 多个通知区共存时给每个设不同 `id`，发通知时带上相同的 `toasterId`。
 */
export function Toaster({
	id,
	className,
	style,
	icons,
	toastOptions,
	swipeDirections,
	hotkey,
	customAriaLabel,
	containerAriaLabel = "通知",
	offset = OFFSET,
	mobileOffset = MOBILE_OFFSET,
	closeButton = true,
	duration = 4000,
	gap = 14,
	visibleToasts = 3,
	...props
}: VioletToasterProps) {
	useToastPolicy(id);
	const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
	return (
		<Sonner
			{...props}
			id={id}
			hotkey={hotkey}
			className={cn("v-toaster", className)}
			// 压过 sonner 自带的巨大 z-index；字体沿用页面
			style={{ zIndex: "var(--layer-toast)", fontFamily: "inherit", ...style }}
			icons={{ ...ICONS, ...icons }}
			offset={offset}
			mobileOffset={mobileOffset}
			closeButton={closeButton}
			duration={duration}
			gap={gap}
			visibleToasts={visibleToasts}
			swipeDirections={swipeDirections ?? (narrow ? NARROW_SWIPE : undefined)}
			containerAriaLabel={containerAriaLabel}
			// 标签里的热键字样与默认热键一致；换了热键就交回 sonner 按热键拼
			customAriaLabel={customAriaLabel ?? (hotkey ? undefined : "通知（⌥T）")}
			toastOptions={{
				...toastOptions,
				unstyled: true,
				closeButtonAriaLabel: toastOptions?.closeButtonAriaLabel ?? "关闭",
				classNames: mergeClassNames(toastOptions?.classNames),
			}}
		/>
	);
}
