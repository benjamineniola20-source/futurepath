import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AuthGate from "./AuthGate";
import "./styles.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn("FuturePath offline shell could not be registered:", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate><App /></AuthGate>
  </React.StrictMode>
);