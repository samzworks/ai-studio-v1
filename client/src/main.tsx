import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Conditionally use StrictMode only in development for better performance
const AppWrapper = () => {
  if (import.meta.env.DEV) {
    return (
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
  return <App />;
};

ReactDOM.createRoot(document.getElementById("root")!).render(<AppWrapper />);

// Remove loading screen after React renders and CSS is fully applied
const hideLoadingScreen = () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.remove();
    }, 300);
  }
};

// Wait for styles to be applied using multiple frames
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    // Small delay to ensure CSS is fully parsed and applied
    setTimeout(hideLoadingScreen, 50);
  });
});