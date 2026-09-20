import { httpClient } from "@shared/api/http";
import { apiDelete, apiGet, apiPost, apiPut } from "@shared/api/request";
import type {
	BackupInfoDTO,
	BackupListDTO,
	BackupSettingsDTO,
	BackupSettingsViewDTO,
	BackupTaskDTO,
	DatabaseSchemaDTO,
	DatabaseStatusDTO,
	ExecuteSQLInput,
	ExportInput,
	SQLResultDTO,
	SystemHistoryDTO,
	SystemSnapshotDTO,
} from "../model/types";

const BASE = "/admin/system";

export interface DownloadedFile {
	blob: Blob;
	filename: string;
}

/** 获取服务器实时快照。 */
export const getSystemSnapshot = async (): Promise<SystemSnapshotDTO> =>
	apiGet<SystemSnapshotDTO>(`${BASE}/snapshot`);

/** 获取最近 24 小时服务器采样点。 */
export const getSystemHistory = async (): Promise<SystemHistoryDTO> =>
	apiGet<SystemHistoryDTO>(`${BASE}/history`);

/** 获取 PostgreSQL 状态与统计。 */
export const getDatabaseStatus = async (): Promise<DatabaseStatusDTO> =>
	apiGet<DatabaseStatusDTO>(`${BASE}/database`);

/** 获取 public schema 表与列。 */
export const getDatabaseSchema = async (): Promise<DatabaseSchemaDTO> =>
	apiGet<DatabaseSchemaDTO>(`${BASE}/schema`);

/** 执行受控 SQL。 */
export const executeSQL = async (input: ExecuteSQLInput): Promise<SQLResultDTO> =>
	apiPost<SQLResultDTO>(`${BASE}/sql`, input);

/** 导出表或只读查询结果。 */
export async function exportData(input: ExportInput): Promise<DownloadedFile> {
	const response = await httpClient.post<Blob>(`${BASE}/export`, input, { responseType: "blob" });
	return {
		blob: response.data,
		filename: attachmentFilename(
			response.headers["content-disposition"],
			`violet-export.${input.format}`,
		),
	};
}

/** 获取备份清单与调度设置。 */
export const getBackups = async (): Promise<BackupListDTO> =>
	apiGet<BackupListDTO>(`${BASE}/backups`);

/** 启动手动备份任务。 */
export const createBackup = async (includeUploads: boolean): Promise<BackupTaskDTO> =>
	apiPost<BackupTaskDTO>(`${BASE}/backups`, { include_uploads: includeUploads });

/** 导入当前实例签名的 SQL 备份。 */
export const importBackup = async (file: File): Promise<BackupInfoDTO> => {
	const form = new FormData();
	form.append("file", file);
	return apiPost<BackupInfoDTO>(`${BASE}/backups/import`, form);
};

/** 下载数据库备份或配对上传归档。 */
export async function downloadBackup(
	filename: string,
	part: "database" | "uploads",
): Promise<DownloadedFile> {
	const response = await httpClient.get<Blob>(
		`${BASE}/backups/${encodeURIComponent(filename)}/download`,
		{ params: { part }, responseType: "blob" },
	);
	return {
		blob: response.data,
		filename: attachmentFilename(response.headers["content-disposition"], filename),
	};
}

/** 启动数据库恢复任务。 */
export const restoreBackup = async (filename: string): Promise<BackupTaskDTO> =>
	apiPost<BackupTaskDTO>(`${BASE}/backups/${encodeURIComponent(filename)}/restore`, {
		confirm_filename: filename,
	});

/** 删除备份及配对上传归档。 */
export const deleteBackup = async (filename: string): Promise<void> =>
	apiDelete<void>(`${BASE}/backups/${encodeURIComponent(filename)}`);

/** 获取异步备份或恢复任务。 */
export const getBackupTask = async (id: string): Promise<BackupTaskDTO> =>
	apiGet<BackupTaskDTO>(`${BASE}/tasks/${encodeURIComponent(id)}`);

/** 更新自动备份设置。 */
export const updateBackupSettings = async (
	input: BackupSettingsDTO,
): Promise<BackupSettingsViewDTO> =>
	apiPut<BackupSettingsViewDTO>(`${BASE}/backup-settings`, input);

function attachmentFilename(header: unknown, fallback: string): string {
	if (typeof header !== "string") return fallback;
	const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
	if (encoded) {
		try {
			return decodeURIComponent(encoded);
		} catch {
			return fallback;
		}
	}
	return header.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}
