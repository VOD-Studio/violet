import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { notifySettingsChanged } from "@features/settings/api/cache-events";
import { ApiError } from "@shared/api/error";
import { type UseMutationResult, type UseQueryResult, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { type FieldValues, type Path, type UseFormReturn, useForm } from "react-hook-form";
import { toast } from "sonner";
import { resetSettings } from "../api/client";
import { settingsKeys } from "../api/keys";
import type { SettingsGroup, SettingsSnapshot, SettingsUpdate } from "../model/types";
import type { SettingsPageState } from "./SettingsSubPage";

interface SettingsFormOptions<TField> {
	group: SettingsGroup;
	secretFields?: (keyof TField & string)[];
	extraDirty?: boolean;
	extraPending?: boolean;
	onSaveExtra?: (values: TField) => Promise<void>;
	onDiscardExtra?: () => void;
}

interface SettingsFormResult<TField extends FieldValues, TData> extends UseFormReturn<TField> {
	page: SettingsPageState;
	snapshot: SettingsSnapshot<TData> | undefined;
	clearSecret: (field: keyof TField & string) => void;
	cancelSecretClear: (field: keyof TField & string) => void;
	clearedSecrets: ReadonlySet<string>;
}

/** 保留编辑基线，仅发送脏字段；重新加载和恢复默认必须由用户明确触发。 */
export function useSettingsForm<TField extends FieldValues, TData>(
	query: UseQueryResult<SettingsSnapshot<TData>>,
	updateMut: UseMutationResult<SettingsSnapshot<TData>, Error, SettingsUpdate<TField>>,
	mapDataToForm: (data: TData) => TField,
	options: SettingsFormOptions<TField>,
): SettingsFormResult<TField, TData> {
	const form = useForm<TField>();
	const {
		reset,
		setError,
		clearErrors,
		formState: { isDirty, errors },
	} = form;
	const canView = useHasPermission("settings:view");
	const canWrite = useHasPermission("settings:update");
	const qc = useQueryClient();
	const [snapshot, setSnapshot] = useState<SettingsSnapshot<TData>>();
	const [clearedSecrets, setClearedSecrets] = useState<Set<string>>(new Set());
	const [error, setFailure] = useState<Error | null>(null);
	const [busy, setBusy] = useState(false);
	const mapper = useRef(mapDataToForm);
	mapper.current = mapDataToForm;
	const dirty = !!snapshot && (isDirty || clearedSecrets.size > 0 || !!options.extraDirty);
	const pending = busy || updateMut.isPending || !!options.extraPending;

	useEffect(() => {
		if (query.data && !dirty && !busy) {
			reset(mapper.current(query.data.values));
			setSnapshot(query.data);
		}
	}, [query.data, dirty, busy, reset]);

	useBlocker({
		shouldBlockFn: () =>
			!window.confirm(
				pending ? "操作仍在进行，确定离开设置页？" : "有未保存的修改，确定放弃并离开？",
			),
		enableBeforeUnload: dirty || pending,
		disabled: !dirty && !pending,
	});

	const accept = (data: SettingsSnapshot<TData>) => {
		setSnapshot(data);
		reset(mapper.current(data.values));
		setClearedSecrets(new Set());
		setFailure(null);
	};
	const fail = (failure: unknown) => {
		const next = failure instanceof Error ? failure : new Error("操作失败，请重试");
		setFailure(next);
		if (next instanceof ApiError && next.details) {
			for (const [key, messages] of Object.entries(next.details)) {
				setError(key.replace(/^values\./, "") as Path<TField>, {
					type: "server",
					message: messages.join("；"),
				});
			}
		}
	};
	const reload = async () => {
		if (pending) return;
		if (dirty && !window.confirm("重新加载会丢弃当前未保存输入，是否继续？")) return;
		setBusy(true);
		try {
			const result = await query.refetch();
			if (result.error) throw result.error;
			if (result.data) {
				accept(result.data);
				options.onDiscardExtra?.();
			}
		} catch (failure) {
			fail(failure);
		} finally {
			setBusy(false);
		}
	};
	const restore = async () => {
		if (!canWrite || !snapshot || pending) return;
		setBusy(true);
		clearErrors();
		try {
			const result = await resetSettings<TData>(options.group, snapshot.meta.saved_version);
			qc.setQueryData([...settingsKeys.all, options.group], result);
			accept(result);
			options.onDiscardExtra?.();
			notifySettingsChanged(qc);
			if (result.meta.status === "failed") toast.error("默认值已保存，但应用失败");
			else
				toast.success(
					result.meta.status === "pending_restart"
						? "已恢复部署默认，重启后生效"
						: "已恢复部署默认",
				);
		} catch (failure) {
			fail(failure);
		} finally {
			setBusy(false);
		}
	};
	const onSubmit = form.handleSubmit(async (values) => {
		if (!canWrite || !snapshot || pending) return;
		clearErrors();
		setFailure(null);
		const changed: Partial<TField> = {};
		for (const key of Object.keys(values) as (keyof TField & string)[]) {
			if (options.secretFields?.includes(key)) {
				if (clearedSecrets.has(key)) changed[key] = "" as TField[typeof key];
				else if (values[key] !== "" && form.getFieldState(key as Path<TField>).isDirty)
					changed[key] = values[key];
			} else if (form.getFieldState(key as Path<TField>).isDirty) changed[key] = values[key];
		}
		setBusy(true);
		try {
			if (Object.keys(changed).length > 0) {
				const result = await updateMut.mutateAsync({
					expected_version: snapshot.meta.saved_version,
					values: changed,
				});
				accept(result);
			}
			await options.onSaveExtra?.(values);
		} catch (failure) {
			fail(failure);
		} finally {
			setBusy(false);
		}
	});

	return {
		...form,
		snapshot,
		clearedSecrets,
		clearSecret: (field) => setClearedSecrets((previous) => new Set([...previous, field])),
		cancelSecretClear: (field) =>
			setClearedSecrets((previous) => {
				const next = new Set(previous);
				next.delete(field);
				return next;
			}),
		page: {
			isLoading: canView && !snapshot && !query.isError,
			isPending: pending,
			isDirty: dirty,
			canView,
			canWrite,
			meta: snapshot?.meta,
			queryError: query.error,
			error,
			errors,
			onSubmit,
			onReload: reload,
			onReset: restore,
		},
	};
}
