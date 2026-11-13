import { Link } from "@tanstack/react-router";
import type { ComponentProps, ComponentType } from "react";

/**
 * 导航链接统一通过 href 接收目标，原生属性与 ref 必须透传。
 *
 * @remarks Segmented 与 Dropdown 的 asChild 组合依赖状态属性和引用。
 */
export interface NavbarLinkProps extends ComponentProps<"a"> {
	href: string;
}

export type NavbarLinkComponent = ComponentType<NavbarLinkProps>;

/**
 * 默认实现：交给 TanStack Router 做客户端跳转。
 *
 * @remarks 仅精确命中时自动标记当前页，其余当前项由导航数据显式给出。
 */
export function RouterLink({ href, ...props }: NavbarLinkProps) {
	return <Link to={href} activeOptions={{ exact: true }} {...props} />;
}
