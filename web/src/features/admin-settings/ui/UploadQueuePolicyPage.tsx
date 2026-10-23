import { updateUploadQueueSettings } from "@entities/runtime-policy/api/client";
import { useUploadQueueSettings } from "@entities/runtime-policy/api/queries";
import { useRuntimePolicyForm } from "@features/admin-settings/hooks/use-runtime-policy-form";
import { changedPolicyFields } from "@features/admin-settings/lib/runtime-policy-changes";
import { RuntimePolicyPage } from "@features/admin-settings/ui/RuntimePolicyPage";
import { PolicyNumber } from "@features/admin-settings/ui/runtime-policy-fields";

export function UploadQueuePolicyPage() {
	const form = useRuntimePolicyForm(
		useUploadQueueSettings(),
		updateUploadQueueSettings,
		changedPolicyFields,
	);
	const draft = form.draft;
	return (
		<RuntimePolicyPage title="上传队列" form={form}>
			{draft && (
				<PolicyNumber
					name="max_concurrent_files"
					label="文件并发数（个）"
					help="同一上传队列跨批次共用并发上限；单文件分片串行。修改只影响后续调度，不中断正在上传的文件。范围 1–10。"
					value={draft.max_concurrent_files}
					max={10}
					onChange={(max_concurrent_files) =>
						form.change({ ...draft, max_concurrent_files })
					}
				/>
			)}
		</RuntimePolicyPage>
	);
}
