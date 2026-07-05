import { z } from "zod";

/** 展示形态枚举 */
export const DISPLAY_OPTIONS = ["banner", "card", "article"] as const;

/** 影响范围可选模块（对齐后端 affects 枚举） */
export const AFFECTS_OPTIONS = [
    "posts",
    "comments",
    "auth",
    "media",
    "search",
    "projects",
    "profile",
    "site",
] as const;

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
        display: z.enum(DISPLAY_OPTIONS),
        isActive: z.boolean(),
        sortOrder: z.number().int().min(0),
        affects: z.array(z.string()),
        excerpt: z.string().optional().or(z.literal("")),
        coverImage: z.string().optional().or(z.literal("")),
        contentMD: z.string().optional().or(z.literal("")),
        contentHTML: z.string().optional().or(z.literal("")),
        timeRange: z
            .object({
                start: z.string().optional().or(z.literal("")),
                end: z.string().optional().or(z.literal("")),
            })
            .optional(),
    })
    .superRefine((data, ctx) => {
        if (data.timeRange?.start && data.timeRange?.end) {
            if (new Date(data.timeRange.start) > new Date(data.timeRange.end)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["timeRange", "end"],
                    message: "结束时间不得早于开始时间",
                });
            }
        }
    });

/** 公告表单类型 */
export type AnnouncementForm = z.infer<typeof announcementSchema>;
