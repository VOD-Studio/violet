import { z } from "zod";

/**
 * admin-roles 表单 zod schema
 *
 * 角色名称与描述规则，创建与编辑共用同一套校验。
 */

/** 角色创建/编辑表单 */
export const roleSchema = z.object({
    name: z
        .string()
        .min(2, "角色名称至少 2 个字符")
        .max(50, "角色名称最多 50 个字符")
        .regex(/^[a-zA-Z0-9_-]+$/, "角色名称只能包含字母、数字、下划线和连字符"),
    description: z.string().min(2, "角色描述至少 2 个字符").max(200, "角色描述最多 200 字符"),
});

/** 角色表单类型 */
export type RoleForm = z.infer<typeof roleSchema>;
