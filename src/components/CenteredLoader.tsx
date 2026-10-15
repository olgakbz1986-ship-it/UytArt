import React from "react";

export const CenteredLoader: React.FC = () => (
  <div style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontSize: "1.2rem",
    color: "#666"
  }}>
    Загрузка…
  </div>
);
