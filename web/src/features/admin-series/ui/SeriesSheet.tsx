import { Cover } from "@features/admin-media/ui/Cover";
import { slugifyPost } from "@features/admin-posts/api/mutations";
import { useCreateSeries, useUpdateSeries } from "@features/admin-series/api/mutations";
import { type SeriesForm, seriesSchema } from "@features/admin-series/model/schema";
import type { AdminSeriesListItem } from "@features/admin-series/model/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDebouncedCallback } from "@shared/hooks/use-debounced-callback";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@shared/ui/base/sheet";
import { Textarea } from "@shared/ui/base/textarea";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

const BASE_DEFAULTS: SeriesForm = {
	title: "",
	slug: "",
	description: "",
	cover_image: "",
};

interface SeriesSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 编辑对象；null=建书 */
	editing: AdminSeriesListItem | null;
	/** 建书成功回调（携带新书 id，列表页跳编辑页） */
	onCreated?: (id: string) => void;
}

/** 建/编辑书弹窗（元信息：标题/slug/简介/封面）。目录管理在编辑页。 */
export function SeriesSheet({ open, onOpenChange, editing, onCreated }: SeriesSheetProps) {
	const create = useCreateSeries();
	const update = useUpdateSeries(editing?.id ?? "");
	// 建书态：标题输入后 debounce 调后端 slugify 预填 slug（中文走无声调全拼，
	// 复用文章的 /admin/posts/slugify 端点，契约一致）。用户手改 slug 后不再跟随。
	const slugTouched = useRef(false);
	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<SeriesForm>({
		resolver: zodResolver(seriesSchema),
		defaultValues: BASE_DEFAULTS,
	});

	const debouncedSlugify = useDebouncedCallback(
		(title: string) => {
			if (!title.trim()) return;
			void slugifyPost(title)
				.then((res) => {
					if (!slugTouched.current) {
						setValue("slug", res.slug, { shouldDirty: true });
					}
				})
				.catch(() => {
					// slugify 失败不打断输入，用户可手动填
				});
		},
		{ delay: 400 },
	);

	useEffect(() => {
		if (!open) return;
		// 编辑态回填；slug 不可改，禁用输入。建书态重置手改标记。
		slugTouched.current = false;
		reset(
			editing
				? {
						title: editing.title,
						slug: editing.slug,
						description: editing.description,
						cover_image: editing.cover_image,
					}
				: BASE_DEFAULTS,
		);
	}, [open, editing, reset]);

	const onSubmit = async (values: SeriesForm) => {
		if (editing) {
			await update.mutateAsync({
				title: values.title,
				description: values.description,
				cover_image: values.cover_image,
			});
		} else {
			const created = await create.mutateAsync(values);
			onCreated?.(created.id);
		}
		onOpenChange(false);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>{editing ? "编辑书" : "建书"}</SheetTitle>
					<SheetDescription>
						{editing
							? "修改书的基础信息；slug 创建后不可更改"
							: "先建书慢慢挂章节，发布前不出现在公开书架"}
					</SheetDescription>
				</SheetHeader>
				<form
					id="series-form"
					onSubmit={handleSubmit(onSubmit)}
					className="flex flex-1 flex-col gap-4 px-4"
				>
					<div className="space-y-2">
						<Label htmlFor="series-title">书名</Label>
						<Input
							id="series-title"
							{...register("title")}
							disabled={isSubmitting}
							onChange={(e) => {
								register("title").onChange(e);
								if (!editing) {
									debouncedSlugify.run(e.target.value);
								}
							}}
						/>
						{errors.title && (
							<p className="text-destructive text-sm">{errors.title.message}</p>
						)}
					</div>
					<div className="space-y-2">
						<Label htmlFor="series-slug">slug</Label>
						<Input
							id="series-slug"
							placeholder="输入书名自动生成，可手动修改"
							{...register("slug")}
							disabled={isSubmitting || !!editing}
							onChange={(e) => {
								slugTouched.current = true;
								register("slug").onChange(e);
							}}
						/>
						{errors.slug && (
							<p className="text-destructive text-sm">{errors.slug.message}</p>
						)}
					</div>
					<div className="space-y-2">
						<Label htmlFor="series-desc">简介</Label>
						<Textarea
							id="series-desc"
							rows={3}
							{...register("description")}
							disabled={isSubmitting}
						/>
						{errors.description && (
							<p className="text-destructive text-sm">{errors.description.message}</p>
						)}
					</div>
					<div className="space-y-2">
						<Label>封面图</Label>
						<Cover
							value={watch("cover_image") || undefined}
							onChange={(url) => {
								reset({ ...watch(), cover_image: url });
							}}
							onClear={() => reset({ ...watch(), cover_image: "" })}
							title="选择书籍封面"
						/>
					</div>
				</form>
				<SheetFooter>
					<Button type="submit" form="series-form" disabled={isSubmitting}>
						{isSubmitting ? "保存中…" : "保存"}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
