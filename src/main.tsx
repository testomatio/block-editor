import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
