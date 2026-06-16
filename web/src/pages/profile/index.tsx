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
  // 此处保留 isAuthenticated 检查仅为防御性渲染（不跳转）。
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">个人中心</h1>

      {/* 头像 */}
      <Card>
        <CardHeader>
          <CardTitle>头像</CardTitle>
          <CardDescription>点击头像上传新图片</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload />
        </CardContent>
      </Card>

      {/* 基本资料 */}
      <Card>
        <CardHeader>
          <CardTitle>基本资料</CardTitle>
          <CardDescription>管理你的公开个人信息</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm />
        </CardContent>
      </Card>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>定期更换密码以保护账户安全</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
