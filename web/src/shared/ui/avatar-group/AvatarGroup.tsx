import { cn } from "@shared/lib/utils";

export interface AvatarUser {
    /** 用户名，同时作 alt 与首字母兜底 */
    username: string;
    /** 头像 URL，为空时渲染首字母占位 */
    avatar_url: string;
}

interface AvatarGroupProps {
    /** 参与者列表，空数组返回 null */
    users: AvatarUser[];
    /** 头像尺寸，默认 sm */
    size?: "xs" | "sm" | "md";
    /** 最多显示几个头像，超出显示 +N，默认 5 */
    max?: number;
    /** 外层 className */
    className?: string;
}

const sizeClass = {
    xs: "size-5 text-[8px]",
    sm: "size-6 text-[10px]",
    md: "size-8 text-xs",
} as const;

/**
 * AvatarGroup - GitHub 风格的头像堆叠组件
 *
 * 圆形头像横向重叠，ring 分隔；超出 max 显示 +N 占位；
 * avatar_url 缺失时渲染用户名首字母。支持单/多头像，预留共创场景。
 */
export function AvatarGroup({ users, size = "sm", max = 5, className }: AvatarGroupProps) {
    if (!users.length) return null;
    const visible = users.slice(0, max);
    const overflow = users.length - visible.length;

    return (
        <div className={cn("group flex items-center", className)}>
            <div className="flex -space-x-1 group-hover:space-x-1">
                {visible.map((u, i) => (
                    <span
                        key={i}
                        title={u.username}
                        style={{ zIndex: visible.length - i }}
                        className={cn(
                            "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-foreground transition-all duration-300",
                            sizeClass[size],
                        )}
                    >
                        {u.avatar_url ? (
                            <img
                                src={u.avatar_url}
                                alt={u.username}
                                loading="lazy"
                                className="size-full object-cover"
                            />
                        ) : (
                            <span>{u.username.charAt(0).toUpperCase()}</span>
                        )}
                    </span>
                ))}
                {overflow > 0 ? (
                    <span
                        style={{ zIndex: visible.length + 1 }}
                        className={cn(
                            "relative inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground transition-all duration-300",
                            sizeClass[size],
                        )}
                    >
                        +{overflow}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
