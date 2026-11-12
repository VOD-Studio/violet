import { Link } from "@tanstack/react-router";
import type { ComponentProps, ComponentType } from "react";

/**
 * 导航里链接的渲染契约：普通锚点属性加 `href`，`ref` 与其余属性必须透传，
 * 因为 Segmented 与 Dropdown 触发器会把状态属性和 `asChild` 引用交给它。
 */
export type NavbarLinkComponent = ComponentType<ComponentProps<"a"> & { href: string }>;

/**
 * 默认实现：交给 TanStack Router 做客户端跳转。
 *
 * Link 会给路径前缀命中的链接自动加 `aria-current`，会把「博客」下的「全部文章」也标成当前页；
 * 这里只认精确命中，其余情况的当前项由调用方按导航数据显式给出。
 */
export function RouterLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
	return <Link to={href} activeOptions={{ exact: true }} {...props} />;
}
