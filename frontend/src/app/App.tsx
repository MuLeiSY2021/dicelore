// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/shared/theme/ThemeProvider.js";
import { I18nProvider } from "@/shared/i18n/index.js";
import { SettingsProvider } from "@/shared/settings/useSettings.js";
import { AppRoutes } from "@/app/router.js";

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <SettingsProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SettingsProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
