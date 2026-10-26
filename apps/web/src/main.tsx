import React from "react";
import ReactDOM from "react-dom/client";
import "./lib/supabase"; // initializes the shared client before anything else runs
import "./i18n"; // English, Hindi and Telugu, before the first render
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
