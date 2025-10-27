
export const metadata = {
  title: "Mock Exam",
  description: "Simple Next.js exam app (no DB)"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, Arial, sans-serif", margin: 0, background: "#0b1020", color: "#e6e6f0" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px" }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Mock Exam</h1>
            <a href="/exam" style={{ color: "#9ecbff", textDecoration: "none" }}>Go to Exam →</a>
          </header>
          <main>{children}</main>
          <footer style={{ marginTop: 48, opacity: 0.7, fontSize: 12 }}>No database. All data from local JSON.</footer>
        </div>
      </body>
    </html>
  );
}
