import { z } from "zod";

/**
 * admin-users 表单 zod schema
 *
 * 创建与编辑用户表单。password 在创建时必填、编辑时可选，故保留两套 schema。
 */

/** 创建用户表单 */
export const createUserSchema = z.object({
	username: z
		.string()
		.min(3, "用户名至少 3 个字符")
		.max(32, "用户名最多 32 个字符")
		.regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符"),
	email: z.string().email("请输入有效的邮箱地址"),
	password: z.string().min(6, "密码至少 6 位"),
	role: z.string().min(1, "请选择角色"),
	is_active: z.boolean(),
});

/** 编辑用户表单，密码可选，留空表示不修改 */
export const editUserSchema = z.object({
	username: z
		.string()
		.min(3, "用户名至少 3 个字符")
		.max(32, "用户名最多 32 个字符")
		.regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符"),
	email: z.string().email("请输入有效的邮箱地址"),
	password: z.string().min(6, "密码至少 6 位").optional().or(z.literal("")),
	role: z.string().min(1, "请选择角色"),
	is_active: z.boolean(),
});

export type CreateUserForm = z.infer<typeof createUserSchema>;
export type EditUserForm = z.infer<typeof editUserSchema>;
