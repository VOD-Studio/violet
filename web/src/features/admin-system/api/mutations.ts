import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BackupSettingsDTO } from "../model/types";
import * as api from "./client";
import { systemKeys } from "./keys";

/** 执行 SQL，并在可能改变结构或统计后刷新数据库缓存。 */
export function useExecuteSQL() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: api.executeSQL,
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: systemKeys.database() }),
				queryClient.invalidateQueries({ queryKey: systemKeys.schema() }),
			]);
		},
	});
}

/** 下载数据导出附件。 */
export const useExportData = () => useMutation({ mutationFn: api.exportData });

/** 启动手动备份。 */
export const useCreateBackup = () => useMutation({ mutationFn: api.createBackup });

/** 导入签名备份，成功后刷新清单。 */
export function useImportBackup() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: api.importBackup,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: systemKeys.backups() }),
	});
}

/** 下载数据库备份或上传归档。 */
export const useDownloadBackup = () =>
	useMutation({
		mutationFn: ({ filename, part }: { filename: string; part: "database" | "uploads" }) =>
			api.downloadBackup(filename, part),
	});

/** 启动数据库恢复。 */
export const useRestoreBackup = () => useMutation({ mutationFn: api.restoreBackup });

/** 删除备份，成功后刷新清单。 */
export function useDeleteBackup() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: api.deleteBackup,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: systemKeys.backups() }),
	});
}

/** 保存自动备份设置，成功后刷新清单。 */
export function useUpdateBackupSettings() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: BackupSettingsDTO) => api.updateBackupSettings(input),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: systemKeys.backups() }),
	});
}
