import { Segmented } from "@violet/ui";
import { type ComponentProps, useState } from "react";

/** 示例链接只阻止默认跳转，保持在文档页内。 */
function DocLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
	return (
		<a
			href={href}
			{...props}
			onClick={(event) => {
				onClick?.(event);
				event.preventDefault();
			}}
		/>
	);
}

const PAGES = [
	{ value: "home", label: "首页", href: "#home" },
	{ value: "posts", label: "文章", href: "#posts" },
	{ value: "about", label: "关于", href: "#about" },
];

/** render 展开分段属性到链接上；选中值由示例自己维护，真实站点由路由决定。 */
export function SegmentedRenderDemo() {
	const [value, setValue] = useState("posts");

	return (
		<nav aria-label="Segmented 链接示例">
			<Segmented
				value={value}
				onValueChange={setValue}
				segments={PAGES.map((page) => ({
					value: page.value,
					label: page.label,
					render: (props, { active }) => (
						<DocLink
							{...props}
							href={page.href}
							aria-current={active ? "page" : undefined}
						/>
					),
				}))}
			/>
		</nav>
	);
}
