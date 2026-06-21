import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import "./styles/tokens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <div style={{ padding: 24, fontFamily: "var(--font-display)" }}>Dicelore</div>
    </ThemeProvider>
  </StrictMode>,
);
