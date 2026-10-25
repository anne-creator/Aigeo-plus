import { redirect } from "next/navigation";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { toBjYmd } from "@/lib/time";
import { KPI_ROWS } from "../../_lib";
import { ProjectForm } from "./project-form";

export default async function NewProjectPage() {
  const session = await requireSession(["PM"]);
  // 管理员代建请走管理端表单（可指定项目经理）；这里建出的项目会归属当前登录人
  if (session.role !== "PM") redirect("/admin/projects/new");
  const today = toBjYmd(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="新建客户档案"
        description="录入 CRM 信息与承诺交付 KPI，系统会按开始日期自动生成全部交付节点。"
        actions={<LinkButton href="/pm/projects" variant="secondary">返回列表</LinkButton>}
      />

      <Alert tone="blue">
        所有交付节点从「项目开始日期」（D0，第 1 天）起即可提交，截止日按开始日期推算（北京时间当天 23:59:59）；
        「提示词池 ShowUp 率」目标是季度 KPI 奖的计算依据（效果达成率 = 实际 ShowUp 率 ÷ 目标）。开始日期、方案档位、月服务费、合同月数与 KPI 建档后只能由管理员修改，请仔细核对。
      </Alert>

      <ProjectForm today={today} kpiRows={KPI_ROWS} />
    </div>
  );
}
