"use client";

import { cn } from "cn";
import { Crown } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";

export type AvatarSize = 24 | 32 | 40 | 48 | 64 | 96;
export type AvatarStatus = "online" | "away" | "busy";

/** 头像的属性；根节点是 span，ref 指向它。 */
export interface AvatarProps extends Omit<ComponentProps<"span">, "children"> {
	src?: string;
	/** 显示名；没有图片时取第一个字（英文取首字母大写）作为替代。 */
	name?: string;
	/** 默认取 `name`；传空字符串表示装饰（名字已显示在旁边）。 */
	alt?: string;
	/** @default 40 */
	size?: AvatarSize;
	/** 人为圆形，频道、机器人、人设为圆角方形。 @default "circle" */
	shape?: "circle" | "square";
	/** 替代首字显示，例如频道的 Hash 图标。 */
	icon?: ReactNode;
	/** `season` 为「你自己」使用的季节色淡底。 @default "neutral" */
	tone?: "neutral" | "season";
	status?: AvatarStatus;
	/** 覆盖状态的朗读文字，默认「在线」「离开」「勿扰」。 */
	statusLabel?: string;
	/** 站长的季节色挂饰。 */
	ring?: boolean;
	/** 本文作者的皇冠。 */
	crown?: boolean;
	/** 透传给 `<img>`；`onLoad`、`onError` 会与组件自身的处理一并调用。 */
	imgProps?: Omit<ComponentProps<"img">, "src" | "alt" | "children">;
}

const STATUS_TEXT: Record<AvatarStatus, string> = {
	online: "在线",
	away: "离开",
	busy: "勿扰",
};

const CROWN_TEXT = "作者";

function initialOf(name: string | undefined) {
	const first = Array.from(name?.trim() ?? "")[0];
	return first ? first.toUpperCase() : "";
}

/** 人、频道与人设的头像；图片未到时为呼吸占位，失败退回首字或图标。 */
export function Avatar({
	src,
	name,
	alt,
	size = 40,
	shape = "circle",
	icon,
	tone = "neutral",
	status,
	statusLabel,
	ring,
	crown,
	imgProps,
	className,
	ref,
	...props
}: AvatarProps) {
	const [result, setResult] = useState<{ src: string; ok: boolean } | null>(null);
	const phase = !src
		? "fallback"
		: result?.src === src
			? result.ok
				? "loaded"
				: "fallback"
			: "loading";

	const label = [
		alt ?? name ?? "",
		status ? (statusLabel ?? STATUS_TEXT[status]) : "",
		crown ? CROWN_TEXT : "",
	]
		.filter(Boolean)
		.join("，");

	return (
		<span
			{...(label ? { role: "img", "aria-label": label } : null)}
			{...props}
			ref={ref}
			data-size={size}
			data-state={phase}
			className={cn(
				"v-avatar",
				shape === "square" && "v-avatar--square",
				tone === "season" && "v-avatar--season",
				ring && "v-avatar--ring",
				className,
			)}
		>
			{src && phase !== "fallback" && (
				<img
					decoding="async"
					{...imgProps}
					className={cn("v-avatar__image", imgProps?.className)}
					src={src}
					alt=""
					aria-hidden="true"
					ref={(img) => {
						if (img && phase === "loading" && img.complete) {
							setResult({ src, ok: img.naturalWidth > 0 });
						}
					}}
					onLoad={(event) => {
						imgProps?.onLoad?.(event);
						setResult({ src, ok: true });
					}}
					onError={(event) => {
						imgProps?.onError?.(event);
						setResult({ src, ok: false });
					}}
				/>
			)}
			{phase === "fallback" && (
				<span className="v-avatar__glyph" aria-hidden="true">
					{icon ?? initialOf(name)}
				</span>
			)}
			{status && <i className="v-avatar__dot" data-status={status} aria-hidden="true" />}
			{crown && (
				<i className="v-avatar__crown" aria-hidden="true">
					<Crown size={12} strokeWidth={2} />
				</i>
			)}
		</span>
	);
}

/** 一组头像的属性；根节点是 span，ref 指向它。 */
export interface AvatarGroupProps extends Omit<ComponentProps<"span">, "children"> {
	items: { name: string; src?: string }[];
	/** 最多显示的头像数，其余折成「+N」。 @default 3 */
	max?: number;
	size?: AvatarSize;
	shape?: "circle" | "square";
	/** 整组的名称，例如「12 人点了赞」；省略时不声明 group，成员各自按名字朗读。 */
	label?: string;
}

/** 一组相互压叠的头像，指针悬停时展开；超出 `max` 的折成「+N」。 */
export function AvatarGroup({
	items,
	max = 3,
	size = 40,
	shape = "circle",
	label,
	className,
	ref,
	...props
}: AvatarGroupProps) {
	if (items.length === 0) return null;
	const visible = items.slice(0, Math.max(0, max));
	const rest = items.length - visible.length;
	return (
		<span
			{...(label ? { role: "group", "aria-label": label } : null)}
			{...props}
			ref={ref}
			className={cn("v-avatar-group", className)}
		>
			{visible.map((item, index) => (
				// 成员可能重名，顺序固定，用下标区分。
				<Avatar
					key={`${index}:${item.name}`}
					name={item.name}
					src={item.src}
					size={size}
					shape={shape}
				/>
			))}
			{rest > 0 && (
				<Avatar
					alt={`还有 ${rest} 人`}
					size={size}
					shape={shape}
					icon={<span className="v-avatar-group__more">+{rest}</span>}
				/>
			)}
		</span>
	);
}
