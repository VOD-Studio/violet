/** 窗外天气状况（与后端 domain/window.Condition 同步）；空串表示天气暂不可用 */
export type WindowCondition = "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm" | "";

/** 窗外照片槽位 */
export type WindowPhotoSlot = "clear" | "cloudy" | "rain" | "snow" | "night";

/** 公开的窗状态（后端 GET /window） */
export interface WindowState {
	/** 站长是否已配置城市；false 时只画默认的窗，不显示天气与时间 */
	enabled: boolean;
	city: string;
	/** IANA 时区名，用来显示站长那边此刻的时间；未配置时为空串 */
	timezone: string;
	condition: WindowCondition;
	/** 站长那边此刻是否白天 */
	is_day: boolean;
	/** 气温（摄氏度）；天气暂不可用时为 null */
	temperature_c: number | null;
	/** RFC3339；空串表示天气暂不可用 */
	observed_at: string;
	photo_slot: WindowPhotoSlot;
	/** 自定义窗外照片；空串表示用内置的默认景 */
	photo: string;
}
