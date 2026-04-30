/**
 * 用户管理页面
 * 从 API 获取用户列表，支持角色修改和启用/禁用操作
 * 无 mock 数据，API 不存在时显示空状态
 */

import { useState } from "react"
import { useAdminUsers, useUpdateUserRole, useToggleUserStatus } from "@/hooks/useAdmin"
import type { AdminUser } from "@/hooks/useAdmin"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorFallback } from "@/components/shared/ErrorFallback"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"

/**
 * 用户列表表格骨架屏
 */
function UsersTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>用户名</TableHead>
            <TableHead>邮箱</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>注册时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * 用户管理页面
 * 从 API 获取用户数据，提供角色修改和状态切换功能
 */
export default function Users() {
  const { data: users, isLoading, error, refetch } = useAdminUsers()
  const updateRole = useUpdateUserRole()
  const toggleStatus = useToggleUserStatus()

  /** 确认弹窗状态 */
  const [confirmState, setConfirmState] = useState<{
    open: boolean
    userId: string
    userName: string
    newStatus: boolean
  }>({ open: false, userId: "", userName: "", newStatus: false })

  /**
   * 修改用户角色
   */
  function changeRole(userId: string, newRole: string) {
    updateRole.mutate({ id: userId, role: newRole })
  }

  /**
   * 弹出确认弹窗
   */
  function handleToggleStatus(userId: string, userName: string, currentActive: boolean) {
    setConfirmState({
      open: true,
      userId,
      userName,
      newStatus: !currentActive,
    })
  }

  /**
   * 确认切换状态
   */
  function confirmToggleStatus() {
    toggleStatus.mutate({ id: confirmState.userId, is_active: confirmState.newStatus })
    setConfirmState({ open: false, userId: "", userName: "", newStatus: false })
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">用户管理</h1>
        <p className="text-muted-foreground">管理注册用户和权限</p>
      </div>

      {/* 加载态 */}
      {isLoading && <UsersTableSkeleton />}

      {/* 错误状态 */}
      {error && (
        <ErrorFallback error={error.message} onRetry={refetch} />
      )}

      {/* 空数据状态 */}
      {!isLoading && !error && (!users || users.length === 0) && (
        <EmptyState
          title="暂无用户数据"
          description="当前没有注册用户，或用户管理 API 尚未开放"
          icon={
            <svg className="size-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
        />
      )}

      {/* 用户列表表格 */}
      {!isLoading && !error && users && users.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: AdminUser) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => value && changeRole(user.id, value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="user">用户</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "启用" : "禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={user.is_active ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleToggleStatus(user.id, user.username, user.is_active)}
                    >
                      {user.is_active ? "禁用" : "启用"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 确认切换状态弹窗 */}
      <ConfirmDialog
        open={confirmState.open}
        onClose={() => setConfirmState({ open: false, userId: "", userName: "", newStatus: false })}
        onConfirm={confirmToggleStatus}
        title={confirmState.newStatus ? "启用用户" : "禁用用户"}
        description={
          confirmState.newStatus
            ? `确定要启用用户「${confirmState.userName}」吗？`
            : `确定要禁用用户「${confirmState.userName}」吗？禁用后该用户将无法登录。`
        }
        confirmLabel={confirmState.newStatus ? "启用" : "禁用"}
        destructive={!confirmState.newStatus}
      />
    </div>
  )
}
