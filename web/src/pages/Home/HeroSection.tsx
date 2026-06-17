import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Aurora from "@/components/reactbits/backgrounds/Aurora";
import DecryptedText from "@/components/reactbits/text-animations/DecryptedText";
import GradientText from "@/components/reactbits/text-animations/GradientText";
import { Button } from "@/components/ui/button";

/**
 * 首页 Hero 区
 * 2.0：用 ReactBits 组件重设计 —— Aurora 极光背景 + GradientText 渐变标题 +
 * DecryptedText 解密副标题，替换原 creative/ 的 ParticleBackground + KineticText。
 */
export function HeroSection() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center gap-8 overflow-hidden px-4 text-center">
      {/* ReactBits Aurora 极光背景 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Aurora
          colorStops={["#5227FF", "#7CFF67", "#5227FF"]}
          amplitude={1.0}
          blend={0.5}
        />
      </div>

      {/* ReactBits GradientText 流动渐变标题 */}
      <GradientText
        colors={["#5227FF", "#FF9FFC", "#B497CF", "#5227FF"]}
        animationSpeed={6}
        className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
      >
        你好，我是开发者
      </GradientText>

      {/* ReactBits DecryptedText 解密动画副标题 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="max-w-2xl text-lg text-muted-foreground"
      >
        <DecryptedText
          text="全栈开发者，热爱开源与技术写作。专注于 React、TypeScript 和 Node.js 生态"
          animateOn="view"
          speed={50}
          maxIterations={8}
          sequential
          revealDirection="start"
        />
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="flex gap-3"
      >
        <Link to="/blog">
          <Button size="lg">
            阅读博客
            <ArrowRight className="size-4" />
          </Button>
        </Link>
        <Link to="/about">
          <Button variant="outline" size="lg">
            了解更多
          </Button>
        </Link>
      </motion.div>
    </section>
  );
}
