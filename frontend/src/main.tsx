import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

const loader = document.getElementById("initial-loader");
if (loader) {
  loader.classList.add("hide");
  setTimeout(() => loader.remove(), 300);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
