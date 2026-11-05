import type { ComponentProps } from "react";

/** 展品里的链接只阻止跳转；ref 与其余属性透传，可作 asChild 触发器。 */
export function StayLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
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
