import { z } from "zod";

/**
 * admin-announcements 表单 zod schema
 *
 * startTime/endTime 为 datetime-local 字符串，可空，用 superRefine 校验：
 * 若都填了，开始不得晚于结束。
 */

/** 创建/编辑公告表单 */
export const announcementSchema = z
    .object({
        title: z.string().min(1, "标题不能为空").max(200, "标题最多 200 字符"),
        content: z.string().min(1, "内容不能为空"),
        type: z.enum(["info", "warning", "success", "error"]),
        isActive: z.boolean(),
        startTime: z.string().optional().or(z.literal("")),
        endTime: z.string().optional().or(z.literal("")),
    })
    .superRefine((data, ctx) => {
        if (data.startTime && data.endTime) {
            if (new Date(data.startTime) > new Date(data.endTime)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["endTime"],
                    message: "结束时间不得早于开始时间",
                });
            }
        }
    });

/** 公告表单类型 */
export type AnnouncementForm = z.infer<typeof announcementSchema>;
