import type { PostBrowseFilter } from "@entities/post/model/types";
import { apiGet } from "@shared/api/request";
import type { ArchiveYear, ArchiveYearIndex } from "../model/types";

export const fetchArchiveYears = (filter: PostBrowseFilter = {}): Promise<ArchiveYearIndex> =>
	apiGet<ArchiveYearIndex>("/posts/archive", { params: filter });

export const fetchArchiveYear = (
	year: number,
	filter: PostBrowseFilter = {},
): Promise<ArchiveYear> => apiGet<ArchiveYear>(`/posts/archive/${year}`, { params: filter });
