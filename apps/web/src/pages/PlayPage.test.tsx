import { render, screen } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import PlayPage from "./PlayPage.js";
import { getPresentation } from "../api/client.js";
import type { PresentationSnapshot } from "@dicelore/shared";

vi.mock("../api/client.js", () => ({ getPresentation: vi.fn() }));

const snap: PresentationSnapshot = {
  protocol: "dicelore.client/1", sessionId: "demo", seq: 5,
  sheets: [{ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] }],
  mechanics: [], choices: null, narrativeCursor: 0,
};

it("挂载时拉取 demo 会话快照并渲染到呈现台", async () => {
  (getPresentation as Mock).mockResolvedValue(snap);
  render(<PlayPage />);
  expect(getPresentation).toHaveBeenCalledWith("demo");
  expect(await screen.findByText("张三")).toBeInTheDocument();
});

it("拉取失败显示错误提示", async () => {
  (getPresentation as Mock).mockRejectedValue(new Error("boom"));
  render(<PlayPage />);
  expect(await screen.findByText(/加载失败/)).toBeInTheDocument();
});
