import type {
	RuntimePolicyPatch,
	RuntimePolicyUpdate,
	RuntimePolicyView,
} from "@entities/runtime-policy/model/types";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { ApiError } from "@shared/api/error";
import { type UseMutationResult, type UseQueryResult, useMutation } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

/** 分组设置页消费的草稿与保存状态。 */
export interface RuntimePolicyForm<T extends object> {
	query: UseQueryResult<RuntimePolicyView<T>>;
	baseline: RuntimePolicyView<T> | null;
	draft: T | null;
	dirty: boolean;
	canUpdate: boolean;
	conflict: boolean;
	mutation: UseMutationResult<RuntimePolicyView<T>, Error, RuntimePolicyUpdate<T>>;
	notice: string;
	reloadError: string;
	selection: string;
	resetRequested: boolean;
	change: (next: T) => void;
	preset: (id: string) => void;
	resetDefaults: () => void;
	submit: () => Promise<void>;
	reload: () => Promise<void>;
	fieldError: (name: string) => string | undefined;
}

function matchingPreset<T>(view: RuntimePolicyView<T>) {
	const values = JSON.stringify(view.values);
	return (
		(view.presets ?? []).find((preset) => JSON.stringify(preset.values) === values)?.id ??
		"custom"
	);
}

/** 分组草稿与服务器版本分离，后台刷新和保存冲突不会覆盖未保存值。 */
export function useRuntimePolicyForm<T extends object>(
	query: UseQueryResult<RuntimePolicyView<T>>,
	save: (body: RuntimePolicyUpdate<T>) => Promise<RuntimePolicyView<T>>,
	changes: (baseline: T, draft: T) => RuntimePolicyPatch<T>,
): RuntimePolicyForm<T> {
	const canUpdate = useHasPermission("settings:update");
	const [baseline, setBaseline] = useState<RuntimePolicyView<T> | null>(null);
	const [draft, setDraft] = useState<T | null>(null);
	const [resetRequested, setResetRequested] = useState(false);
	const [selection, setSelection] = useState("custom");
	const [notice, setNotice] = useState("");
	const [reloadError, setReloadError] = useState("");
	const [conflict, setConflict] = useState(false);
	const inFlight = useRef(false);
	const mutation = useMutation({ mutationFn: save });
	const dirty =
		resetRequested ||
		(baseline !== null &&
			draft !== null &&
			JSON.stringify(baseline.values) !== JSON.stringify(draft));

	useEffect(() => {
		if (
			query.data &&
			query.data !== baseline &&
			!dirty &&
			!conflict &&
			!inFlight.current &&
			query.data.version >= (baseline?.version ?? 0)
		) {
			setBaseline(query.data);
			setDraft(query.data.values);
			setSelection(matchingPreset(query.data));
		}
	}, [query.data, dirty, conflict, baseline]);

	useBlocker({
		shouldBlockFn: () => !window.confirm("尚有未保存的策略修改，确定离开并放弃草稿？"),
		enableBeforeUnload: dirty || mutation.isPending,
		disabled: !dirty && !mutation.isPending,
	});

	const change = (next: T) => {
		if (!canUpdate || inFlight.current) return;
		setDraft(next);
		setResetRequested(false);
		setSelection("custom");
		setNotice("");
		mutation.reset();
	};
	const preset = (id: string) => {
		const selected = (baseline?.presets ?? []).find((item) => item.id === id);
		if (!selected || !canUpdate || inFlight.current) return;
		change(selected.values);
		setSelection(id);
	};
	const resetDefaults = () => {
		if (!baseline || !canUpdate || inFlight.current) return;
		if (!window.confirm("将当前分组草稿恢复为默认值，保存后撤销该组全部覆盖。确定继续？"))
			return;
		setDraft(baseline.defaults);
		setResetRequested(true);
		setSelection("defaults");
		setNotice("");
		mutation.reset();
	};
	const submit = async () => {
		if (!baseline || !draft || !canUpdate || !dirty || inFlight.current || conflict) return;
		inFlight.current = true;
		try {
			const result = await mutation.mutateAsync(
				resetRequested
					? { expected_version: baseline.version, reset: true }
					: {
							expected_version: baseline.version,
							values: changes(baseline.values, draft),
						},
			);
			setBaseline(result);
			setDraft(result.values);
			setSelection(matchingPreset(result));
			setResetRequested(false);
			setNotice(
				result.runtime.status === "applied" && result.runtime.version === result.version
					? "已保存，当前实例已应用"
					: "已保存，当前实例尚未应用此版本",
			);
			void query.refetch();
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) setConflict(true);
		} finally {
			inFlight.current = false;
		}
	};
	const reload = async () => {
		if (inFlight.current || (dirty && !window.confirm("重新加载将放弃当前草稿，确定继续？")))
			return;
		const result = await query.refetch();
		if (result.isSuccess && result.data) {
			setBaseline(result.data);
			setDraft(result.data.values);
			setResetRequested(false);
			setSelection(matchingPreset(result.data));
			setNotice("");
			setReloadError("");
			setConflict(false);
			mutation.reset();
		} else {
			setReloadError("重新加载失败，草稿已保留");
		}
	};
	const fieldError = (name: string) =>
		mutation.error instanceof ApiError
			? (mutation.error.details?.[name] ?? mutation.error.details?.[`values.${name}`])?.join(
					"；",
				)
			: undefined;
	return {
		query,
		baseline,
		draft,
		dirty,
		canUpdate,
		conflict,
		mutation,
		notice,
		reloadError,
		selection,
		resetRequested,
		change,
		preset,
		resetDefaults,
		submit,
		reload,
		fieldError,
	};
}
