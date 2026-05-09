/**
 * 公告列表表格
 */

import type { Announcement } from "@/features/admin/announcements/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { typeColors, typeLabels } from "./constants";

interface AnnouncementsTableProps {
  announcements: Announcement[];
  onEdit: (announcement: Announcement) => void;
  onDelete: (announcement: Announcement) => void;
}

export function AnnouncementsTable({
  announcements,
  onEdit,
  onDelete,
}: AnnouncementsTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead>标题</TableHead>
            <TableHead className="w-20">类型</TableHead>
            <TableHead className="w-20">状态</TableHead>
            <TableHead className="w-32">创建时间</TableHead>
            <TableHead className="text-right w-32">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {announcements.map((announcement: Announcement) => (
            <TableRow key={announcement.id}>
              <TableCell className="font-mono text-muted-foreground">
                {announcement.id}
              </TableCell>
              <TableCell className="font-medium">
                {announcement.title}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={typeColors[announcement.type]}
                >
                  {typeLabels[announcement.type]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={announcement.is_active ? "default" : "secondary"}
                >
                  {announcement.is_active ? "启用" : "禁用"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(announcement.created_at).toLocaleDateString(
                  "zh-CN"
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(announcement)}
                    title="编辑"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(announcement)}
                    title="删除"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
