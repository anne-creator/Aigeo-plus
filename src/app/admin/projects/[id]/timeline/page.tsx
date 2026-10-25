import { redirect } from "next/navigation";

/** 日历侧栏里管理员视角的 timeline 事件链接到这里：管理员在项目详情页的「项目 timeline」区块维护条目 */
export default async function AdminProjectTimelineRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/projects/${id}#project-timeline`);
}
