/**
 * PostEditor - 文章编辑器（新建/编辑共用）
 *
 * 全屏沉浸式布局：
 * - 顶栏：返回按钮 + 标题 + 状态指示 + 保存/发布按钮
 * - 左侧主区：标题输入 + slug 输入 + RichTextEditor（Tiptap）
 * - 右侧侧边栏：封面图选择 + 标签多选 + 摘要 + SEO 字段
 *
 * 新建模式：空表单；编辑模式：useAdminPost(id) 预填。
 * 草稿自动存 localStorage（按 slug），避免丢稿。
 */

import type { MediaFile } from "@features/media/model/types";
import { MediaPicker } from "@features/media/ui/MediaPicker";
import { postKeys } from "@features/posts/api/keys";
import { useCreatePost, useUpdatePost } from "@features/posts/api/mutations";
import { useAdminPost } from "@features/posts/api/queries";
import type { AdminPost, CreatePost } from "@features/posts/model/types";
import { useTags } from "@features/tags/api/queries";
import { clientQueryClient as queryClient } from "@shared/api/query-client";
import { apiPatch } from "@shared/api/request";
import { Button } from "@shared/ui/button";
import { RichTextEditor, type RichTextEditorHandle } from "@shared/ui/editor";
import { Input } from "@shared/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";

export interface PostEditorProps {
    /** 编辑模式时传入文章 ID；新建模式传空 */
    postId?: string;
}

const DRAFT_PREFIX = "post-draft:";

