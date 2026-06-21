import { useState } from "react";
import { ThemeAppearance } from "../config/ThemeAppearance.js";
import "./ConfigPage.css";

// 配置（子页型 · 视觉页 §6）：左导航 + 右内容。v1 仅「主题外观」接 useTheme 可用，其余展示态占位。
const NAV = [
  "通用", "服务与网络", "MCP 服务器", "模型连接", "主题外观", "数据与存储", "关于",
] as const;
type Nav = (typeof NAV)[number];

export default function ConfigPage() {
  const [active, setActive] = useState<Nav>("通用");

  return (
    <div className="cfg">
      <nav className="cfg-nav" aria-label="配置导航">
        {NAV.map((n) => (
          <button
            key={n}
            className={"cfg-navitem" + (n === active ? " active" : "")}
            onClick={() => setActive(n)}
          >
            {n}
          </button>
        ))}
      </nav>
      <section className="cfg-content">
        {active === "主题外观"
          ? <ThemeAppearance />
          : <div className="cfg-placeholder"><h2 className="cfg-h2">{active}</h2><p>占位 · 待后续实现</p></div>}
      </section>
    </div>
  );
}
