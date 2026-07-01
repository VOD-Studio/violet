import { z } from "zod";

/**
 * admin-tags 表单 zod schema
 *
 * 标签名规则与后端对齐，由 react-hook-form 经 zodResolver 消费。
 */

/** 标签创建/编辑表单 */
export const tagSchema = z.object({
    name: z.string().min(1, "标签名不能为空").max(50, "标签名最多 50 字符"),
});

/** 标签表单类型 */
export type TagForm = z.infer<typeof tagSchema>;
