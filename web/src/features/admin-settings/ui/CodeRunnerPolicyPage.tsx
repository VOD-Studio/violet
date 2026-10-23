import { updateCodeRunnerPolicy } from "@entities/runtime-policy/api/client";
import { useCodeRunnerPolicy } from "@entities/runtime-policy/api/queries";
import { useRuntimePolicyForm } from "@features/admin-settings/hooks/use-runtime-policy-form";
import { changedPolicyFields } from "@features/admin-settings/lib/runtime-policy-changes";
import { RuntimePolicyPage } from "@features/admin-settings/ui/RuntimePolicyPage";
import {
	PolicyField,
	PolicyNumber,
	PolicySwitch,
} from "@features/admin-settings/ui/runtime-policy-fields";
import { Checkbox } from "@violet/ui";

export function CodeRunnerPolicyPage() {
	const form = useRuntimePolicyForm(
		useCodeRunnerPolicy(),
		updateCodeRunnerPolicy,
		changedPolicyFields,
	);
	const draft = form.draft;
	return (
		<RuntimePolicyPage title="代码运行器" form={form}>
			{draft && (
				<>
					<PolicySwitch
						name="enabled"
						label="启用运行器"
						help="关闭后拒绝两条执行入口的新任务，不取消已有任务。保存成功不代表 Docker 或 Redis 可用。"
						value={draft.enabled}
						onChange={(enabled) => form.change({ ...draft, enabled })}
					/>
					<PolicySwitch
						name="allow_network"
						label="允许联网"
						help="仍须作者声明、语言许可和全局开关同时允许，才会开放网络。"
						value={draft.allow_network}
						onChange={(allow_network) => form.change({ ...draft, allow_network })}
					/>
					<div className="grid gap-6 md:grid-cols-2">
						<PolicyNumber
							name="max_cpu_cores"
							label="CPU 上限（核）"
							help="每个任务最多使用的 CPU 核数，范围 0.1–32。"
							min={0.1}
							max={32}
							step={0.1}
							value={draft.max_cpu_cores}
							onChange={(max_cpu_cores) => form.change({ ...draft, max_cpu_cores })}
						/>
						<PolicyNumber
							name="max_memory_mb"
							label="内存上限（MiB）"
							help="每个沙箱的硬内存上限，范围 16–32768 MiB。"
							min={16}
							max={32768}
							value={draft.max_memory_mb}
							onChange={(max_memory_mb) => form.change({ ...draft, max_memory_mb })}
						/>
						<PolicyNumber
							name="max_timeout_secs"
							label="执行超时（秒）"
							help="运行超过此时长会终止任务，范围 1–300 秒。"
							max={300}
							value={draft.max_timeout_secs}
							onChange={(max_timeout_secs) =>
								form.change({ ...draft, max_timeout_secs })
							}
						/>
						<PolicyNumber
							name="max_output_bytes"
							label="输出上限（字节）"
							help="任务输出大小上限，最多 16 MiB。"
							max={16777216}
							value={draft.max_output_bytes}
							onChange={(max_output_bytes) =>
								form.change({ ...draft, max_output_bytes })
							}
						/>
						<PolicyNumber
							name="max_source_bytes"
							label="源码上限（字节）"
							help="执行提交允许的源码大小，最多 4 MiB。"
							max={4194304}
							value={draft.max_source_bytes}
							onChange={(max_source_bytes) =>
								form.change({ ...draft, max_source_bytes })
							}
						/>
						<PolicyNumber
							name="max_concurrent"
							label="执行并发数（个）"
							help="范围 1–32。降低并发不会终止已有任务，后续名额按新上限分配；管理员同样受请求限流。"
							max={32}
							value={draft.max_concurrent}
							onChange={(max_concurrent) => form.change({ ...draft, max_concurrent })}
						/>
						<PolicyNumber
							name="queue_timeout_secs"
							label="排队超时（秒）"
							help="等待执行名额超过此时长返回排队超时，范围 1–300 秒。"
							max={300}
							value={draft.queue_timeout_secs}
							onChange={(queue_timeout_secs) =>
								form.change({ ...draft, queue_timeout_secs })
							}
						/>
						<PolicyNumber
							name="task_ttl_secs"
							label="任务保留期（秒）"
							help="新任务在 Redis 中的保留时间，范围 1–86400 秒；不回写旧任务。"
							max={86400}
							value={draft.task_ttl_secs}
							onChange={(task_ttl_secs) => form.change({ ...draft, task_ttl_secs })}
						/>
					</div>
					<PolicyField
						name="languages"
						label="允许执行的语言"
						help="未选中任何语言表示禁止所有语言执行。编辑器、阅读器和后端执行入口共同遵守此白名单。"
					>
						{(id, state) => (
							<div
								id={id}
								role="group"
								aria-label="允许执行的语言"
								className="flex flex-wrap gap-4"
							>
								{["python", "node", "go", "rust", "bun"].map((language) => (
									<label
										key={language}
										htmlFor={`${id}-${language}`}
										className="flex items-center gap-2 text-sm"
									>
										<Checkbox
											id={`${id}-${language}`}
											aria-label={language}
											disabled={state.disabled}
											checked={(draft.languages ?? []).includes(language)}
											onCheckedChange={(checked) =>
												form.change({
													...draft,
													languages: checked
														? [...(draft.languages ?? []), language]
														: (draft.languages ?? []).filter(
																(item) => item !== language,
															),
												})
											}
										/>
										{language}
									</label>
								))}
							</div>
						)}
					</PolicyField>
				</>
			)}
		</RuntimePolicyPage>
	);
}
