import { updateRateLimitPolicy } from "@entities/runtime-policy/api/client";
import { useRateLimitPolicy } from "@entities/runtime-policy/api/queries";
import type { RateLimitPolicy } from "@entities/runtime-policy/model/types";
import { useRuntimePolicyForm } from "@features/admin-settings/hooks/use-runtime-policy-form";
import { changedRateLimitFields } from "@features/admin-settings/lib/runtime-policy-changes";
import { RuntimePolicyPage } from "@features/admin-settings/ui/RuntimePolicyPage";
import {
	PolicyField,
	PolicyHelp,
	PolicyNumber,
	PolicySwitch,
} from "@features/admin-settings/ui/runtime-policy-fields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@violet/ui";

function rateFields(values: RateLimitPolicy) {
	const fields: Record<string, unknown> = {};
	for (const [id, rule] of Object.entries(values.rules)) {
		for (const [key, value] of Object.entries(rule)) fields[`rules.${id}.${key}`] = value;
	}
	return fields;
}

export function RateLimitPolicyPage() {
	const form = useRuntimePolicyForm(
		useRateLimitPolicy(),
		updateRateLimitPolicy,
		changedRateLimitFields,
	);
	const draft = form.draft;
	return (
		<RuntimePolicyPage title="请求限流" form={form} fields={rateFields}>
			{draft &&
				(form.baseline?.entries ?? []).map((entry) => {
					const rule = draft.rules[entry.id];
					if (!rule) return null;
					const prefix = `rules.${entry.id}`;
					return (
						<section
							key={entry.id}
							className="space-y-4 rounded-xl border border-border p-4"
						>
							<div className="flex items-center gap-2">
								<h2 className="text-sm font-semibold">{entry.title}</h2>
								<PolicyHelp label={entry.title}>
									{entry.description}
									<span className="block">计数身份：{entry.identity}</span>
									{(entry.endpoints ?? []).map((endpoint) => (
										<span key={endpoint} className="block">
											{endpoint}
										</span>
									))}
								</PolicyHelp>
							</div>
							<PolicySwitch
								name={`${prefix}.enabled`}
								label="启用限流"
								help="关闭表示此入口不执行配额检查；数字零值只关闭对应附加额度，不会关闭整个策略。"
								value={rule.enabled}
								onChange={(enabled) =>
									form.change({
										...draft,
										rules: { ...draft.rules, [entry.id]: { ...rule, enabled } },
									})
								}
							/>
							<div className="grid gap-6 md:grid-cols-2">
								<PolicyNumber
									name={`${prefix}.window_seconds`}
									label="窗口时长（秒）"
									help="主窗口必须为正数。更新额度保留计数身份，不会通过改配置清空已使用额度。"
									value={rule.window_seconds}
									onChange={(window_seconds) =>
										form.change({
											...draft,
											rules: {
												...draft.rules,
												[entry.id]: { ...rule, window_seconds },
											},
										})
									}
								/>
								<PolicyNumber
									name={`${prefix}.max_requests`}
									label="窗口请求额度（次）"
									help="主窗口请求额度必须大于零，管理员同样受限。"
									value={rule.max_requests}
									onChange={(max_requests) =>
										form.change({
											...draft,
											rules: {
												...draft.rules,
												[entry.id]: { ...rule, max_requests },
											},
										})
									}
								/>
								<PolicyNumber
									name={`${prefix}.burst_requests`}
									label="每秒突发额度（次）"
									help="附加的一秒请求上限。0 只关闭突发限制，主窗口限制仍有效。"
									min={0}
									value={rule.burst_requests}
									onChange={(burst_requests) =>
										form.change({
											...draft,
											rules: {
												...draft.rules,
												[entry.id]: { ...rule, burst_requests },
											},
										})
									}
								/>
								<PolicyNumber
									name={`${prefix}.daily_quota`}
									label="UTC 日配额（次）"
									help="按 UTC 自然日归零。0 只关闭日配额；选择预设不会默认启用日配额。"
									min={0}
									value={rule.daily_quota}
									onChange={(daily_quota) =>
										form.change({
											...draft,
											rules: {
												...draft.rules,
												[entry.id]: { ...rule, daily_quota },
											},
										})
									}
								/>
								<PolicyField
									name={`${prefix}.failure_mode`}
									label="Redis 故障策略"
									help="拒绝模式在计数依赖故障时拒绝新请求；放行模式会暂时失去该入口限流保护。"
								>
									{(id, state) => (
										<Select
											value={rule.failure_mode}
											disabled={state.disabled}
											onValueChange={(value) => {
												if (value === "allow" || value === "deny")
													form.change({
														...draft,
														rules: {
															...draft.rules,
															[entry.id]: {
																...rule,
																failure_mode: value,
															},
														},
													});
											}}
										>
											<SelectTrigger id={id}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="deny">拒绝请求</SelectItem>
												<SelectItem value="allow">放行请求</SelectItem>
											</SelectContent>
										</Select>
									)}
								</PolicyField>
							</div>
						</section>
					);
				})}
		</RuntimePolicyPage>
	);
}
