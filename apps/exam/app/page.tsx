
"use client";
import { useEffect, useState } from "react";

type User = { username: string; password: string; name?: string };

export default function LoginPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/data/login.json").then(r => r.json()).then(setUsers).catch(() => setUsers([]));
  }, []);

  const onLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const match = users.find(u => u.username === username && u.password === password);
    if (match) {
      localStorage.setItem("mockexam_user", JSON.stringify(match));
      window.location.href = "/exam";
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <div style={{ background: "#121a33", border: "1px solid #2b3a6a", borderRadius: 16, padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Login</h2>
      <form onSubmit={onLogin}>
        <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
          <label>
            <div>Username</div>
            <input value={username} onChange={e=>setUsername(e.target.value)} required
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2b3a6a", background: "#0e1630", color: "#e6e6f0" }}/>
          </label>
          <label>
            <div>Password</div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2b3a6a", background: "#0e1630", color: "#e6e6f0" }}/>
          </label>
          {error && <div style={{ color: "#ff8a8a" }}>{error}</div>}
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #2b3a6a", background: "#1a2752", color: "white", cursor: "pointer" }}>
            Sign in
          </button>
        </div>
      </form>
      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.8 }}>Demo user: <code>demo / demo123</code></p>
    </div>
  );
}
