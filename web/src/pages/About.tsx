// 关于页
// 展示个人简介和技术栈信息

import { motion } from "motion/react"

/** 技术栈分类结构 */
interface TechCategory {
  /** 分类名称 */
  name: string
  /** 该分类下的技术列表 */
  items: string[]
}

/** 个人技术栈数据 */
const TECH_STACK: TechCategory[] = [
  {
    name: "前端",
    items: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Vue.js"],
  },
  {
    name: "后端",
    items: ["Node.js", "NestJS", "Express", "Go", "Python"],
  },
  {
    name: "数据库",
    items: ["PostgreSQL", "MongoDB", "Redis", "Prisma"],
  },
  {
    name: "DevOps",
    items: ["Docker", "Kubernetes", "GitHub Actions", "Nginx"],
  },
  {
    name: "工具",
    items: ["Git", "VS Code", "Figma", "Vim"],
  },
]

/**
 * 关于页
 * 展示个人介绍和技术栈
 */
export default function About() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      {/* 页面标题 */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-3xl font-bold"
      >
        关于我
      </motion.h1>

      {/* 个人简介 */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-12"
      >
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-lg leading-relaxed text-muted-foreground">
            你好！我是一名全栈开发者，热爱技术与开源。目前专注于 Web 开发领域，
            擅长使用 React、TypeScript 和 Node.js 构建高质量的 Web 应用。
          </p>
          <p className="text-lg leading-relaxed text-muted-foreground">
            我相信技术的价值在于解决实际问题，因此我热衷于分享技术经验，
            帮助更多开发者成长。这个博客记录了我的学习历程和技术思考。
          </p>
          <p className="text-lg leading-relaxed text-muted-foreground">
            工作之余，我喜欢探索新技术、阅读技术书籍，偶尔也会参与开源项目。
            如果你对我的文章或项目感兴趣，欢迎通过社交链接与我联系。
          </p>
        </div>
      </motion.section>

      {/* 技术栈展示 */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="mb-6 text-2xl font-bold">技术栈</h2>

        <div className="space-y-6">
          {TECH_STACK.map((category, index) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              {/* 技术分类名称 */}
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {category.name}
              </h3>

              {/* 技术标签列表 */}
              <div className="flex flex-wrap gap-2">
                {category.items.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  )
}
