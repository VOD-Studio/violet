"use client";

import { cn } from "cn";
import { type CSSProperties, createContext, type ReactNode, useContext } from "react";

import { type SharedName, useSharedIntent } from "./intent";

const OptOut = createContext(false);

/**
 * 让子树中的所有共享元素不参与转场。
 *
 * 用在会重复出现来源元素的页面区域：例如用户主页的推文流里，同一作者的头像不能和资料栏头像同名。
 */
export function NoSharedElements({ children }: { children: ReactNode }) {
	return <OptOut.Provider value={true}>{children}</OptOut.Provider>;
}

export interface SharedElementOptions {
	name: SharedName;
	/** 实体 id；与点击登记的意图一致的元素才参与 morph。 */
	id: string;
	/** 来源页上同一实体出现多次时，用于唯一指定被点击的那一个；目标页的元素不传。 */
	instance?: string;
}

/**
 * 共享元素的属性：意图匹配时带上 `view-transition-name` 与共享类，否则为空。
 *
 * 同一时刻页面上同一种元素至多一个带转场名，重复会让整次转场失败；因此只有意图匹配才占用转场名。
 * 需要把转场名直接放在已有元素（如 img）上时用它，包一层容器时用 SharedElement。
 *
 * @example
 * const shared = useSharedElement({ name: "avatar", id: user.id, instance: tweet.id });
 * <img className={cn("avatar", shared.className)} style={shared.style} />
 */
export function useSharedElement({ name, id, instance }: SharedElementOptions): {
	className?: string;
	style?: CSSProperties;
} {
	const optedOut = useContext(OptOut);
	const active = useSharedIntent(
		(state) =>
			!optedOut &&
			state.intent?.name === name &&
			state.intent.id === id &&
			(instance === undefined || state.intent.instance === instance),
	);
	return active ? { className: "vt-shared", style: { viewTransitionName: `vt-${name}` } } : {};
}

export interface SharedElementProps extends SharedElementOptions {
	className?: string;
	children: ReactNode;
}

/**
 * 参与跨页面 morph 的共享元素容器。
 *
 * 来源页与目标页各放一个同 name、同 id 的容器，浏览器在两者之间变形。
 *
 * @example
 * <SharedElement name="cover" id={post.slug}>
 *   <img src={post.cover_image} alt="" />
 * </SharedElement>
 */
export function SharedElement({ className, children, ...options }: SharedElementProps) {
	const shared = useSharedElement(options);
	return (
		<div className={cn(shared.className, className)} style={shared.style}>
			{children}
		</div>
	);
}
