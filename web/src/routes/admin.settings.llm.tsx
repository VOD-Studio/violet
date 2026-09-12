import { useLlmSettings, useUpdateLlm } from "@features/admin-settings/api/queries";
import type { LlmSettingsDTO } from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { createFileRoute } from "@tanstack/react-router";

/** LLM 配置子页表单值（仅本页字段） */
interface LlmForm {
	llm_api_key: string;
	llm_api_url: string;
	llm_model: string;
	llm_protocol: string;
}

function LlmSettingsPage() {
	const { register, page, snapshot, clearSecret, cancelSecretClear, clearedSecrets } =
		useSettingsForm<LlmForm, LlmSettingsDTO>(
			useLlmSettings(),
			useUpdateLlm(),
			(data) => ({
				llm_api_key: "",
				llm_api_url: data.llm_api_url,
				llm_model: data.llm_model,
				llm_protocol: data.llm_protocol,
			}),
			{ group: "llm", secretFields: ["llm_api_key"] },
		);

	return (
		<SettingsSubPage title="LLM 配置" description="OpenAI 协议兼容端点" state={page}>
			<section className="space-y-4">
				<h3 className="text-sm font-semibold">LLM 配置</h3>
				<p className="text-xs text-muted-foreground">
					配置 OpenAI 协议兼容端点（OpenAI / DeepSeek / Moonshot / 通义 / 智谱 / Ollama /
					vLLM），用于「导入链接」时的 AI 公式还原等功能。密钥输入留空保留原值。
				</p>
				<Field label="API Key">
					<Input
						type="password"
						autoComplete="new-password"
						{...register("llm_api_key")}
						disabled={clearedSecrets.has("llm_api_key")}
						placeholder="留空保留现有密钥"
					/>
					<p className="text-xs text-muted-foreground">
						{snapshot?.values.llm_api_key_set ? "已设置密钥" : "未设置密钥"}；
						{clearedSecrets.has("llm_api_key") ? "保存后将清除" : "不会回显原文"}
					</p>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() =>
							clearedSecrets.has("llm_api_key")
								? cancelSecretClear("llm_api_key")
								: clearSecret("llm_api_key")
						}
					>
						{clearedSecrets.has("llm_api_key") ? "取消清除" : "清除密钥"}
					</Button>
				</Field>
				<Field label="API Base URL">
					<Input {...register("llm_api_url")} placeholder="https://api.openai.com/v1" />
				</Field>
				<Field label="模型名">
					<Input {...register("llm_model")} placeholder="gpt-4o-mini" />
				</Field>
				<Field label="协议">
					<Input {...register("llm_protocol")} placeholder="openai" />
				</Field>
			</section>
		</SettingsSubPage>
	);
}

export const Route = createFileRoute("/admin/settings/llm")({
	component: LlmSettingsPage,
});
