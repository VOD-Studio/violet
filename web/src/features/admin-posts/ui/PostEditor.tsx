/**
 * PostEditor - 文章编辑器，新建与编辑共用
 *
 * 全屏沉浸式布局：顶栏 + 主区（标题/slug/RichTextEditor）+ 侧边栏。
 * 表单用 zod 校验 + react-hook-form；草稿自动存 localStorage。
 * 顶栏见 PostEditorToolbar，侧边栏见 PostEditorSidebar。
 */

import type { MediaFile } from "@entities/media/model/types";
import { publishPost, useCreatePost, useUpdatePost } from "@features/admin-posts/api/mutations";
import { useAdminPost } from "@features/admin-posts/api/queries";
import { type PostForm, postSchema } from "@features/admin-posts/model/schema";
import type { CreatePost } from "@features/admin-posts/model/types";
import { PostEditorSidebar } from "@features/admin-posts/ui/PostEditorSidebar";
import { PostEditorToolbar } from "@features/admin-posts/ui/PostEditorToolbar";
import { MediaPicker } from "@features/media/ui/MediaPicker";
import { zodResolver } from "@hookform/resolvers/zod";
import { slugify } from "@shared/lib/slug";
import { RichTextEditor, type RichTextEditorHandle } from "@shared/ui/editor";
import { Input } from "@shared/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

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

    const editorRef = useRef<RichTextEditorHandle>(null);
    const initialized = useRef(false);
    const slugTouched = useRef(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [imagePickerOpen, setImagePickerOpen] = useState(false);

    const form = useForm<PostForm>({
        resolver: zodResolver(postSchema),
        defaultValues: {
            title: "",
            slug: "",
            content_md: "",
            excerpt: "",
            cover_image: "",
            seo_title: "",
            seo_description: "",
            tags: [],
            featured: false,
        },
    });
    const {
        register,
        handleSubmit,
        reset,
        control,
        setValue,
        formState: { errors },
    } = form;

    const slugValue = useWatch({ control, name: "slug" });
    const draftKey = `${DRAFT_PREFIX}${slugValue || "untitled"}`;

    // 编辑模式：数据到达后预填，仅初始化一次
    useEffect(() => {
        if (isEdit && existing && !initialized.current) {
            reset({
                title: existing.title,
                slug: existing.slug,
                content_md: existing.content_md,
                excerpt: existing.excerpt,
                cover_image: existing.cover_image,
                seo_title: existing.seo_title,
                seo_description: existing.seo_description,
                tags: existing.tags,
                featured: existing.is_featured,
            });
            initialized.current = true;
        }
    }, [isEdit, existing, reset]);

    // 新建模式：尝试恢复本地草稿，仅初始化一次
    useEffect(() => {
        if (!isEdit && !initialized.current) {
            const draft = localStorage.getItem(`${DRAFT_PREFIX}untitled`);
            if (draft) {
                try {
                    const d = JSON.parse(draft) as Partial<PostForm>;
                    reset({
                        title: d.title ?? "",
                        slug: d.slug ?? "",
                        content_md: d.content_md ?? "",
                        excerpt: d.excerpt ?? "",
                        cover_image: d.cover_image ?? "",
                        seo_title: d.seo_title ?? "",
                        seo_description: d.seo_description ?? "",
                        tags: d.tags ?? [],
                        featured: false,
                    });
                } catch {
                    /* 忽略损坏的草稿 */
                }
            }
            initialized.current = true;
        }
    }, [isEdit, reset]);

    // 草稿自动保存，debounce 3s
    const values = useWatch({ control });
    useEffect(() => {
        if (!initialized.current) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            localStorage.setItem(
                draftKey,
                JSON.stringify({
                    title: values.title,
                    slug: values.slug,
                    content_md: values.content_md,
                    excerpt: values.excerpt,
                    cover_image: values.cover_image,
                    seo_title: values.seo_title,
                    seo_description: values.seo_description,
                    tags: values.tags,
                }),
            );
        }, 3000);
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, [values, draftKey]);

    const buildPayload = (data: PostForm): CreatePost => ({
        title: data.title.trim(),
        slug: data.slug.trim(),
        content_md: data.content_md,
        content_html: data.content_md,
        excerpt: data.excerpt.trim() || undefined,
        cover_image: data.cover_image || undefined,
        seo_title: data.seo_title.trim() || undefined,
        seo_description: data.seo_description.trim() || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
    });

    const handleSave = (data: PostForm, publish: boolean) => {
        const payload = buildPayload(data);
        const finish = () => {
            toast.success(publish ? "已发布" : isEdit ? "已保存" : "已创建");
            localStorage.removeItem(draftKey);
            navigate({ to: "/admin/posts" });
        };
        const onError = (err: Error) => toast.error(err.message);

        // 发布需先创建再调状态切换接口，Create 恒为草稿
        const afterSave = async (id: string) => {
            if (!publish) {
                finish();
                return;
            }
            try {
                await publishPost(id);
                finish();
            } catch (err) {
                onError(err instanceof Error ? err : new Error("发布失败"));
            }
        };

        if (isEdit && postId) {
            updatePost.mutate(payload, {
                onSuccess: () => void afterSave(postId),
                onError,
            });
        } else {
            createPost.mutate(payload, {
                onSuccess: (created) => void afterSave(created.id),
                onError,
            });
        }
    };

    const onSaveDraft = handleSubmit((data) => handleSave(data, false));
    const onPublish = handleSubmit((data) => handleSave(data, true));

    // 插入素材库图片：通过 ref 调编辑器命令，在光标处插入，非字符串拼接避免光标重置
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
            <PostEditorToolbar
                isEdit={isEdit}
                saving={saving}
                onBack={() => navigate({ to: "/admin/posts" })}
                onSaveDraft={onSaveDraft}
                onPublish={onPublish}
            />

            {/* 主体：编辑器 + 侧边栏 */}
            <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_320px]">
                {/* 左：编辑器 */}
                <div className="flex min-h-0 flex-col gap-2">
                    <Input
                        {...register("title", {
                            onChange: (e) => {
                                if (!isEdit && !slugTouched.current) {
                                    setValue("slug", slugify(e.target.value));
                                }
                            },
                        })}
                        placeholder="文章标题…"
                        className="h-12 border-none bg-transparent px-4 text-2xl font-bold shadow-none focus-visible:ring-0"
                    />
                    {errors.title ? (
                        <p className="px-4 text-sm text-destructive">{errors.title.message}</p>
                    ) : null}
                    <div className="mx-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="shrink-0 select-none font-mono">/blog/</span>
                        <Controller
                            control={control}
                            name="slug"
                            render={({ field }) => (
                                <Input
                                    value={field.value}
                                    onChange={(e) => {
                                        slugTouched.current = true;
                                        field.onChange(slugify(e.target.value));
                                    }}
                                    placeholder="url-slug"
                                    className="h-8 flex-1 border-none bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0"
                                />
                            )}
                        />
                    </div>
                    {errors.slug ? (
                        <p className="px-4 text-sm text-destructive">{errors.slug.message}</p>
                    ) : null}
                    <div className="min-h-0 flex-1">
                        <Controller
                            control={control}
                            name="content_md"
                            render={({ field }) => (
                                <RichTextEditor
                                    ref={editorRef}
                                    value={field.value}
                                    onChange={field.onChange}
                                    exportName={slugValue || "article"}
                                    onPickImage={() => setImagePickerOpen(true)}
                                    className="h-full"
                                    minHeight={400}
                                />
                            )}
                        />
                    </div>
                </div>

                {/* 右：侧边栏 */}
                <PostEditorSidebar control={control} register={register} setValue={setValue} />
            </div>

            {/* 插入正文图片选择器 */}
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
