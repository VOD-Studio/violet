import { cn } from "cn";
import type * as React from "react";

/**
 * 完整原生 input 属性；ref 指向 input，size 保持 HTML 字符宽度语义。
 */
export interface InputProps extends React.ComponentProps<"input"> {}

/**
 * 保留原生受控、非受控、表单提交与重置行为的输入控件。
 */
export function Input({ className, ...props }: InputProps) {
	return <input {...props} data-slot="input" className={cn("v-input", className)} />;
}
