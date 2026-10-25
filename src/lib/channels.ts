/** 客户来源与渠道方。纯数据，客户端组件也可以引用。 */

export const CLIENT_SOURCES = [
  { value: "DIRECT", label: "直客" },
  { value: "ZHIWAI", label: "知外" },
  { value: "ZHITUI", label: "智推时代" },
  { value: "MAXUS", label: "Maxus" },
] as const;
export type ClientSource = (typeof CLIENT_SOURCES)[number]["value"];
export const CLIENT_SOURCE_VALUES = CLIENT_SOURCES.map((s) => s.value) as [ClientSource, ...ClientSource[]];

/** 渠道方（不含直客） */
export const CHANNELS = CLIENT_SOURCES.filter((s) => s.value !== "DIRECT");
export type ChannelCode = Exclude<ClientSource, "DIRECT">;
export const CHANNEL_VALUES = CHANNELS.map((s) => s.value) as [ChannelCode, ...ChannelCode[]];

export function sourceLabel(v: string | null | undefined): string {
  return CLIENT_SOURCES.find((s) => s.value === v)?.label ?? "直客";
}
