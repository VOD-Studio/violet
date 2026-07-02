import { Button } from "@shared/ui/button";
import { Link } from "@tanstack/react-router";

export interface ComingSoonProps {
    title: string;
}

/**
 * ComingSoon - 占位页（Nexus 视觉）
 *
 * 标题 + Loader 轨道动效 + 返回首页，替代简陋「建设中」文案。
 */
const ComingSoon = ({ title }: ComingSoonProps) => {
    return (
        <div className="container mx-auto px-4 py-24">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-8 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    In Construction
                </p>
                <h1 className="font-mono text-4xl font-bold">{title}</h1>
                <Button asChild variant="outline">
                    <Link to="/">返回首页</Link>
                </Button>
            </div>
        </div>
    );
};

export default ComingSoon;
