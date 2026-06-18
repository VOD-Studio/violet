import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import AvatarUpload from "./AvatarUpload";
import PasswordForm from "./PasswordForm";
import ProfileForm from "./ProfileForm";

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: "easeOut" as const,
    },
  }),
};

export default function Profile() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // 注：未认证守卫已由 routes/_public.profile.tsx 的 beforeLoad 负责，
  // 此处保留 isAuthenticated 检查仅为防御性渲染，不跳转。
  if (!isAuthenticated) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-2xl space-y-6 px-4 py-10"
    >
      <h1 className="text-2xl font-bold">个人中心</h1>

      {/* 头像 */}
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={cardVariants}
      >
        <Card className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <CardHeader>
            <CardTitle>头像</CardTitle>
            <CardDescription>点击头像上传新图片</CardDescription>
          </CardHeader>
          <CardContent>
            <AvatarUpload />
          </CardContent>
        </Card>
      </motion.div>

      {/* 基本资料 */}
      <motion.div
        custom={1}
        initial="hidden"
        animate="visible"
        variants={cardVariants}
      >
        <Card className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <CardHeader>
            <CardTitle>基本资料</CardTitle>
            <CardDescription>管理你的公开个人信息</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm />
          </CardContent>
        </Card>
      </motion.div>

      {/* 修改密码 */}
      <motion.div
        custom={2}
        initial="hidden"
        animate="visible"
        variants={cardVariants}
      >
        <Card className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
            <CardDescription>定期更换密码以保护账户安全</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
