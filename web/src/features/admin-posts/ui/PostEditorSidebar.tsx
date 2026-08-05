/**
 * PostEditorSidebar - 文章编辑器侧边栏
 *
 * 封面图 + 摘要 + 标签 + 精选 + SEO，接收主表单的 react-hook-form 句柄。
 * 标签列表与封面选择器封装在内部。
 */

import { Cover } from "@features/admin-media/ui/Cover";
import type { PostForm } from "@features/admin-posts/model/schema";
import { useTags } from "@features/tags/api/queries";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { X } from "lucide-react";
import { type Control, Controller, type UseFormRegister } from "react-hook-form";
import { Badge } from "@/shared/ui/base/badge";
import { Switch } from "@/shared/ui/base/switch";
import { Textarea } from "@/shared/ui/base/textarea";

interface PostEditorSidebarProps {
	control: Control<PostForm>;
	register: UseFormRegister<PostForm>;
}

export function PostEditorSidebar({ control, register }: PostEditorSidebarProps) {
	const { data: tags = [] } = useTags();

	return (
		<aside className="flex flex-col gap-4 overflow-y-auto rounded-lg border border-edge-hairline bg-background p-4">
			{/* 封面图 */}
			<Controller
				control={control}
				name="cover_image"
				render={({ field }) => (
					<section className="space-y-2">
						<Label>封面图</Label>
						<Cover
							value={field.value}
							onChange={field.onChange}
							onClear={() => field.onChange("")}
							title="选择封面图"
						/>
					</section>
				)}
			/>

			{/* 摘要 */}
			<section className="space-y-2">
				<Label htmlFor="excerpt">摘要</Label>
				<Textarea
					id="excerpt"
					{...register("excerpt")}
					placeholder="一句话概括文章内容…"
					rows={3}
					className="text-sm"
				/>
			</section>

			{/* 标签 */}
			<Controller
				control={control}
				name="tags"
				render={({ field }) => (
					<section className="space-y-2">
						<Label>标签</Label>
						<div className="flex flex-wrap gap-1.5">
							{field.value.map((t) => (
								<Badge key={t} variant="secondary" className="gap-1">
									{t}
									<button
										type="button"
										onClick={() =>
											field.onChange(field.value.filter((x) => x !== t))
										}
										className="hover:text-destructive"
									>
										<X className="size-3" />
									</button>
								</Badge>
							))}
							{field.value.length === 0 ? (
								<span className="text-xs text-muted-foreground">未选择标签</span>
							) : null}
						</div>
						<div className="flex flex-wrap gap-1">
							{tags
								.filter((t) => !field.value.includes(t.name))
								.slice(0, 8)
								.map((t) => (
									<button
										type="button"
										key={t.id}
										onClick={() => field.onChange([...field.value, t.name])}
										className="rounded-full border border-edge-hairline px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
									>
										+ {t.name}
									</button>
								))}
						</div>
					</section>
				)}
			/>

			<Controller
				control={control}
				name="is_featured"
				render={({ field }) => (
					<section className="flex items-center justify-between">
						<Label htmlFor="is_featured">精选文章</Label>
						<Switch
							id="is_featured"
							checked={field.value}
							onCheckedChange={field.onChange}
						/>
					</section>
				)}
			/>

			{/* SEO */}
			<section className="space-y-3">
				<p className="text-sm font-medium">SEO 设置</p>
				<div className="space-y-1.5">
					<Label htmlFor="seo-title" className="text-xs text-muted-foreground">
						SEO 标题
					</Label>
					<Input
						id="seo-title"
						{...register("seo_title")}
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
						{...register("seo_description")}
						placeholder="留空则用摘要"
						rows={2}
						className="text-sm"
					/>
				</div>
			</section>
		</aside>
	);
}
