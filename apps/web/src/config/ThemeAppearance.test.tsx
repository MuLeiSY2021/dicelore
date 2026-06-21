import { render, screen, act, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../theme/ThemeProvider.js";
import { ThemeAppearance } from "./ThemeAppearance.js";

function mount() {
  return render(<ThemeProvider><ThemeAppearance /></ThemeProvider>);
}

it("切换明暗写到 <html data-theme>", () => {
  mount();
  expect(document.documentElement.dataset.theme).toBe("dark");
  act(() => { screen.getByRole("button", { name: "切换明暗" }).click(); });
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("选强调色写到 <html data-accent>", () => {
  mount();
  fireEvent.change(screen.getByLabelText("强调色"), { target: { value: "crimson" } });
  expect(document.documentElement.dataset.accent).toBe("crimson");
});
