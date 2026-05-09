// 角色与权限管理页面 — 薄层，从 features 导入组合

import { RolesTable, PermissionsTable } from "@/features/admin/roles";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Roles() {
  return (
    <PermissionGuard code="role:manage">
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">角色管理</TabsTrigger>
          <TabsTrigger value="permissions">权限管理</TabsTrigger>
        </TabsList>
        <TabsContent value="roles">
          <RolesTable />
        </TabsContent>
        <TabsContent value="permissions">
          <PermissionsTable />
        </TabsContent>
      </Tabs>
    </PermissionGuard>
  );
}
