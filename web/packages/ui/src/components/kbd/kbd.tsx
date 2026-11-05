import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import { formatKey, type KbdKey, type KbdPlatform, orderKeys } from "./keys";
import { type KbdVariantProps, kbdVariants } from "./styles";
import { useKbdPlatform } from "./use-kbd-platform";

interface KbdOptions extends KbdVariantProps {
	/**
	 * 显示平台。省略时只在客户端按访客系统检测：服务端与水合首帧写文字修饰符，
	 * 水合后 macOS 访客切换为符号。
	 */
	platform?: KbdPlatform;
}

interface SingleKeyProps extends KbdOptions {
	/** 单个键，如 `Esc`、`/`、`?`；字母用大写。 */
	children?: ReactNode;
	keys?: never;
}

interface ComboProps extends KbdOptions {
	/** 一个组合键：修饰符与主键同在一个键帽里，不写「+」；修饰符自动排在前面。 */
	keys: readonly KbdKey[];
	children?: never;
}

/**
 * 键帽的属性。`size` 与 `variant` 取值：
 * - `variant="default"` 凹陷底色；`"light"` 无底色，用于已有底色的控件内；
 *   `"onButton"` 纸面底色，用于凹陷底色的按钮上。
 * - `size` 为 `"sm"`、`"md"`、`"lg"`。
 */
export type KbdProps = Omit<ComponentProps<"kbd">, "children"> & (SingleKeyProps | ComboProps);

/**
 * 键帽：快捷键的写法，渲染原生 `<kbd>`，一个组合键是一个键帽。
 * 并列可选或先后按下的键各自一个键帽，之间放 {@link KbdSeparator}。
 *
 * @remarks 符号键（⌘ ⇧ ↵ 等）以 `role="img"` 加 `aria-label` 提供读屏名称，读作「Command K」。
 * @example
 * <Kbd keys={["mod", "K"]} />
 */
export function Kbd({
	size,
	variant,
	platform,
	keys,
	className,
	children,
	ref,
	...props
}: KbdProps) {
	const detected = useKbdPlatform();
	const resolved = platform ?? detected;
	return (
		<kbd ref={ref} className={kbdVariants({ size, variant, className })} {...props}>
			{keys ? (
				orderKeys(keys, resolved).map((key, index) => {
					const { label, ariaLabel } = formatKey(key, resolved);
					const id = `${key}-${index}`;
					return ariaLabel ? (
						<span key={id} className="v-kbd__key" role="img" aria-label={ariaLabel}>
							{label}
						</span>
					) : (
						<span key={id} className="v-kbd__key">
							{label}
						</span>
					);
				})
			) : (
				<span className="v-kbd__key">{children}</span>
			)}
		</kbd>
	);
}

/** 键帽之间的连接词，如「或」「然后」；自带语义，不对读屏隐藏。 */
export function KbdSeparator({ className, ...props }: ComponentProps<"span">) {
	return <span className={cn("v-kbd-separator", className)} {...props} />;
}
