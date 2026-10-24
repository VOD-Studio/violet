const numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("zh-CN", {
	style: "percent",
	maximumFractionDigits: 1,
});
const costFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 4,
});

/** 保留一位小数的用量数值。 */
export const formatUsageNumber = (value: number) => numberFormatter.format(value);

/** 将 0–1 比率显示为百分比。 */
export const formatUsagePercent = (value: number) => percentFormatter.format(value);

/** API 等价成本，美元，最多四位小数。 */
export const formatUsageCost = (value: number) => costFormatter.format(value);