export function PostEditor({ postId }: PostEditorProps) {
    const navigate = useNavigate();
    const isEdit = !!postId;

    const { data: existing, isLoading } = useAdminPost(postId ?? "");
    const createPost = useCreatePost();
    const updatePost = useUpdatePost(postId ?? "");

    const { data: tags = [] } = useTags();

    // 表单字段
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [content, setContent] = useState("");
    const [excerpt, setExcerpt] = useState("");
    const [coverImage, setCoverImage] = useState("");
    const [seoTitle, setSeoTitle] = useState("");
    const [seoDescription, setSeoDescription] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [featured, setFeatured] = useState(false);

    const [coverPickerOpen, setCoverPickerOpen] = useState(false);
    const [imagePickerOpen, setImagePickerOpen] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const editorRef = useRef<RichTextEditorHandle>(null);

    const draftKey = useMemo(() => `${DRAFT_PREFIX}${slug || "untitled"}`, [slug]);

    // 编辑模式：数据到达后预填表单（仅初始化一次，故不依赖 fillFromPost）
    // biome-ignore lint/correctness/useExhaustiveDependencies: 初始化副作用，无需 fillFromPost
    useEffect(() => {
        if (isEdit && existing && !initialized) {
            fillFromPost(existing);
            setInitialized(true);
        }
    }, [isEdit, existing, initialized]);

    // 新建模式：尝试恢复本地草稿（仅初始化一次）
    // biome-ignore lint/correctness/useExhaustiveDependencies: 初始化副作用，无需 fillFromPost
    useEffect(() => {
        if (!isEdit && !initialized) {
            const draft = localStorage.getItem(`${DRAFT_PREFIX}untitled`);
            if (draft) {
                try {
                    fillFromPost(JSON.parse(draft) as Partial<AdminPost>);
                } catch {
                    /* 忽略损坏的草稿 */
                }
            }
            setInitialized(true);
        }
    }, [isEdit, initialized]);

    // 草稿自动保存（debounce 3s，仅未发布时）
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!initialized) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            const draft = {
                title,
                slug,
                content_md: content,
                excerpt,
                cover_image: coverImage,
                seo_title: seoTitle,
                seo_description: seoDescription,
                tags: selectedTags,
            };
            localStorage.setItem(draftKey, JSON.stringify(draft));
        }, 3000);
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, [
        title,
        slug,
        content,
        excerpt,
        coverImage,
        seoTitle,
        seoDescription,
        selectedTags,
        draftKey,
        initialized,
    ]);

    function fillFromPost(p: Partial<AdminPost>) {
        setTitle(p.title ?? "");
        setSlug(p.slug ?? "");
        setContent(p.content_md ?? "");
        setExcerpt(p.excerpt ?? "");
        setCoverImage(p.cover_image ?? "");
        setSeoTitle(p.seo_title ?? "");
        setSeoDescription(p.seo_description ?? "");
        setSelectedTags(p.tags ?? []);
    }

    // 标题变化时自动生成 slug（仅新建且 slug 未手动编辑时）
    const slugTouched = useRef(false);
    const handleTitleChange = (v: string) => {
        setTitle(v);
        if (!isEdit && !slugTouched.current) {
            setSlug(slugify(v));
        }
    };

    const buildPayload = (): CreatePost => ({
        title: title.trim(),
        slug: slug.trim(),
        content_md: content,
        content_html: content, // 后端会重新渲染；此处占位
        excerpt: excerpt.trim() || undefined,
        cover_image: coverImage || undefined,
        seo_title: seoTitle.trim() || undefined,
        seo_description: seoDescription.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
    });

    const handleSave = (publish = false) => {
        if (!title.trim()) {
            toast.error("请填写标题");
            return;
        }
        if (!slug.trim()) {
            toast.error("请填写 slug");
            return;
        }
        const payload = buildPayload();
        const finish = () => {
            toast.success(publish ? "已发布" : isEdit ? "已保存" : "已创建");
            localStorage.removeItem(draftKey);
            navigate({ to: "/admin/posts" });
        };
        const onError = (err: Error) => toast.error(err.message);

        // 保存或创建
        const afterSave = (id: string) => {
            if (publish) {
                // 发布需调状态切换接口（Create 恒为草稿）
                publishPost(id, finish, onError);
            } else {
                finish();
            }
        };

        if (isEdit && postId) {
            updatePost.mutate(payload, {
                onSuccess: () => afterSave(postId),
                onError,
            });
        } else {
            createPost.mutate(payload, {
                onSuccess: (created) => afterSave(created.id),
                onError,
            });
        }
    };

    const handlePickCover = (files: MediaFile[]) => {
        if (files[0]) setCoverImage(files[0].url);
    };

    // 插入素材库图片：通过 ref 调编辑器命令，在光标处插入（非字符串拼接，避免光标重置）
    const handleInsertImages = (files: MediaFile[]) => {
        editorRef.current?.insertImages(
            files.map((f) => ({ src: f.url, alt: f.alt_text || f.original_name })),
        );
    };

    const saving = createPost.isPending || updatePost.isPending;

    if (isEdit && isLoading) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                加载中…
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-4">
            {/* 顶栏 */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate({ to: "/admin/posts" })}
                        title="返回列表"
                    >
                        <X />
                    </Button>
                    <h1 className="text-lg font-semibold">{isEdit ? "编辑文章" : "新建文章"}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                        保存草稿
                    </Button>
                    <Button onClick={() => handleSave(true)} disabled={saving}>
                        发布
                    </Button>
                </div>
            </div>

            {/* 主体：编辑器 + 侧边栏 */}
            <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_320px]">
                {/* 左：编辑器 */}
                <div className="flex min-h-0 flex-col gap-2">
                    <Input
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="文章标题…"
                        className="h-12 border-none bg-transparent px-4 text-2xl font-bold shadow-none focus-visible:ring-0"
                    />
                    <div className="mx-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="shrink-0 select-none font-mono">/blog/</span>
                        <Input
                            value={slug}
                            onChange={(e) => {
                                slugTouched.current = true;
                                setSlug(slugify(e.target.value));
                            }}
                            placeholder="url-slug"
                            className="h-8 flex-1 border-none bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0"
                        />
                    </div>
                    <div className="min-h-0 flex-1">
                        <RichTextEditor
                            ref={editorRef}
                            value={content}
                            onChange={setContent}
                            exportName={slug || "article"}
                            onPickImage={() => setImagePickerOpen(true)}
                            className="h-full"
                            minHeight={400}
                        />
                    </div>
                </div>

                {/* 右：侧边栏 */}
                <aside className="flex flex-col gap-4 overflow-y-auto rounded-lg border border-edge-hairline bg-background p-4">
                    {/* 封面图 */}
                    <section className="space-y-2">
                        <Label>封面图</Label>
                        {coverImage ? (
                            <div className="group relative overflow-hidden rounded-lg border border-edge-hairline">
                                <img
                                    src={coverImage}
                                    alt="封面"
                                    className="aspect-video w-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => setCoverPickerOpen(true)}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                    更换封面
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setCoverPickerOpen(true)}
                                className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-edge-hairline text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                            >
                                选择封面图
                            </button>
                        )}
                    </section>

                    {/* 摘要 */}
                    <section className="space-y-2">
                        <Label htmlFor="excerpt">摘要</Label>
                        <Textarea
                            id="excerpt"
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            placeholder="一句话概括文章内容…"
                            rows={3}
                            className="text-sm"
                        />
                    </section>

                    {/* 标签 */}
                    <section className="space-y-2">
                        <Label>标签</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {selectedTags.map((t) => (
                                <Badge key={t} variant="secondary" className="gap-1">
                                    {t}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedTags((prev) => prev.filter((x) => x !== t))
                                        }
                                        className="hover:text-destructive"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            ))}
                            {selectedTags.length === 0 ? (
                                <span className="text-xs text-muted-foreground">未选择标签</span>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {tags
                                .filter((t) => !selectedTags.includes(t.name))
                                .slice(0, 8)
                                .map((t) => (
                                    <button
                                        type="button"
                                        key={t.id}
                                        onClick={() => setSelectedTags((prev) => [...prev, t.name])}
                                        className="rounded-full border border-edge-hairline px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                                    >
                                        + {t.name}
                                    </button>
                                ))}
                        </div>
                    </section>

                    {/* 精选开关 */}
                    <section className="flex items-center justify-between">
                        <Label htmlFor="featured">精选文章</Label>
                        <Switch id="featured" checked={featured} onCheckedChange={setFeatured} />
                    </section>

                    {/* SEO */}
                    <section className="space-y-3">
                        <p className="text-sm font-medium">SEO 设置</p>
                        <div className="space-y-1.5">
                            <Label htmlFor="seo-title" className="text-xs text-muted-foreground">
                                SEO 标题
                            </Label>
                            <Input
                                id="seo-title"
                                value={seoTitle}
                                onChange={(e) => setSeoTitle(e.target.value)}
                                placeholder="留空则用文章标题"
                                className="text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="seo-desc" className="text-xs text-muted-foreground">
                                SEO 描述
                            </Label>
                            <Textarea
                                id="seo-desc"
                                value={seoDescription}
                                onChange={(e) => setSeoDescription(e.target.value)}
                                placeholder="留空则用摘要"
                                rows={2}
                                className="text-sm"
                            />
                        </div>
                    </section>
                </aside>
            </div>

            {/* 素材选择器 */}
            <MediaPicker
                open={coverPickerOpen}
                onOpenChange={setCoverPickerOpen}
                onConfirm={handlePickCover}
                mediaType="image"
                title="选择封面图"
            />
            <MediaPicker
                open={imagePickerOpen}
                onOpenChange={setImagePickerOpen}
                onConfirm={handleInsertImages}
                mediaType="image"
                multiple
                title="选择图片插入正文"
            />
        </div>
    );
}

/** 中文/英文标题转 URL slug */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s-]/gu, "") // 移除标点（保留字母数字与中文）
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * publishPost - 调状态切换接口发布文章
 *
 * Create 接口恒为草稿，发布走 PATCH /admin/posts/{id}/status。
 * 用裸 apiPatch（无法在 onSuccess 回调里调 hook），手动失效缓存。
 */
async function publishPost(id: string, onSuccess: () => void, onError: (err: Error) => void) {
    try {
        await apiPatch<AdminPost>(`/admin/posts/${id}/status`, { status: "published" });
        queryClient.invalidateQueries({ queryKey: postKeys.adminDetail(id) });
        queryClient.invalidateQueries({ queryKey: postKeys.adminLists() });
        onSuccess();
    } catch (err) {
        onError(err instanceof Error ? err : new Error("发布失败"));
    }
}
