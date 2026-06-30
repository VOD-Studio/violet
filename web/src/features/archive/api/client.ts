import { apiGet } from "@shared/api/request";
import type { ArchiveYear, ArchiveYearIndex } from "../model/types";

/**
 * fetchArchiveYears - 调 GET /posts/archive 获取归档年份索引
 */
export const fetchArchiveYears = async (): Promise<ArchiveYearIndex> =>
    apiGet<ArchiveYearIndex>("/posts/archive");

/**
 * fetchArchiveYear - 调 GET /posts/archive/{year} 获取指定年份归档
 *
 * @param year 年份
 */
export const fetchArchiveYear = async (year: number): Promise<ArchiveYear> =>
    apiGet<ArchiveYear>(`/posts/archive/${year}`);
