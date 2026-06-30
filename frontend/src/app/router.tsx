// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Routes, Route, Outlet } from "react-router-dom";
import { TopBar } from "@/shell/TopBar.js";
import HomePage from "@/features/home/HomePage.js";
import CatalogPage from "@/features/catalog/CatalogPage.js";
import PlayPage from "@/features/play/PlayPage.js";
import BuildPage from "@/features/build/BuildPage.js";
import ConfigPage from "@/features/config/ConfigPage.js";

function Shell() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ flex: 1, minHeight: 0 }}><Outlet /></div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="adventures" element={<CatalogPage />} />
        <Route path="play" element={<PlayPage />} />
        <Route path="play/:sessionId" element={<PlayPage />} />
        <Route path="build" element={<BuildPage />} />
        <Route path="config" element={<ConfigPage />} />
      </Route>
    </Routes>
  );
}
