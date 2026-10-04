import { cn } from "cn";
import type * as React from "react";

/**
 * 完整原生 textarea 属性；ref 指向 textarea，rows 保持浏览器语义。
 */
export interface TextareaProps extends React.ComponentProps<"textarea"> {}

/**
 * 保留原生输入、表单提交与重置行为的多行文本控件。
 */
export function Textarea({ className, ...props }: TextareaProps) {
	return <textarea {...props} data-slot="textarea" className={cn("v-textarea", className)} />;
}
