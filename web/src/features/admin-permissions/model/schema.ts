import { z } from "zod";

/**
 * admin-permissions 表单 zod schema
 *
 * code 校验依赖 type：menu 允许纯 module 名（post），action 要求 module:action（post:create）。
 * 用 superRefine 把 type 作为上下文做差异化校验。
 */

/** 创建/编辑权限表单 */
export const permissionSchema = z
    .object({
        type: z.enum(["menu", "action"]),
        parentId: z.string().optional(),
        code: z.string().min(1, "权限代码不能为空").max(50, "权限代码最多 50 字符"),
        name: z.string().min(1, "权限名称不能为空").max(100, "名称最多 100 字符"),
        description: z.string().max(500, "描述最多 500 字符").optional().or(z.literal("")),
        sort: z.number().int("排序为整数").min(0, "排序为非负整数"),
    })
    .superRefine((data, ctx) => {
        if (data.type === "menu") {
            // menu：纯 module 名
            if (!/^[a-z]+$/.test(data.code)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["code"],
                    message: "menu 代码必须为纯小写字母，如 post、user",
                });
            }
        } else {
            // action：用户只输入动作名，提交时会自动拼接为 module:action
            if (!/^[a-z][a-z-]*$/.test(data.code)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["code"],
                    message:
                        "action 代码只能包含小写字母和连字符，且不能以连字符开头，如 create、edit-list",
                });
            }
            if (!data.parentId) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["parentId"],
                    message: "action 必须选择所属分组",
                });
            }
        }
    });

/** 权限表单类型 */
export type PermissionForm = z.infer<typeof permissionSchema>;
