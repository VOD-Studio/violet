/** 抓取频率 */
export const SUBSCRIPTION_INTERVALS = ["hourly", "every-6h", "daily", "weekly"] as const;
export type SubscriptionInterval = (typeof SUBSCRIPTION_INTERVALS)[number];

/** 订阅状态 */
export const SUBSCRIPTION_STATUSES = ["active", "paused"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** 订阅读模型 */
export interface SubscriptionDTO {
    id: string;
    user_id: string;
    feed_url: string;
    title: string;
    source_type: string;
    interval: SubscriptionInterval;
    auto_publish: boolean;
    canonical_override?: string;
    tags: string[];
    status: SubscriptionStatus;
    consecutive_failures: number;
    last_error?: string;
    last_fetched_at?: string;
    next_fetch_at?: string;
    retry_after_until?: string;
    created_at: string;
    updated_at: string;
}

/** 创建订阅请求 */
export interface CreateSubscriptionRequest {
    feed_url: string;
    title?: string;
    interval?: SubscriptionInterval;
    auto_publish?: boolean;
    canonical_override?: string;
    tags?: string[];
}

/** 更新订阅请求（nil 字段不修改） */
export interface UpdateSubscriptionRequest {
    title?: string;
    interval?: SubscriptionInterval;
    auto_publish?: boolean;
    canonical_override?: string;
    tags?: string[];
}

/** 分页列表响应 */
export interface SubscriptionListResponse {
    items: SubscriptionDTO[];
    total: number;
    page: number;
    limit: number;
}

/** interval 中文标签 */
export const intervalLabel = (i: SubscriptionInterval): string => {
    switch (i) {
        case "hourly":
            return "每小时";
        case "every-6h":
            return "每 6 小时";
        case "daily":
            return "每天";
        case "weekly":
            return "每周";
    }
};
