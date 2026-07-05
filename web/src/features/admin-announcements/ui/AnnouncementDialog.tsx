import { zodResolver } from "@hookform/resolvers/zod";
import { Cover } from "@features/admin-media/ui/Cover";
import { MediaPicker } from "@features/admin-media/ui/MediaPicker";
import { RichTextEditor, type RichTextEditorHandle } from "@features/editor";
import type { MediaFile } from "@entities/media/model/types";
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@shared/ui/base/sheet";
import { addDays, addHours, endOfDay, format, startOfDay, startOfHour } from "date-fns";
import { Loader2, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
    card: "卡片（通知）",
    article: "文章（简报）",
};

export function AnnouncementDialog({ open, onOpenChange, editing }: AnnouncementDialogProps) {
    const isEdit = !!editing;
    const createAnn = useCreateAnnouncement();
    const updateAnn = useUpdateAnnouncement();
    const editorRef = useRef<RichTextEditorHandle>(null);
    const [imagePickerOpen, setImagePickerOpen] = useState(false);

    /** 从素材库选图后，通过 ref 在光标处插入，避免字符串拼接导致光标重置 */
    const handleInsertImages = (files: MediaFile[]) => {
        editorRef.current?.insertImages(
            files.map((f) => ({ src: f.url, alt: f.alt_text || f.original_name })),
        );
    };

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
            contentHTML: "",
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
            contentHTML: editing?.content_html ?? "",
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
            // article 形态正文用 content_html，content 留空
            content: data.display === "article" ? "" : (data.content ?? ""),
            type: data.type,
            display: data.display,
            is_active: data.isActive,
            sort_order: data.sortOrder,
            affects: data.affects,
            excerpt: data.excerpt || undefined,
            cover_image: data.coverImage || undefined,
            content_md: data.contentMD || undefined,
            content_html: data.contentHTML || undefined,
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
    const display = watch("display");
    const isArticle = display === "article";
    const isBanner = display === "banner";

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
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full gap-0 overflow-hidden sm:max-w-2xl lg:max-w-3xl"
            >
                <SheetHeader className="border-b border-edge-hairline pr-12">
                    <SheetTitle>{isEdit ? "编辑公告" : "创建公告"}</SheetTitle>
                    <SheetDescription>
                        {isEdit ? "修改公告内容与生效设置" : "新建一条站点公告"}
                    </SheetDescription>
                </SheetHeader>

                <form
                    id="announcement-form"
                    onSubmit={handleSubmit(onSubmit)}
                    // 三段式：header/footer 固定，此区为中间可滚动区
                    // 移动端单列整体滚；桌面端两栏各自独立滚，互不干扰
                    className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 lg:grid lg:grid-cols-[1fr_18rem] lg:items-start lg:gap-6 lg:overflow-hidden"
                >
                {/* ============ 左主区：内容编辑 ============ */}
                <div className="min-h-0 space-y-4 lg:overflow-y-auto lg:pr-1">
                    {/* 标题 */}
                    <div className="space-y-2">
                        <Label htmlFor="ann-title">
                            标题 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="ann-title"
                            placeholder="一句话说清这条公告"
                            disabled={pending}
                            {...register("title")}
                        />
                        {errors.title && (
                            <p className="text-sm text-destructive">{errors.title.message}</p>
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

                    {/* 内容（banner / card 形态）：纯文本通知主体 */}
                    {!isArticle && (
                        <div className="space-y-2">
                            <Label htmlFor="ann-content">
                                内容 <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="ann-content"
                                rows={5}
                                disabled={pending}
                                placeholder="纯文本内容，banner 显示在顶部条，card 显示在卡片"
                                {...register("content")}
                            />
                            {errors.content && (
                                <p className="text-sm text-destructive">
                                    {errors.content.message}
                                </p>
                            )}
                        </div>
                    )}

                    {/* 正文（article 形态）：富文本编辑器 */}
                    {isArticle && (
                        <div className="space-y-2">
                            <Label>正文</Label>
                            <Controller
                                control={control}
                                name="contentHTML"
                                render={({ field }) => (
                                    <RichTextEditor
                                        ref={editorRef}
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        exportName={`announcement-${editing?.id ?? "new"}`}
                                        onPickImage={() => setImagePickerOpen(true)}
                                        minHeight={320}
                                    />
                                )}
                            />
                        </div>
                    )}
                </div>

                {/* ============ 右侧栏：配置面板 ============ */}
                <aside className="min-h-0 space-y-4 overflow-y-auto rounded-lg border border-edge-hairline bg-muted/30 p-4 lg:self-stretch">
                    {/* 展示形态（创建后不可改） */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                            展示形态
                            {isEdit && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-normal text-muted-foreground">
                                    <Lock className="size-2.5" />
                                    创建后不可改
                                </span>
                            )}
                        </Label>
                        <Controller
                            control={control}
                            name="display"
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={isEdit}
                                >
                                    <SelectTrigger
                                        className="w-full disabled:opacity-60"
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

                    {/* 排序 + 启用（一行两字段，紧凑） */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="ann-sort">排序</Label>
                            <Input
                                id="ann-sort"
                                type="number"
                                min={0}
                                disabled={pending}
                                {...register("sortOrder", { valueAsNumber: true })}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="ann-active">启用</Label>
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
                        </div>
                    </div>

                    {/* 封面图（card / article） */}
                    {!isBanner && (
                        <div className="space-y-2">
                            <Label>封面图</Label>
                            <Controller
                                control={control}
                                name="coverImage"
                                render={({ field }) => (
                                    <Cover
                                        value={field.value}
                                        onChange={field.onChange}
                                        onClear={() => field.onChange("")}
                                        title="选择公告封面图"
                                    />
                                )}
                            />
                        </div>
                    )}

                    {/* 摘要（article 形态，card 不需要） */}
                    {isArticle && (
                        <div className="space-y-2">
                            <Label htmlFor="ann-excerpt">摘要</Label>
                            <Textarea
                                id="ann-excerpt"
                                rows={2}
                                disabled={pending}
                                placeholder="卡片上展示的简短描述"
                                {...register("excerpt")}
                            />
                        </div>
                    )}

                    {/* 影响范围 */}
                    <div className="space-y-2">
                        <Label>影响范围</Label>
                        <Controller
                            control={control}
                            name="affects"
                            render={({ field }) => (
                                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                                    {AFFECTS_OPTIONS.map((opt) => {
                                        const checked = field.value?.includes(opt) ?? false;
                                        return (
                                            <label
                                                key={opt}
                                                htmlFor={`ann-affects-${opt}`}
                                                className="flex cursor-pointer items-center gap-1 text-xs"
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
                </aside>
            </form>

            <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-edge-hairline">
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
            </SheetFooter>

            {/* 正文插入图片的素材库选择器（Portal 渲染，与 Sheet 平级显示） */}
            <MediaPicker
                open={imagePickerOpen}
                onOpenChange={setImagePickerOpen}
                mediaType="image"
                multiple
                title="选择图片插入正文"
                onConfirm={handleInsertImages}
            />
            </SheetContent>
        </Sheet>
    );
}
