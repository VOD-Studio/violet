import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Modal } from "@shared/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Textarea } from "@shared/ui/textarea";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateAnnouncement, useUpdateAnnouncement } from "../api/queries";
import type { AnnouncementDTO, AnnouncementType } from "../model/types";

/**
 * 创建/编辑公告表单 Schema
 *
 * startTime/endTime 为 datetime-local 字符串（可空），用 superRefine 校验：
 * 若都填了，开始不得晚于结束。
 */
const announcementSchema = z
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

type AnnouncementForm = z.infer<typeof announcementSchema>;

interface AnnouncementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 传入则编辑模式，否则新建 */
    editing?: AnnouncementDTO | null;
}

const TYPE_OPTIONS: { value: AnnouncementType; label: string }[] = [
    { value: "info", label: "信息" },
    { value: "warning", label: "警告" },
    { value: "success", label: "成功" },
    { value: "error", label: "错误" },
];

export function AnnouncementDialog({ open, onOpenChange, editing }: AnnouncementDialogProps) {
    const isEdit = !!editing;
    const createAnn = useCreateAnnouncement();
    const updateAnn = useUpdateAnnouncement();

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors },
    } = useForm<AnnouncementForm>({
        resolver: zodResolver(announcementSchema),
        defaultValues: {
            title: "",
            content: "",
            type: "info",
            isActive: true,
            startTime: "",
            endTime: "",
        },
    });

    // 对话框开关 / 编辑对象变化时重置表单
    useEffect(() => {
        if (!open) return;
        reset({
            title: editing?.title || "",
            content: editing?.content || "",
            type: (editing?.type as AnnouncementType) || "info",
            isActive: editing?.is_active ?? true,
            // RFC3339 → datetime-local（取前 16 位 "YYYY-MM-DDTHH:mm"）
            startTime: editing?.start_time ? editing.start_time.slice(0, 16) : "",
            endTime: editing?.end_time ? editing.end_time.slice(0, 16) : "",
        });
    }, [open, editing, reset]);

    /** datetime-local 字符串 → RFC3339；空串返回 undefined */
    const toRFC3339 = (local: string): string | undefined => {
        if (!local) return undefined;
        const d = new Date(local);
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    };

    const onSubmit = (data: AnnouncementForm) => {
        const payload = {
            title: data.title,
            content: data.content,
            type: data.type,
            is_active: data.isActive,
            start_time: toRFC3339(data.startTime ?? ""),
            end_time: toRFC3339(data.endTime ?? ""),
        };
        if (isEdit && editing?.id) {
            updateAnn.mutate(
                { id: editing.id, body: payload },
                { onSuccess: () => onOpenChange(false) },
            );
        } else {
            createAnn.mutate(payload, { onSuccess: () => onOpenChange(false) });
        }
    };

    const pending = createAnn.isPending || updateAnn.isPending;

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={isEdit ? "编辑公告" : "创建公告"}
            description={isEdit ? "修改公告内容与生效设置" : "新建一条站点公告"}
            size="md"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={pending}
                    >
                        取消
                    </Button>
                    <Button type="submit" form="announcement-form" disabled={pending}>
                        {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
                        {isEdit ? "保存" : "创建"}
                    </Button>
                </>
            }
        >
            <form id="announcement-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* 标题 */}
                <div className="space-y-2">
                    <Label htmlFor="ann-title">
                        标题 <span className="text-destructive">*</span>
                    </Label>
                    <Input id="ann-title" disabled={pending} {...register("title")} />
                    {errors.title && (
                        <p className="text-destructive text-sm">{errors.title.message}</p>
                    )}
                </div>

                {/* 类型 */}
                <div className="space-y-2">
                    <Label>类型</Label>
                    <Controller
                        control={control}
                        name="type"
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TYPE_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>

                {/* 内容 */}
                <div className="space-y-2">
                    <Label htmlFor="ann-content">
                        内容 <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                        id="ann-content"
                        rows={4}
                        disabled={pending}
                        {...register("content")}
                    />
                    {errors.content && (
                        <p className="text-destructive text-sm">{errors.content.message}</p>
                    )}
                </div>

                {/* 启用 */}
                <div className="flex items-center gap-2">
                    <Controller
                        control={control}
                        name="isActive"
                        render={({ field }) => (
                            <Switch
                                id="ann-active"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <Label htmlFor="ann-active">启用</Label>
                </div>

                {/* 生效区间 */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="ann-start">生效开始（可选）</Label>
                        <Input
                            id="ann-start"
                            type="datetime-local"
                            disabled={pending}
                            {...register("startTime")}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ann-end">生效结束（可选）</Label>
                        <Input
                            id="ann-end"
                            type="datetime-local"
                            disabled={pending}
                            {...register("endTime")}
                        />
                        {errors.endTime && (
                            <p className="text-destructive text-sm">{errors.endTime.message}</p>
                        )}
                    </div>
                </div>
            </form>
        </Modal>
    );
}
