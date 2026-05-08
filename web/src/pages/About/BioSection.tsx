import { TextReveal } from "@/components/creative";

const DEFAULT_BIO = `你好！我是一名全栈开发者，热爱技术与开源。目前专注于 Web 开发领域，擅长使用 React、TypeScript 和 Node.js 构建高质量的 Web 应用。

我相信技术的价值在于解决实际问题，因此我热衷于分享技术经验，帮助更多开发者成长。这个博客记录了我的学习历程和技术思考。

工作之余，我喜欢探索新技术、阅读技术书籍，偶尔也会参与开源项目。如果你对我的文章或项目感兴趣，欢迎通过社交链接与我联系。`;

interface BioSectionProps {
  bio?: string;
}

export function BioSection({ bio }: BioSectionProps) {
  const text = bio || DEFAULT_BIO;

  return (
    <TextReveal className="mb-12">
      <div className="prose prose-neutral dark:prose-invert max-w-none">
        {text.split("\n\n").map((paragraph, i) => (
          <p key={i} className="text-lg leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </div>
    </TextReveal>
  );
}
