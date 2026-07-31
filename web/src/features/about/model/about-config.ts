/**
 * about_config - 关于页区块版面配置的解析与类型
 *
 * 后端透明存储聚合 JSON 字符串（site_settings.about_config 键）。
 * 本模块负责把它解析成强类型的 sections 数组，供前台渲染与后台编辑共用。
 *
 * 结构：{ sections: [{ id, enabled, order, params }] }
 * - id: 区块标识（如 "avatar"、"bio"、"releases"）
 * - enabled: 是否显示
 * - order: 排序权重（升序）
 * - params: 区块私有参数（如头像 URL、社交平台列表）
 */

/** 单个区块配置 */
export interface AboutSection {
    /** 区块标识 */
    id: string;
    /** 是否显示 */
    enabled: boolean;
    /** 排序权重（升序，缺省按出现顺序） */
    order?: number;
    /** 区块私有参数（自由结构，由各区块自行解释） */
    params?: Record<string, unknown>;
}

/** 整个 about_config 的结构 */
export interface AboutConfig {
    sections: AboutSection[];
}

/**
 * 解析 about_config JSON 字符串。
 *
 * 容错策略：任何解析失败（空串、非法 JSON、结构不符）都返回空 sections，
 * 调用方据此回退到默认渲染。解析在前端消费侧完成，后端不校验。
 */
export function parseAboutConfig(raw: string | undefined | null): AboutConfig {
    if (!raw || raw.trim() === "") {
        return { sections: [] };
    }
    try {
        const parsed = JSON.parse(raw) as Partial<AboutConfig>;
        if (!parsed || !Array.isArray(parsed.sections)) {
            return { sections: [] };
        }
        return { sections: parsed.sections };
    } catch {
        return { sections: [] };
    }
}

/**
 * 按 order 升序排序区块（order 缺省视为 0），过滤出 enabled 的区块。
 * 返回的 id 列表供前台按序渲染对应区块组件。
 */
export function resolveSectionOrder(config: AboutConfig): string[] {
    return [...config.sections]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .filter((s) => s.enabled)
        .map((s) => s.id);
}

/** 把 AboutConfig 序列化为后端存储的 JSON 字符串 */
export function stringifyAboutConfig(config: AboutConfig): string {
    return JSON.stringify(config);
}
