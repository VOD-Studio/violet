export interface Announcement {
  id: number;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  is_active: boolean;
  start_time?: string;
  end_time?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface AnnouncementListResponse {
  announcements: Announcement[];
  total: number;
  page: number;
  limit: number;
}

export interface AnnouncementCreateInput {
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  is_active?: boolean;
  start_time?: string;
  end_time?: string;
}

export interface AnnouncementUpdateInput {
  title?: string;
  content?: string;
  type?: "info" | "warning" | "success" | "error";
  is_active?: boolean;
  start_time?: string;
  end_time?: string;
}