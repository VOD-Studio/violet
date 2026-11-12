import { cn } from "cn";
import type { ComponentProps } from "react";

/** 保留原生 code 属性与 ref 的行内代码。 */
export function InlineCode({ className, ...props }: ComponentProps<"code">) {
	return <code {...props} className={cn("v-inline-code", "not-prose", className)} />;
}
