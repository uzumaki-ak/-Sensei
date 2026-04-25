"use client";

/**
 * 6 Resume Templates — pure HTML/CSS for PDF rendering via html2pdf.
 * Each template receives the same `data` prop:
 * {
 *   name, email, phone, linkedin, github, website,
 *   summary,
 *   skills: [string],
 *   experience: [{ title, company, location, startDate, endDate, bullets: [string] }],
 *   education: [{ degree, school, location, startDate, endDate, gpa }],
 *   projects: [{ name, techStack, description, bullets: [string] }],
 *   certifications: [string]
 * }
 */

/* ── shared helpers ────────────────────────────────── */
const Section = ({ title, children, color = "#111" }) => (
  <div style={{ marginBottom: 14 }}>
    <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color, borderBottom: `1.5px solid ${color}`, paddingBottom: 3, marginBottom: 8 }}>{title}</h2>
    {children}
  </div>
);

const BulletList = ({ items = [], fontSize = 11 }) => (
  <ul style={{ margin: "4px 0 0 16px", padding: 0, listStyleType: "disc" }}>
    {items.map((b, i) => <li key={i} style={{ fontSize, lineHeight: 1.5, marginBottom: 2 }}>{b}</li>)}
  </ul>
);

const SkillPills = ({ skills = [], bg = "#eee", color = "#333" }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
    {skills.map((s, i) => (
      <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 3, background: bg, color, fontWeight: 500 }}>{s}</span>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════
   TEMPLATE 1 – Classic (single column, serif, clean)
   ═══════════════════════════════════════════════════════ */
export function ClassicTemplate({ data }) {
  const d = data || {};
  return (
    <div style={{ backgroundColor: "#fff", minHeight: 1056, fontFamily: "'Times New Roman', Georgia, serif", color: "#222", padding: "36px 40px", maxWidth: 800, margin: "0 auto", lineHeight: 1.45 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: 1 }}>{d.name || "Your Name"}</h1>
        <p style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
          {[d.email, d.phone, d.linkedin, d.github].filter(Boolean).join("  •  ")}
        </p>
      </div>

      {d.summary && <Section title="Summary"><p style={{ fontSize: 11.5, margin: 0 }}>{d.summary}</p></Section>}

      {d.experience?.length > 0 && (
        <Section title="Experience">
          {d.experience.map((e, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 12 }}>{e.title} — {e.company}</strong>
                <span style={{ fontSize: 10.5, color: "#666" }}>{e.startDate} – {e.endDate || "Present"}</span>
              </div>
              {e.location && <p style={{ fontSize: 10, color: "#888", margin: "1px 0 0" }}>{e.location}</p>}
              <BulletList items={e.bullets} />
            </div>
          ))}
        </Section>
      )}

      {d.education?.length > 0 && (
        <Section title="Education">
          {d.education.map((e, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 12 }}>{e.degree}</strong>
                <span style={{ fontSize: 10.5, color: "#666" }}>{e.startDate} – {e.endDate || "Present"}</span>
              </div>
              <p style={{ fontSize: 11, margin: 0, color: "#555" }}>{e.school}{e.gpa ? ` — GPA: ${e.gpa}` : ""}</p>
            </div>
          ))}
        </Section>
      )}

      {d.skills?.length > 0 && (
        <Section title="Skills"><p style={{ fontSize: 11, margin: 0 }}>{d.skills.join(", ")}</p></Section>
      )}

      {d.projects?.length > 0 && (
        <Section title="Projects">
          {d.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 12 }}>{p.name}</strong>
              {p.techStack && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>({p.techStack})</span>}
              {p.description && <p style={{ fontSize: 11, margin: "2px 0 0" }}>{p.description}</p>}
              <BulletList items={p.bullets} />
            </div>
          ))}
        </Section>
      )}

      {d.certifications?.length > 0 && (
        <Section title="Certifications"><p style={{ fontSize: 11, margin: 0 }}>{d.certifications.join("  •  ")}</p></Section>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE 2 – Modern (two-column, colored sidebar)
   ═══════════════════════════════════════════════════════ */
export function ModernTemplate({ data }) {
  const d = data || {};
  const accent = "#1a56db";
  return (
    <div style={{ backgroundColor: "#fff", minHeight: 1056, fontFamily: "'Segoe UI', Roboto, sans-serif", display: "flex", maxWidth: 800, margin: "0 auto", color: "#222" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: accent, color: "#fff", padding: "30px 20px", flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", lineHeight: 1.2 }}>{d.name || "Your Name"}</h1>
        <div style={{ fontSize: 10, opacity: 0.85, lineHeight: 1.6, marginBottom: 20 }}>
          {d.email && <div>{d.email}</div>}
          {d.phone && <div>{d.phone}</div>}
          {d.linkedin && <div>{d.linkedin}</div>}
          {d.github && <div>{d.github}</div>}
        </div>

        {d.skills?.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: 4, marginBottom: 8 }}>Skills</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {d.skills.map((s, i) => (
                <span key={i} style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 3, background: "rgba(255,255,255,0.15)", fontWeight: 500 }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {d.education?.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: 4, marginBottom: 8 }}>Education</h3>
            {d.education.map((e, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{e.degree}</div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>{e.school}</div>
                <div style={{ fontSize: 9.5, opacity: 0.7 }}>{e.startDate} – {e.endDate || "Present"}</div>
              </div>
            ))}
          </div>
        )}

        {d.certifications?.length > 0 && (
          <div>
            <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: 4, marginBottom: 8 }}>Certifications</h3>
            {d.certifications.map((c, i) => <div key={i} style={{ fontSize: 10, marginBottom: 3, opacity: 0.9 }}>{c}</div>)}
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "30px 28px" }}>
        {d.summary && <Section title="Profile" color={accent}><p style={{ fontSize: 11, margin: 0, lineHeight: 1.55 }}>{d.summary}</p></Section>}

        {d.experience?.length > 0 && (
          <Section title="Experience" color={accent}>
            {d.experience.map((e, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong style={{ fontSize: 12 }}>{e.title}</strong>
                  <span style={{ fontSize: 10, color: "#888" }}>{e.startDate} – {e.endDate || "Present"}</span>
                </div>
                <p style={{ fontSize: 11, color: accent, margin: "1px 0 0", fontWeight: 500 }}>{e.company}{e.location ? `, ${e.location}` : ""}</p>
                <BulletList items={e.bullets} />
              </div>
            ))}
          </Section>
        )}

        {d.projects?.length > 0 && (
          <Section title="Projects" color={accent}>
            {d.projects.map((p, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <strong style={{ fontSize: 12 }}>{p.name}</strong>
                {p.techStack && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>| {p.techStack}</span>}
                <BulletList items={p.bullets} />
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE 3 – Minimal (ultra clean, sans-serif)
   ═══════════════════════════════════════════════════════ */
export function MinimalTemplate({ data }) {
  const d = data || {};
  return (
    <div style={{ backgroundColor: "#fff", minHeight: 1056, fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: "#1a1a1a", padding: "40px 44px", maxWidth: 800, margin: "0 auto", lineHeight: 1.5 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, margin: 0, letterSpacing: -0.5 }}>{d.name || "Your Name"}</h1>
        <p style={{ fontSize: 11, color: "#999", marginTop: 4, letterSpacing: 0.5 }}>
          {[d.email, d.phone, d.linkedin].filter(Boolean).join("  /  ")}
        </p>
      </div>

      {d.summary && <div style={{ marginBottom: 18 }}><p style={{ fontSize: 11.5, color: "#444", margin: 0, borderLeft: "2px solid #ddd", paddingLeft: 12 }}>{d.summary}</p></div>}

      {d.experience?.length > 0 && (
        <Section title="Experience" color="#999">
          {d.experience.map((e, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12 }}><strong>{e.title}</strong> at {e.company}</span>
                <span style={{ fontSize: 10, color: "#aaa" }}>{e.startDate} – {e.endDate || "Present"}</span>
              </div>
              <BulletList items={e.bullets} />
            </div>
          ))}
        </Section>
      )}

      {d.skills?.length > 0 && (
        <Section title="Skills" color="#999"><p style={{ fontSize: 11, margin: 0, color: "#555" }}>{d.skills.join("  ·  ")}</p></Section>
      )}

      {d.education?.length > 0 && (
        <Section title="Education" color="#999">
          {d.education.map((e, i) => (
            <div key={i} style={{ fontSize: 11, marginBottom: 4 }}>
              <strong>{e.degree}</strong> — {e.school} ({e.startDate} – {e.endDate || "Present"})
            </div>
          ))}
        </Section>
      )}

      {d.projects?.length > 0 && (
        <Section title="Projects" color="#999">
          {d.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 12 }}>{p.name}</strong>
              {p.techStack && <span style={{ fontSize: 10, color: "#aaa" }}> — {p.techStack}</span>}
              <BulletList items={p.bullets} />
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE 4 – Professional (blue accents, structured)
   ═══════════════════════════════════════════════════════ */
export function ProfessionalTemplate({ data }) {
  const d = data || {};
  const primary = "#0d47a1";
  return (
    <div style={{ backgroundColor: "#fff", minHeight: 1056, fontFamily: "'Calibri', 'Segoe UI', sans-serif", color: "#222", padding: "0", maxWidth: 800, margin: "0 auto" }}>
      {/* Header band */}
      <div style={{ background: primary, color: "#fff", padding: "28px 36px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{d.name || "Your Name"}</h1>
        <p style={{ fontSize: 11, marginTop: 6, opacity: 0.9, letterSpacing: 0.4 }}>
          {[d.email, d.phone, d.linkedin, d.github].filter(Boolean).join("  |  ")}
        </p>
      </div>

      <div style={{ padding: "24px 36px" }}>
        {d.summary && <Section title="Professional Summary" color={primary}><p style={{ fontSize: 11.5, margin: 0, lineHeight: 1.6 }}>{d.summary}</p></Section>}

        {d.skills?.length > 0 && (
          <Section title="Technical Skills" color={primary}><SkillPills skills={d.skills} bg="#e3f2fd" color={primary} /></Section>
        )}

        {d.experience?.length > 0 && (
          <Section title="Work Experience" color={primary}>
            {d.experience.map((e, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{e.title}</span>
                  <span style={{ fontSize: 10, color: "#888" }}>{e.startDate} – {e.endDate || "Present"}</span>
                </div>
                <p style={{ fontSize: 11, color: primary, margin: "1px 0 0", fontWeight: 600 }}>{e.company}{e.location ? ` — ${e.location}` : ""}</p>
                <BulletList items={e.bullets} />
              </div>
            ))}
          </Section>
        )}

        {d.projects?.length > 0 && (
          <Section title="Key Projects" color={primary}>
            {d.projects.map((p, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <strong style={{ fontSize: 12 }}>{p.name}</strong>
                {p.techStack && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>({p.techStack})</span>}
                <BulletList items={p.bullets} />
              </div>
            ))}
          </Section>
        )}

        {d.education?.length > 0 && (
          <Section title="Education" color={primary}>
            {d.education.map((e, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <strong style={{ fontSize: 12 }}>{e.degree}</strong>
                <p style={{ fontSize: 11, margin: 0, color: "#555" }}>{e.school} | {e.startDate} – {e.endDate || "Present"}{e.gpa ? ` | GPA: ${e.gpa}` : ""}</p>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE 5 – Bold (dark header, strong contrast)
   ═══════════════════════════════════════════════════════ */
export function BoldTemplate({ data }) {
  const d = data || {};
  return (
    <div style={{ backgroundColor: "#fff", minHeight: 1056, fontFamily: "'Arial', sans-serif", color: "#222", maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: "#1e1e2e", color: "#fff", padding: "32px 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{d.name || "Your Name"}</h1>
          {d.summary && <p style={{ fontSize: 11, marginTop: 6, opacity: 0.75, maxWidth: 400, lineHeight: 1.5 }}>{d.summary}</p>}
        </div>
        <div style={{ textAlign: "right", fontSize: 10, opacity: 0.8, lineHeight: 1.8 }}>
          {d.email && <div>{d.email}</div>}
          {d.phone && <div>{d.phone}</div>}
          {d.linkedin && <div>{d.linkedin}</div>}
          {d.github && <div>{d.github}</div>}
        </div>
      </div>

      <div style={{ padding: "24px 36px" }}>
        {d.skills?.length > 0 && (
          <Section title="Skills" color="#1e1e2e"><SkillPills skills={d.skills} bg="#1e1e2e" color="#fff" /></Section>
        )}

        {d.experience?.length > 0 && (
          <Section title="Experience" color="#1e1e2e">
            {d.experience.map((e, i) => (
              <div key={i} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: "3px solid #1e1e2e" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 12.5 }}>{e.title}</strong>
                  <span style={{ fontSize: 10, color: "#888" }}>{e.startDate} – {e.endDate || "Present"}</span>
                </div>
                <p style={{ fontSize: 11, color: "#666", margin: "1px 0 0" }}>{e.company}{e.location ? ` | ${e.location}` : ""}</p>
                <BulletList items={e.bullets} />
              </div>
            ))}
          </Section>
        )}

        {d.projects?.length > 0 && (
          <Section title="Projects" color="#1e1e2e">
            {d.projects.map((p, i) => (
              <div key={i} style={{ marginBottom: 10, paddingLeft: 12, borderLeft: "3px solid #ddd" }}>
                <strong style={{ fontSize: 12 }}>{p.name}</strong>
                {p.techStack && <span style={{ fontSize: 10, color: "#888" }}> — {p.techStack}</span>}
                <BulletList items={p.bullets} />
              </div>
            ))}
          </Section>
        )}

        {d.education?.length > 0 && (
          <Section title="Education" color="#1e1e2e">
            {d.education.map((e, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <strong style={{ fontSize: 12 }}>{e.degree}</strong> — {e.school}
                <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>{e.startDate} – {e.endDate || "Present"}</span>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE 6 – Jake's (LaTeX-inspired, dense, no color)
   ═══════════════════════════════════════════════════════ */
export function JakeTemplate({ data }) {
  const d = data || {};
  return (
    <div style={{ backgroundColor: "#fff", minHeight: 1056, fontFamily: "'CMU Serif', 'Computer Modern', 'Times New Roman', serif", color: "#000", padding: "32px 36px", maxWidth: 800, margin: "0 auto", fontSize: 11, lineHeight: 1.35 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: 2 }}>{(d.name || "Your Name").toUpperCase()}</h1>
        <p style={{ fontSize: 10, marginTop: 4, letterSpacing: 0.5 }}>
          {[d.phone, d.email, d.linkedin, d.github].filter(Boolean).join(" | ")}
        </p>
      </div>

      <hr style={{ border: "none", borderTop: "1.5px solid #000", margin: "6px 0 10px" }} />

      {d.summary && (
        <>
          <h2 style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, margin: "0 0 4px" }}>Summary</h2>
          <hr style={{ border: "none", borderTop: "0.5px solid #000", margin: "0 0 4px" }} />
          <p style={{ margin: "0 0 10px" }}>{d.summary}</p>
        </>
      )}

      {d.education?.length > 0 && (
        <>
          <h2 style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, margin: "0 0 4px" }}>Education</h2>
          <hr style={{ border: "none", borderTop: "0.5px solid #000", margin: "0 0 4px" }} />
          {d.education.map((e, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{e.school}</strong>
                <span>{e.startDate} – {e.endDate || "Present"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontStyle: "italic" }}>
                <span>{e.degree}{e.gpa ? `, GPA: ${e.gpa}` : ""}</span>
                {e.location && <span>{e.location}</span>}
              </div>
            </div>
          ))}
          <div style={{ marginBottom: 10 }} />
        </>
      )}

      {d.experience?.length > 0 && (
        <>
          <h2 style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, margin: "0 0 4px" }}>Experience</h2>
          <hr style={{ border: "none", borderTop: "0.5px solid #000", margin: "0 0 4px" }} />
          {d.experience.map((e, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{e.company}</strong>
                <span>{e.startDate} – {e.endDate || "Present"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontStyle: "italic" }}>
                <span>{e.title}</span>
                {e.location && <span>{e.location}</span>}
              </div>
              <BulletList items={e.bullets} fontSize={10.5} />
            </div>
          ))}
        </>
      )}

      {d.projects?.length > 0 && (
        <>
          <h2 style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, margin: "0 0 4px" }}>Projects</h2>
          <hr style={{ border: "none", borderTop: "0.5px solid #000", margin: "0 0 4px" }} />
          {d.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span><strong>{p.name}</strong>{p.techStack ? ` | ${p.techStack}` : ""}</span>
              </div>
              <BulletList items={p.bullets} fontSize={10.5} />
            </div>
          ))}
        </>
      )}

      {d.skills?.length > 0 && (
        <>
          <h2 style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, margin: "0 0 4px" }}>Technical Skills</h2>
          <hr style={{ border: "none", borderTop: "0.5px solid #000", margin: "0 0 4px" }} />
          <p style={{ margin: 0 }}><strong>Languages & Tools:</strong> {d.skills.join(", ")}</p>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE 7 – Dark Sidebar (Photo, Dark left sidebar)
   ═══════════════════════════════════════════════════════ */
export function DarkSidebarTemplate({ data }) {
  const d = data || {};
  const sidebarBg = "#222a36";
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: "flex", maxWidth: 800, margin: "0 auto", minHeight: 1056, color: "#333", backgroundColor: "#fff" }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: sidebarBg, color: "#fff", padding: "40px 30px", flexShrink: 0 }}>
        {d.photoUrl && (
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <img src={d.photoUrl} alt={d.name} style={{ width: 140, height: 140, borderRadius: "50%", objectFit: "cover", border: "4px solid rgba(255,255,255,0.1)" }} />
          </div>
        )}
        
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px", lineHeight: 1.2 }}>{d.name || "Your Name"}</h1>
        <div style={{ fontSize: 13, color: "#60a5fa", marginBottom: 30 }}>{d.type || "Professional"}</div>

        <div style={{ marginBottom: 30 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 4 }}>Contact</h3>
          <div style={{ fontSize: 10, opacity: 0.9, lineHeight: 1.8 }}>
            {d.phone && <div style={{ display: "flex", gap: 8 }}><span>📞</span> {d.phone}</div>}
            {d.email && <div style={{ display: "flex", gap: 8 }}><span>✉️</span> {d.email}</div>}
            {d.linkedin && <div style={{ display: "flex", gap: 8 }}><span>🔗</span> {d.linkedin}</div>}
            {d.github && <div style={{ display: "flex", gap: 8 }}><span>💻</span> {d.github}</div>}
          </div>
        </div>

        {d.skills?.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 4 }}>Skills</h3>
            <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, opacity: 0.9, lineHeight: 1.8 }}>
              {d.skills.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "40px 36px" }}>
        {d.summary && (
          <div style={{ marginBottom: 30 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Profile</h3>
            <p style={{ fontSize: 11, margin: 0, lineHeight: 1.6, color: "#555" }}>{d.summary}</p>
          </div>
        )}

        {d.experience?.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>Work Experience</h3>
            {d.experience.map((e, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{e.title}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: "#666" }}>{e.company}</div>
                  <div style={{ fontSize: 10, color: "#888", fontStyle: "italic" }}>{e.startDate} – {e.endDate || "Present"}</div>
                </div>
                <BulletList items={e.bullets} />
              </div>
            ))}
          </div>
        )}

        {d.education?.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>Education</h3>
            {d.education.map((e, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{e.degree}</div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 11, color: "#666" }}>{e.school}</div>
                  <div style={{ fontSize: 10, color: "#888", fontStyle: "italic" }}>{e.startDate} – {e.endDate || "Present"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE 8 – Modern Split (Light Blue accents)
   ═══════════════════════════════════════════════════════ */
export function ModernSplitTemplate({ data }) {
  const d = data || {};
  const accent = "#0ea5e9";
  return (
    <div style={{ minHeight: 1056, fontFamily: "'Helvetica Neue', sans-serif", maxWidth: 800, margin: "0 auto", color: "#333", backgroundColor: "#fff", padding: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: accent, margin: "0 0 12px", textTransform: "uppercase" }}>{d.name || "Your Name"}</h1>
          <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6 }}>
            <div>{d.email} • {d.phone}</div>
            <div>{d.linkedin}</div>
          </div>
        </div>
        {d.photoUrl && (
          <img src={d.photoUrl} alt={d.name} style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", marginLeft: 20 }} />
        )}
      </div>

      <div style={{ display: "flex", gap: "30px" }}>
        {/* Left Column */}
        <div style={{ width: 220, flexShrink: 0 }}>
          {d.education?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", borderBottom: `1px solid ${accent}`, paddingBottom: 4, marginBottom: 12 }}>Education</h3>
              {d.education.map((e, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#666" }}>{e.startDate} – {e.endDate || "Present"}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, margin: "2px 0" }}>{e.degree}</div>
                  <div style={{ fontSize: 11 }}>{e.school}</div>
                </div>
              ))}
            </div>
          )}

          {d.skills?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", borderBottom: `1px solid ${accent}`, paddingBottom: 4, marginBottom: 12 }}>Skills</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {d.skills.map((s, i) => (
                  <span key={i} style={{ fontSize: 10, background: "#f0f9ff", color: accent, padding: "2px 8px", borderRadius: 10 }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={{ flex: 1 }}>
          {d.summary && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", borderBottom: `1px solid ${accent}`, paddingBottom: 4, marginBottom: 12 }}>Objective</h3>
              <p style={{ fontSize: 11, margin: 0, lineHeight: 1.6 }}>{d.summary}</p>
            </div>
          )}

          {d.experience?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", borderBottom: `1px solid ${accent}`, paddingBottom: 4, marginBottom: 12 }}>Work History</h3>
              {d.experience.map((e, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ width: 100, fontSize: 10, color: "#666", shrink: 0, paddingTop: 2 }}>
                      {e.startDate} –<br/>{e.endDate || "Present"}
                    </div>
                    <div style={{ flex: 1, borderLeft: "2px solid #e2e8f0", paddingLeft: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: accent, marginBottom: 4 }}>{e.company}</div>
                      <BulletList items={e.bullets} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE 9 – Timeline Minimal (Creative)
   ═══════════════════════════════════════════════════════ */
export function TimelineMinimalTemplate({ data }) {
  const d = data || {};
  return (
    <div style={{ minHeight: 1056, fontFamily: "'Outfit', sans-serif", maxWidth: 800, margin: "0 auto", padding: "40px", color: "#111", backgroundColor: "#fafafa" }}>
      <div style={{ borderBottom: "2px solid #111", paddingBottom: 20, marginBottom: 30, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{d.name || "Your Name"}</h1>
          <div style={{ fontSize: 14, color: "#666", marginTop: 4, fontWeight: 500 }}>{d.type || "Professional"}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 10, lineHeight: 1.6, color: "#555" }}>
          <div>{d.email}</div>
          <div>{d.phone}</div>
          <div>{d.linkedin}</div>
        </div>
      </div>

      {d.summary && (
        <div style={{ marginBottom: 30, padding: "0 20px" }}>
          <p style={{ fontSize: 12, margin: 0, lineHeight: 1.7, fontStyle: "italic", textAlign: "center", color: "#444" }}>"{d.summary}"</p>
        </div>
      )}

      <div style={{ display: "flex", gap: "40px" }}>
        {/* Left Col */}
        <div style={{ flex: 1 }}>
          {d.experience?.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, background: "#111", borderRadius: "50%" }}></span> Work Experience
              </h3>
              <div style={{ paddingLeft: 14, borderLeft: "2px dashed #ddd", marginLeft: 3 }}>
                {d.experience.map((e, i) => (
                  <div key={i} style={{ marginBottom: 20, position: "relative" }}>
                    <div style={{ position: "absolute", width: 10, height: 10, background: "#fff", border: "2px solid #111", borderRadius: "50%", left: -20, top: 4 }}></div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{e.title} @ {e.company}</div>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>{e.startDate} – {e.endDate || "Present"}</div>
                    <BulletList items={e.bullets} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Col */}
        <div style={{ width: 240, flexShrink: 0 }}>
          {d.education?.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, background: "#111", borderRadius: "50%" }}></span> Education
              </h3>
              {d.education.map((e, i) => (
                <div key={i} style={{ marginBottom: 12, paddingLeft: 14, borderLeft: "2px solid #eee", marginLeft: 3 }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{e.degree}</div>
                  <div style={{ fontSize: 10, color: "#555" }}>{e.school}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{e.startDate} – {e.endDate || "Present"}</div>
                </div>
              ))}
            </div>
          )}

          {d.skills?.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, background: "#111", borderRadius: "50%" }}></span> Expertise
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 14, marginLeft: 3 }}>
                {d.skills.map((s, i) => (
                  <div key={i} style={{ fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 4, height: 4, background: "#888", borderRadius: "50%" }}></span> {s}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATE 10 – Creative Tech (Vibrant gradient header)
   ═══════════════════════════════════════════════════════ */
export function CreativeTechTemplate({ data }) {
  const d = data || {};
  return (
    <div style={{ minHeight: 1056, fontFamily: "'Inter', sans-serif", maxWidth: 800, margin: "0 auto", color: "#222", backgroundColor: "#fff" }}>
      {/* Gradient Header */}
      <div style={{ background: "linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)", color: "#fff", padding: "40px", display: "flex", alignItems: "center", gap: 30 }}>
        {d.photoUrl && (
          <img src={d.photoUrl} alt={d.name} style={{ width: 120, height: 120, borderRadius: 20, objectFit: "cover", border: "4px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px", letterSpacing: -1 }}>{d.name || "Your Name"}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", fontSize: 11, opacity: 0.9 }}>
            {d.email && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ opacity: 0.7 }}>@</span> {d.email}</div>}
            {d.phone && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ opacity: 0.7 }}>#</span> {d.phone}</div>}
            {d.linkedin && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ opacity: 0.7 }}>in</span> {d.linkedin.replace('https://linkedin.com/in/', '')}</div>}
            {d.github && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ opacity: 0.7 }}>git</span> {d.github.replace('https://github.com/', '')}</div>}
          </div>
        </div>
      </div>

      <div style={{ padding: "30px 40px" }}>
        {d.summary && (
          <div style={{ marginBottom: 30 }}>
            <p style={{ fontSize: 12, margin: 0, lineHeight: 1.6 }}>{d.summary}</p>
          </div>
        )}

        {d.skills?.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#4f46e5", marginBottom: 12 }}>Core Tech Stack</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {d.skills.map((s, i) => (
                <span key={i} style={{ fontSize: 11, background: "#f3f4f6", color: "#111", padding: "4px 12px", borderRadius: 20, fontWeight: 500 }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 40 }}>
          <div style={{ flex: 2 }}>
            {d.experience?.length > 0 && (
              <div style={{ marginBottom: 30 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#ec4899", marginBottom: 16 }}>Experience</h3>
                {d.experience.map((e, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{e.title}</div>
                        <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 600 }}>{e.company}</div>
                      </div>
                      <div style={{ fontSize: 10, color: "#888", background: "#f9fafb", padding: "2px 8px", borderRadius: 4 }}>
                        {e.startDate} – {e.endDate || "Present"}
                      </div>
                    </div>
                    <BulletList items={e.bullets} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            {d.projects?.length > 0 && (
              <div style={{ marginBottom: 30 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#4f46e5", marginBottom: 16 }}>Key Projects</h3>
                {d.projects.map((p, i) => (
                  <div key={i} style={{ marginBottom: 16, background: "#f8fafc", padding: 12, borderRadius: 8, borderLeft: "3px solid #ec4899" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
                    {p.techStack && <div style={{ fontSize: 9, color: "#666", marginBottom: 6 }}>{p.techStack}</div>}
                    <div style={{ fontSize: 10, lineHeight: 1.5 }}>
                      <ul style={{ margin: 0, paddingLeft: 12 }}>
                        {p.bullets?.slice(0, 2).map((b, j) => <li key={j} style={{ marginBottom: 2 }}>{b}</li>)}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {d.education?.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#ec4899", marginBottom: 16 }}>Education</h3>
                {d.education.map((e, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{e.degree}</div>
                    <div style={{ fontSize: 10, color: "#555" }}>{e.school}</div>
                    <div style={{ fontSize: 9, color: "#888" }}>{e.startDate} – {e.endDate || "Present"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Template registry ─────────────────────────────── */
export const TEMPLATES = [
  { id: "classic",       name: "Classic",       description: "Traditional single-column, serif font",              Component: ClassicTemplate },
  { id: "modern",        name: "Modern",        description: "Two-column with colored sidebar",                    Component: ModernTemplate },
  { id: "minimal",       name: "Minimal",       description: "Ultra clean, light font weights",                    Component: MinimalTemplate },
  { id: "professional",  name: "Professional",  description: "Blue accents, structured layout",                    Component: ProfessionalTemplate },
  { id: "bold",          name: "Bold",          description: "Dark header, strong contrast",                       Component: BoldTemplate },
  { id: "jake",          name: "Jake's (LaTeX)", description: "Dense, LaTeX-inspired, no color",                   Component: JakeTemplate },
  { id: "dark-sidebar",  name: "Dark Sidebar",  description: "Dark sidebar with photo support",                    Component: DarkSidebarTemplate },
  { id: "modern-split",  name: "Modern Split",  description: "Light blue accents, photo, two-column",              Component: ModernSplitTemplate },
  { id: "timeline",      name: "Timeline",      description: "Creative dotted timeline minimal",                   Component: TimelineMinimalTemplate },
  { id: "creative-tech", name: "Creative Tech", description: "Vibrant gradient header, modern blocks",             Component: CreativeTechTemplate },
];
