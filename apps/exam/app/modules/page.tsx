"use client";
import { useEffect, useState } from "react";

type Module = {
  id: string;
  name: string;
  description: string;
  file: string;
  questionCount: number;
  badge: string;
};

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  AI: { bg: "#1a3a5c", color: "#60b4ff" },
  SD: { bg: "#1a3a2a", color: "#60e8a0" },
};

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [userName, setUserName] = useState<string>("Candidate");
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    // Auth guard
    const stored = localStorage.getItem("mockexam_user");
    if (!stored) {
      window.location.href = "/";
      return;
    }
    try {
      const user = JSON.parse(stored);
      setUserName(user.name || user.username || "Candidate");
    } catch {
      window.location.href = "/";
      return;
    }

    fetch("/data/modules.json")
      .then((r) => r.json())
      .then(setModules)
      .catch(() => setModules([]));
  }, []);

  const startModule = (file: string) => {
    window.location.href = `/exam?module=${encodeURIComponent(file)}`;
  };

  const handleLogout = () => {
    localStorage.removeItem("mockexam_user");
    window.location.href = "/";
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 36,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
            Select a Module
          </h2>
          <div style={{ opacity: 0.6, fontSize: 14, marginTop: 4 }}>
            Welcome, {userName} — choose a test to begin
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #2b3a6a",
            background: "transparent",
            color: "#9ecbff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Logout
        </button>
      </div>

      {/* Module grid */}
      {modules.length === 0 ? (
        <div style={{ opacity: 0.7, textAlign: "center", marginTop: 60 }}>
          Loading modules…
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {modules.map((mod) => {
            const badgeStyle = BADGE_COLORS[mod.badge] || {
              bg: "#2b3a6a",
              color: "#e6e6f0",
            };
            const isHovered = hovered === mod.id;

            return (
              <div
                key={mod.id}
                onClick={() => startModule(mod.file)}
                onMouseEnter={() => setHovered(mod.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isHovered ? "#17234a" : "#121a33",
                  border: isHovered
                    ? "1px solid #5f7fd4"
                    : "1px solid #2b3a6a",
                  borderRadius: 14,
                  padding: "22px 20px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  transform: isHovered ? "translateY(-2px)" : "none",
                  boxShadow: isHovered
                    ? "0 8px 24px rgba(95,127,212,0.15)"
                    : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Badge + question count row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      background: badgeStyle.bg,
                      color: badgeStyle.color,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 1,
                      padding: "3px 10px",
                      borderRadius: 999,
                      textTransform: "uppercase",
                    }}
                  >
                    {mod.badge}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      opacity: 0.6,
                      background: "#0e1630",
                      padding: "3px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {mod.questionCount} questions
                  </span>
                </div>

                {/* Name */}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 17,
                    lineHeight: 1.3,
                    color: isHovered ? "#a0c4ff" : "#e6e6f0",
                  }}
                >
                  {mod.name}
                </div>

                {/* Description */}
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.7,
                    lineHeight: 1.6,
                    flexGrow: 1,
                  }}
                >
                  {mod.description}
                </div>

                {/* CTA */}
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: isHovered ? "#5f7fd4" : "#4a6ab0",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Start Test
                  <span style={{ fontSize: 16 }}>→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
