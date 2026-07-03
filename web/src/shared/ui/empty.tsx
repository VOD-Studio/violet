import { cn } from "@shared/lib/utils";
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import type { ReactNode } from "react";

export interface EmptyProps {
    /** 标题（必填，用解密动画呈现） */
    title: string;
    /** 描述文案（可选） */
    description?: string;
    /** 操作区（可选，通常放 <Button>） */
    action?: ReactNode;
    /** 尺寸 */
    size?: "sm" | "md" | "lg";
    className?: string;
}

const TITLE_CLASS = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
};

/**
 * Empty - 解密乱码文字空状态
 *
 * 与 HeroLeft 的 xunrua 同源视觉语言：标题用赛博解密动画呈现
 * （乱码翻转为真实字母），无任何图形/插画。极客、克制、动效驱动，
 * 和项目整体气质一致。
 *
 * 解密在元素进入视口时触发（animateOn="view"），重复挂载会重新播放。
 * 描述与操作区是普通静态文字。
 *
 * 通用用法：
 * <Empty title="EMPTY" description="还没有发布任何内容" action={<Button>写一篇</Button>} />
 */
const Empty = ({ title, description, action, size = "md", className }: EmptyProps) => {
    return (
        <div
            className={cn("flex flex-col items-center justify-center gap-3 text-center", className)}
            role="status"
        >
            <h3 className={cn("font-mono font-bold tracking-tight", TITLE_CLASS[size])}>
                <DecryptedText
                    text={title}
                    animateOn="view"
                    speed={50}
                    maxIterations={10}
                    parentClassName="inline-block"
                    className="bg-gradient-to-r from-muted-foreground to-muted-foreground bg-clip-text text-transparent"
                    encryptedClassName="text-muted-foreground/50"
                />
            </h3>

            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}

            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    );
};

export default Empty;
