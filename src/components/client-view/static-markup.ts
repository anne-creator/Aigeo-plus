/**
 * 极简的“React 元素 → 静态 HTML”序列化，只服务于 HTML 导出。
 *
 * 为什么不用 react-dom/server：Next 16 的 App Router 路由处理器跑在 React Server 层，
 * 直接 `import { renderToStaticMarkup } from "react-dom/server"` 会被编译器拦下
 * （“You're importing a component that imports react-dom/server”），且该层的 react
 * 是 react-server 构建，缺少 react-dom/server 依赖的内部对象。
 * ClientProjectView 是纯同步、无 hooks 的组件树，只用到原生标签、函数组件和 Fragment，
 * 这里按 React 的输出规则逐个展开即可，结果与 renderToStaticMarkup 一致。
 */
import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["style", "script"]);
const SKIP_PROPS = new Set(["children", "key", "ref", "dangerouslySetInnerHTML", "suppressHydrationWarning", "suppressContentEditableWarning"]);
const ATTR_NAME: Record<string, string> = {
  className: "class",
  htmlFor: "for",
  readOnly: "readonly",
  tabIndex: "tabindex",
  strokeWidth: "stroke-width",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  strokeOpacity: "stroke-opacity",
  fillRule: "fill-rule",
  fillOpacity: "fill-opacity",
  clipRule: "clip-rule",
  stopColor: "stop-color",
  textAnchor: "text-anchor",
  dominantBaseline: "dominant-baseline",
};

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

function styleToString(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "boolean")
    .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${String(v).trim()}`)
    .join(";");
}

function attrs(props: Record<string, unknown>): string {
  let out = "";
  for (const [key, value] of Object.entries(props)) {
    if (SKIP_PROPS.has(key) || value === null || value === undefined || value === false || typeof value === "function") continue;
    const name = ATTR_NAME[key] ?? key;
    if (key === "style" && typeof value === "object") {
      const css = styleToString(value as Record<string, unknown>);
      if (css) out += ` style="${escapeHtml(css)}"`;
    } else if (value === true) {
      out += name.startsWith("aria-") || name.startsWith("data-") ? ` ${name}="true"` : ` ${name}=""`;
    } else {
      out += ` ${name}="${escapeHtml(String(value))}"`;
    }
  }
  return out;
}

export function renderStaticMarkup(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return escapeHtml(node);
  if (typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(renderStaticMarkup).join("");
  if (!isValidElement(node)) throw new Error("renderStaticMarkup: 不支持的节点类型");

  const el = node as ReactElement<Record<string, unknown>>;
  const { type, props } = el;
  if (type === Fragment) return renderStaticMarkup(props.children as ReactNode);
  if (typeof type === "function") {
    const result = (type as (p: Record<string, unknown>) => ReactNode)(props);
    if (result instanceof Promise) throw new Error("renderStaticMarkup: 不支持异步组件");
    return renderStaticMarkup(result);
  }
  if (typeof type !== "string") throw new Error("renderStaticMarkup: 不支持的组件类型");

  const open = `<${type}${attrs(props)}>`;
  if (VOID.has(type)) return open;
  const inner = props.dangerouslySetInnerHTML as { __html?: string } | undefined;
  let content: string;
  if (inner?.__html !== undefined) content = inner.__html;
  else if (RAW_TEXT.has(type)) content = String(props.children ?? "").replace(new RegExp(`</(${type})`, "gi"), "\\3C/$1");
  else content = renderStaticMarkup(props.children as ReactNode);
  return `${open}${content}</${type}>`;
}
