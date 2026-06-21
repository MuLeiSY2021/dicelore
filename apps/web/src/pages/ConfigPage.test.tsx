import { render, screen, act } from "@testing-library/react";
import { ThemeProvider } from "../theme/ThemeProvider.js";
import ConfigPage from "./ConfigPage.js";

function mount() {
  return render(<ThemeProvider><ConfigPage /></ThemeProvider>);
}

it("渲染 §6 左导航项", () => {
  mount();
  for (const item of ["通用", "服务与网络", "MCP 服务器", "模型连接", "主题外观", "数据与存储", "关于"]) {
    expect(screen.getByRole("button", { name: item })).toBeInTheDocument();
  }
});

it("点「主题外观」显示主题外观子页(含强调色控件)", () => {
  mount();
  act(() => { screen.getByRole("button", { name: "主题外观" }).click(); });
  expect(screen.getByLabelText("强调色")).toBeInTheDocument();
});
