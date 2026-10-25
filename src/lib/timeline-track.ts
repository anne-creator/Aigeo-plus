/** 将项目计划插入固定里程碑之间；跨越插入点的阶段拆成两段，横轴始终按日期排序。 */
export function mergeTimelineGroups<T>(
  groups: Array<{ label: string; steps: T[] }>,
  planned: T[],
  dateOf: (item: T) => string,
): Array<{ key: string; label: string; steps: T[] }> {
  const entries = [
    ...groups.flatMap((g, index) => g.steps.map((item) => ({ item, group: "system-" + index, label: g.label }))),
    ...planned.map((item, index) => ({ item, group: "plan-" + index, label: "项目计划" })),
  ].sort((a, b) => dateOf(a.item).localeCompare(dateOf(b.item)));
  const result: Array<{ key: string; label: string; steps: T[]; group: string }> = [];
  for (const entry of entries) {
    const last = result.at(-1);
    if (last?.group === entry.group) last.steps.push(entry.item);
    else result.push({ key: entry.group + "-" + result.length, label: entry.label, group: entry.group, steps: [entry.item] });
  }
  return result.map(({ key, label, steps }) => ({ key, label, steps }));
}
