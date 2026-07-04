import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shared/ui/base/button";
import { Checkbox } from "@shared/ui/base/checkbox";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@shared/ui/base/select";
import { Switch } from "@shared/ui/base/switch";
import { Textarea } from "@shared/ui/base/textarea";
import { Modal } from "@shared/ui/modal";
import { addDays, addHours, endOfDay, format, startOfDay, startOfHour } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import type { DateTimeRange, DateTimeRangePreset } from "@/shared/ui/date-time-picker";
import { DateTimeRangePickerField } from "@/shared/ui/date-time-picker";
import { useCreateAnnouncement, useUpdateAnnouncement } from "../api/queries";
import {
    AFFECTS_OPTIONS,
    type AnnouncementForm,
    announcementSchema,
    DISPLAY_OPTIONS,
} from "../model/schema";
import type { AnnouncementDisplay, AnnouncementDTO, AnnouncementType } from "../model/types";

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

const DISPLAY_LABELS: Record<AnnouncementDisplay, string> = {
    banner: "横幅（顶部条）",
    card: "卡片（事件票据）",
    article: "文章（事件简报）",
};

export function AnnouncementDialog({ open, onOpenChange, editing }: AnnouncementDialogProps) {
    const isEdit = !!editing;
    const createAnn = useCreateAnnouncement();
    const updateAnn = useUpdateAnnouncement();

    const {
        register,
        handleSubmit,
        control,
        reset,
        watch,
        formState: { errors },
    } = useForm<AnnouncementForm>({
        resolver: zodResolver(announcementSchema),
        defaultValues: {
            title: "",
            content: "",
            type: "info",
            display: "banner",
            isActive: true,
            sortOrder: 0,
            affects: [],
            excerpt: "",
            coverImage: "",
            contentMD: "",
            timeRange: { start: "", end: "" },
        },
    });

    // 对话框开关 / 编辑对象变化时重置表单
    useEffect(() => {
        if (!open) return;
        reset({
            title: editing?.title || "",
            content: editing?.content || "",
            type: (editing?.type as AnnouncementType) || "info",
            display: (editing?.display as AnnouncementDisplay) || "banner",
            isActive: editing?.is_active ?? true,
            sortOrder: editing?.sort_order ?? 0,
            affects: editing?.affects ?? [],
            excerpt: editing?.excerpt ?? "",
            coverImage: editing?.cover_image ?? "",
            contentMD: editing?.content_md ?? "",
            timeRange: {
                start: editing?.start_time ? editing.start_time.slice(0, 16) : "",
                end: editing?.end_time ? editing.end_time.slice(0, 16) : "",
            },
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
            display: data.display,
            is_active: data.isActive,
            sort_order: data.sortOrder,
            affects: data.affects,
            excerpt: data.excerpt || undefined,
            cover_image: data.coverImage || undefined,
            content_md: data.contentMD || undefined,
            start_time: toRFC3339(data.timeRange?.start ?? ""),
            end_time: toRFC3339(data.timeRange?.end ?? ""),
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

    const now = startOfHour(new Date());
    const formatRange = (start: Date, end: Date): DateTimeRange => ({
        start: format(start, "yyyy-MM-dd'T'HH:mm"),
        end: format(end, "yyyy-MM-dd'T'HH:mm"),
    });
    const rangePresets: DateTimeRangePreset[] = [
        { label: "最近1小时", value: formatRange(now, addHours(now, 1)) },
        { label: "今天", value: formatRange(startOfDay(now), endOfDay(now)) },
        { label: "最近7天", value: formatRange(addDays(now, -7), now) },
        { label: "最近30天", value: formatRange(addDays(now, -30), now) },
    ];

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
                    <Label>类型（严重程度）</Label>
                    <Controller
                        control={control}
                        name="type"
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                    className="w-full"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
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

                {/* 展示形态 */}
                <div className="space-y-2">
                    <Label>展示形态</Label>
                    <Controller
                        control={control}
                        name="display"
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                    className="w-full"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DISPLAY_OPTIONS.map((d) => (
                                        <SelectItem key={d} value={d}>
                                            {DISPLAY_LABELS[d]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>

                {/* 排序 */}
                <div className="space-y-2">
                    <Label htmlFor="ann-sort">排序（越小越靠前）</Label>
                    <Input
                        id="ann-sort"
                        type="number"
                        min={0}
                        disabled={pending}
                        {...register("sortOrder", { valueAsNumber: true })}
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

                {/* 影响范围（affects） */}
                <div className="space-y-2">
                    <Label>影响范围</Label>
                    <Controller
                        control={control}
                        name="affects"
                        render={({ field }) => (
                            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-edge-hairline p-3">
                                {AFFECTS_OPTIONS.map((opt) => {
                                    const checked = field.value?.includes(opt) ?? false;
                                    return (
                                        <label
                                            key={opt}
                                            htmlFor={`ann-affects-${opt}`}
                                            className="flex cursor-pointer items-center gap-1.5 text-sm"
                                        >
                                            <Checkbox
                                                id={`ann-affects-${opt}`}
                                                checked={checked}
                                                onCheckedChange={(c) => {
                                                    const next = c
                                                        ? [...(field.value ?? []), opt]
                                                        : (field.value ?? []).filter(
                                                              (v) => v !== opt,
                                                          );
                                                    field.onChange(next);
                                                }}
                                            />
                                            {opt}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    />
                </div>

                {/* 摘要 + 封面 + 富文本（card/article 形态） */}
                {watch("display") !== "banner" && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="ann-excerpt">摘要</Label>
                            <Textarea
                                id="ann-excerpt"
                                rows={2}
                                disabled={pending}
                                {...register("excerpt")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ann-cover">封面图 URL</Label>
                            <Input id="ann-cover" disabled={pending} {...register("coverImage")} />
                        </div>
                    </>
                )}

                {/* 富文本正文（article 形态） */}
                {watch("display") === "article" && (
                    <div className="space-y-2">
                        <Label htmlFor="ann-md">正文（Markdown）</Label>
                        <Textarea
                            id="ann-md"
                            rows={8}
                            disabled={pending}
                            placeholder="支持 Markdown，将渲染为事件简报正文"
                            {...register("contentMD")}
                        />
                    </div>
                )}

                {/* 生效区间 */}
                <Controller
                    control={control}
                    name="timeRange"
                    render={({ field }) => (
                        <DateTimeRangePickerField
                            label="生效区间"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={pending}
                            placeholder="选择生效时间区间"
                            presets={rangePresets}
                            error={errors.timeRange?.end?.message}
                        />
                    )}
                />
            </form>
        </Modal>
    );
}
