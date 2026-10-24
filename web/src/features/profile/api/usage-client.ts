import { apiGet } from "@shared/api/request";
import type { UsageModels, UsageRange, UsageSummary, UsageTimeseries } from "../model/usage";

export const getUsageSummary = (range: UsageRange, signal: AbortSignal) =>
	apiGet<UsageSummary>("/omp-usage/summary", { params: { range }, signal });

export const getUsageModels = (range: UsageRange, signal: AbortSignal) =>
	apiGet<UsageModels>("/omp-usage/models", { params: { range }, signal });

export const getUsageTimeseries = (range: UsageRange, signal: AbortSignal) =>
	apiGet<UsageTimeseries>("/omp-usage/timeseries", { params: { range, bucket: "day" }, signal });
