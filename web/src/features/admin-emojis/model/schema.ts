import { z } from "zod";

/**
 * admin-emojis 表单 zod schema
 *
 * 表情分组与表情项的创建/编辑表单统一放在 model 层，
 * 由 react-hook-form 经 zodResolver 消费。
 */

/** 表情分组创建/编辑表单 */
export const emojiGroupSchema = z.object({
    name: z.string().min(1, "分组名称不能为空").max(50, "分组名称最多 50 字符"),
    source: z.string(),
    cover_url: z.string().optional(),
    sort_order: z.number().int().min(0, "排序权重不能为负数"),
    is_enabled: z.boolean(),
});

/** 表情分组表单类型 */
export type EmojiGroupForm = z.infer<typeof emojiGroupSchema>;

/** 表情编辑表单 */
export const emojiEditSchema = z.object({
    name: z.string().min(1, "表情名称不能为空").max(50, "表情名称最多 50 字符"),
    url: z.string().optional(),
    textContent: z.string().optional(),
    // meta 子字段（可选）：alias 为别名，size 为尺寸，type 为门槛类型
    metaAlias: z.string().optional(),
    metaSize: z.number().int().optional(),
    metaType: z.number().int().optional(),
});

/** 表情编辑表单类型 */
export type EmojiEditForm = z.infer<typeof emojiEditSchema>;

/** 文本表情创建表单 */
export const emojiTextSchema = z.object({
    name: z.string().min(1, "名称不能为空").max(50, "名称最多 50 字符"),
    textContent: z.string().min(1, "文本内容不能为空").max(50, "文本内容最多 50 字符"),
});

/** 文本表情表单类型 */
export type EmojiTextForm = z.infer<typeof emojiTextSchema>;
