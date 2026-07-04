import { createFileRoute } from "@tanstack/react-router";
import {
    BootSequence,
    CubeFlipY,
    FlipX,
    MotdTerminal,
    ScrambleDecode,
} from "@widgets/AnnouncementLab";

/**
 * AnnouncementLab - 公告原型实验室
 *
 * 仿 theme-lab 的工作流：并排展示五种 banner 创意原型，
 * 用静态 mock 数据，方便对比挑选最终生产形态。
 * 原型细节见各变体组件的 JSDoc。
 */
function AnnouncementLab() {
    const cards = [
        { title: "1. 3D 翻转 (X 轴)", description: "FlipX", component: FlipX },
        { title: "2. MOTD 终端", description: "MotdTerminal", component: MotdTerminal },
        { title: "3. Scramble 解码", description: "ScrambleDecode", component: ScrambleDecode },
        { title: "4. Boot Sequence", description: "BootSequence", component: BootSequence },
        { title: "5. 立方翻转 (Y 轴)", description: "CubeFlipY", component: CubeFlipY },
    ];

    return (
        <div className="container mx-auto px-6 py-24">
            <div className="mb-16 text-center">
                <h1 className="mb-4 text-4xl font-bold tracking-tight">公告原型实验室</h1>
                <p className="mx-auto max-w-xl text-muted-foreground">
                    并排对比五种 banner 创意原型，hover 可暂停，滚轮可手动翻阅。 选定后落地为生产
                    AnnouncementBar。
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {cards.map((card) => {
                    const Component = card.component;
                    return (
                        <div
                            key={card.title}
                            className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 shadow-sm"
                        >
                            <h2 className="mb-1 text-lg font-semibold">{card.title}</h2>
                            <p className="mb-8 text-sm text-muted-foreground">{card.description}</p>
                            <div className="flex h-56 w-full items-center justify-center rounded-xl bg-muted/50">
                                <Component />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const Route = createFileRoute("/announcement-lab")({
    component: AnnouncementLab,
});
