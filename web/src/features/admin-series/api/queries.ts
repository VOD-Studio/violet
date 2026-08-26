import { useQuery } from "@tanstack/react-query";

import type { AdminSeriesListQuery } from "../model/types";
import { getSeries, listSeries } from "./client";
import { adminSeriesKeys } from "./keys";

/** 后台书列表 hook。 */
export const useAdminSeries = (query: AdminSeriesListQuery = {}) =>
	useQuery({
		queryKey: adminSeriesKeys.list(query),
		queryFn: () => listSeries(query),
	});

/** 后台书详情 hook。id 空串时不启用查询。 */
export const useAdminSeriesDetail = (id: string) =>
	useQuery({
		queryKey: adminSeriesKeys.detail(id),
		queryFn: () => getSeries(id),
		enabled: id.length > 0,
	});
