import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn - 合并 Tailwind class 并处理冲突
 *
 * shadcn/ui 与项目内组件统一使用此工具合并 class。
 *
 * @param inputs class 列表（字符串、对象、数组均可）
 * @returns 合并去重后的 class 字符串
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-primary")
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
