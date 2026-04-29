/**
 * 用户管理页面
 * 展示用户列表，支持角色修改和启用/禁用操作
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** 用户角色类型 */
type UserRole = "管理员" | "编辑" | "作者" | "读者"

/** 用户状态类型 */
type UserStatus = "启用" | "禁用"

/** 用户数据项 */
interface User {
  /** 用户 ID */
  id: number
  /** 用户名 */
  username: string
  /** 邮箱地址 */
  email: string
  /** 用户角色 */
  role: UserRole
  /** 账号状态 */
  status: UserStatus
  /** 注册时间 */
  registeredAt: string
}

/** 用户示例数据 */
const mockUsers: User[] = [
  { id: 1, username: "admin", email: "admin@example.com", role: "管理员", status: "启用", registeredAt: "2026-01-01" },
  { id: 2, username: "editor_zhang", email: "zhang@example.com", role: "编辑", status: "启用", registeredAt: "2026-02-15" },
  { id: 3, username: "author_li", email: "li@example.com", role: "作者", status: "启用", registeredAt: "2026-03-10" },
  { id: 4, username: "reader_wang", email: "wang@example.com", role: "读者", status: "启用", registeredAt: "2026-03-20" },
  { id: 5, username: "banned_user", email: "spam@example.com", role: "读者", status: "禁用", registeredAt: "2026-04-01" },
  { id: 6, username: "author_chen", email: "chen@example.com", role: "作者", status: "启用", registeredAt: "2026-04-10" },
]

/** 可选角色列表 */
const roleOptions: UserRole[] = ["管理员", "编辑", "作者", "读者"]

/**
 * 用户管理页面
 * 提供用户列表展示、角色修改和启用/禁用功能
 */
export default function Users() {
  /** 用户列表数据 */
  const [users, setUsers] = useState<User[]>(mockUsers)

  /**
   * 修改用户角色
   * @param userId - 用户 ID
   * @param newRole - 新角色
   */
  function changeRole(userId: number, newRole: UserRole) {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    )
  }

  /**
   * 切换用户启用/禁用状态
   * @param userId - 用户 ID
   */
  function toggleStatus(userId: number) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, status: u.status === "启用" ? "禁用" : "启用" }
          : u
      )
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">用户管理</h1>
        <p className="text-muted-foreground">管理注册用户和权限</p>
      </div>

      {/* 用户列表表格 */}
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
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  {/* 角色下拉选择器 */}
                  <Select
                    value={user.role}
                    onValueChange={(value) => changeRole(user.id, value as UserRole)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.status === "启用" ? "default" : "secondary"}
                  >
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.registeredAt}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant={user.status === "启用" ? "destructive" : "default"}
                    size="sm"
                    onClick={() => toggleStatus(user.id)}
                  >
                    {user.status === "启用" ? "禁用" : "启用"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
