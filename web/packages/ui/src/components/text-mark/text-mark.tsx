import { cn } from "cn";
import type { ComponentProps } from "react";

/** 原生 mark 属性；不解析文本、不注入 HTML，也不增加交互与焦点。 */
export type TextMarkProps = ComponentProps<"mark">;

/** 用随季节变色的静态荧光笔笔触标出相关文本，跨行时逐行保留底色。 */
export function TextMark({ className, ...props }: TextMarkProps) {
	return <mark {...props} className={cn("v-text-mark", className)} />;
}
