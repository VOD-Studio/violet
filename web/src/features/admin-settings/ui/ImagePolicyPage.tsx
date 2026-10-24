import { updateImagePolicy } from "@entities/runtime-policy/api/client";
import { useImagePolicy } from "@entities/runtime-policy/api/queries";
import { useRuntimePolicyForm } from "@features/admin-settings/hooks/use-runtime-policy-form";
import { changedPolicyFields } from "@features/admin-settings/lib/runtime-policy-changes";
import { RuntimePolicyPage } from "@features/admin-settings/ui/RuntimePolicyPage";
import { PolicyField, PolicyNumber } from "@features/admin-settings/ui/runtime-policy-fields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@violet/ui";

export function ImagePolicyPage() {
	const form = useRuntimePolicyForm(useImagePolicy(), updateImagePolicy, changedPolicyFields);
	const draft = form.draft;
	const cleanup = form.query.data?.cleanup ?? form.baseline?.cleanup;
	return (
		<RuntimePolicyPage
			title="图片与缓存"
			form={form}
			status={
				<section
					aria-label="缓存清理状态"
					className="space-y-2 rounded-xl border border-border p-4 text-sm"
				>
					<h2 className="font-semibold">缓存清理</h2>
					{cleanup ? (
						<>
							<p>
								状态：
								{cleanup.running
									? "清理中"
									: cleanup.error
										? "失败"
										: cleanup.last_finished_at
											? "已完成"
											: "尚未执行"}
							</p>
							<div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
								<span>开始：{cleanup.last_started_at ?? "—"}</span>
								<span>结束：{cleanup.last_finished_at ?? "—"}</span>
								<span>移除条目：{cleanup.removed_entries}</span>
								<span>释放字节：{cleanup.removed_bytes}</span>
								<span>剩余字节：{cleanup.remaining_bytes}</span>
							</div>
							{cleanup.error && (
								<p role="alert" className="text-destructive-text">
									{cleanup.error}
								</p>
							)}
						</>
					) : (
						<p>维护状态不可用</p>
					)}
				</section>
			}
		>
			{draft && (
				<>
					<section className="space-y-4">
						<h2 className="text-sm font-semibold">缓存</h2>
						<div className="grid gap-6 md:grid-cols-2">
							<PolicyNumber
								name="memory_max_entries"
								label="内存缓存条目（个）"
								help="达到上限时淘汰可重建的内存缓存，不删除正式素材。"
								value={draft.memory_max_entries}
								onChange={(memory_max_entries) =>
									form.change({ ...draft, memory_max_entries })
								}
							/>
							<PolicyNumber
								name="memory_max_bytes"
								label="内存缓存容量（字节）"
								help="限制缓存内容的总字节数。"
								value={draft.memory_max_bytes}
								onChange={(memory_max_bytes) =>
									form.change({ ...draft, memory_max_bytes })
								}
							/>
							<PolicyNumber
								name="memory_ttl_seconds"
								label="内存缓存保留期（秒）"
								help="缓存超过保留期后失效，下次访问重新生成。"
								value={draft.memory_ttl_seconds}
								onChange={(memory_ttl_seconds) =>
									form.change({ ...draft, memory_ttl_seconds })
								}
							/>
							<PolicyNumber
								name="disk_max_bytes"
								label="磁盘缓存容量（字节）"
								help="清理先删除过期缓存，再按确定顺序收敛容量；仅作用于可重建缓存。"
								value={draft.disk_max_bytes}
								onChange={(disk_max_bytes) =>
									form.change({ ...draft, disk_max_bytes })
								}
							/>
							<PolicyNumber
								name="disk_ttl_seconds"
								label="磁盘缓存保留期（秒）"
								help="超过保留期的缓存由专用维护任务清理。"
								value={draft.disk_ttl_seconds}
								onChange={(disk_ttl_seconds) =>
									form.change({ ...draft, disk_ttl_seconds })
								}
							/>
							<PolicyNumber
								name="cleanup_interval_seconds"
								label="清理间隔（秒）"
								help="专用缓存维护周期，不调用正式素材清理。"
								value={draft.cleanup_interval_seconds}
								onChange={(cleanup_interval_seconds) =>
									form.change({ ...draft, cleanup_interval_seconds })
								}
							/>
						</div>
					</section>
					<section className="space-y-4">
						<h2 className="text-sm font-semibold">源图与资源保护</h2>
						<div className="grid gap-6 md:grid-cols-2">
							<PolicyNumber
								name="max_source_dimension"
								label="源图单边上限（像素）"
								help="完整解码前校验源图宽高，不能用输出尺寸替代源图限制。"
								value={draft.max_source_dimension}
								onChange={(max_source_dimension) =>
									form.change({ ...draft, max_source_dimension })
								}
							/>
							<PolicyNumber
								name="max_source_pixels"
								label="源图总像素上限（像素）"
								help="完整解码前校验宽乘高，超限拒绝处理。"
								value={draft.max_source_pixels}
								onChange={(max_source_pixels) =>
									form.change({ ...draft, max_source_pixels })
								}
							/>
							<PolicyNumber
								name="max_concurrent"
								label="编码并发数（个）"
								help="每个实例允许同时处理的编码任务上限。"
								value={draft.max_concurrent}
								onChange={(max_concurrent) =>
									form.change({ ...draft, max_concurrent })
								}
							/>
							<PolicyNumber
								name="encode_timeout_seconds"
								label="编码超时（秒）"
								help="超时终止编码，不将失败输出作为有效图片。"
								value={draft.encode_timeout_seconds}
								onChange={(encode_timeout_seconds) =>
									form.change({ ...draft, encode_timeout_seconds })
								}
							/>
							<PolicyNumber
								name="max_input_bytes"
								label="编码输入上限（字节）"
								help="进入图片处理管线的最大输入大小。"
								value={draft.max_input_bytes}
								onChange={(max_input_bytes) =>
									form.change({ ...draft, max_input_bytes })
								}
							/>
							<PolicyNumber
								name="max_output_bytes"
								label="编码输出上限（字节）"
								help="编码输出超过此值时明确失败。"
								value={draft.max_output_bytes}
								onChange={(max_output_bytes) =>
									form.change({ ...draft, max_output_bytes })
								}
							/>
						</div>
					</section>
					<section className="space-y-4">
						<h2 className="text-sm font-semibold">编码</h2>
						<div className="grid gap-6 md:grid-cols-2">
							<PolicyNumber
								name="thumbnail_width"
								label="缩略图宽度（像素）"
								help="后续生成的 JPEG 缩略图目标宽度。"
								value={draft.thumbnail_width}
								onChange={(thumbnail_width) =>
									form.change({ ...draft, thumbnail_width })
								}
							/>
							<PolicyNumber
								name="thumbnail_quality"
								label="缩略图质量"
								help="JPEG 质量范围 1–100，数值越高通常文件越大。"
								max={100}
								value={draft.thumbnail_quality}
								onChange={(thumbnail_quality) =>
									form.change({ ...draft, thumbnail_quality })
								}
							/>
							<PolicyField
								name="webp_mode"
								label="WebP 模式"
								help="无损模式保留像素；有损模式实际使用质量参数。动画和透明通道继续遵循素材保留规则。"
							>
								{(id, state) => (
									<Select
										value={draft.webp_mode}
										disabled={state.disabled}
										onValueChange={(value) => {
											if (value === "lossless" || value === "lossy")
												form.change({ ...draft, webp_mode: value });
										}}
									>
										<SelectTrigger id={id}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="lossless">无损</SelectItem>
											<SelectItem value="lossy">有损</SelectItem>
										</SelectContent>
									</Select>
								)}
							</PolicyField>
							<PolicyNumber
								name="webp_quality"
								label="WebP 质量"
								help="有损模式的质量参数；无损模式用作编码努力程度参数。范围 1–100。"
								max={100}
								value={draft.webp_quality}
								onChange={(webp_quality) => form.change({ ...draft, webp_quality })}
							/>
							<PolicyNumber
								name="webp_method"
								label="WebP 编码强度"
								help="范围 0–6；强度越高通常耗时越长，不保证所有图片更小。"
								min={0}
								max={6}
								value={draft.webp_method}
								onChange={(webp_method) => form.change({ ...draft, webp_method })}
							/>
						</div>
					</section>
				</>
			)}
		</RuntimePolicyPage>
	);
}
