import { useEffect, useMemo, useState } from "react";

type PatientRow = {
  id?: string | number;
  pid?: string | number;
  fname?: string;
  lname?: string;
  DOB?: string;
  sex?: string;
};

function normalizePatients(payload: any): PatientRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.patients)) return payload.patients;
  if (Array.isArray(payload.result)) return payload.result;
  if (Array.isArray(payload.results)) return payload.results;

  for (const key of Object.keys(payload)) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");

export default function App() {
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // form state
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [dob, setDob] = useState("1990-01-01");
  const [sex, setSex] = useState<"Male" | "Female" | "Other">("Male");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const patients = useMemo(() => normalizePatients(payload), [payload]);

  async function loadPatients() {
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/patients`);
      const d = await r.json();
      if (!r.ok) {
        throw new Error(d?.error ? JSON.stringify(d, null, 2) : "Failed to load patients");
      }
      setPayload(d);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatients();
  }, []);

  async function addPatient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaveMsg("");
    setSaving(true);

    try {
      const r = await fetch(`${API_BASE}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fname: fname.trim(),
          lname: lname.trim(),
          DOB: dob,
          sex,
        }),
      });

      const d = await r.json();
      if (!r.ok) {
        throw new Error(d?.error ? JSON.stringify(d, null, 2) : "Failed to create patient");
      }

      setSaveMsg("Patient created ✅");
      setFname("");
      setLname("");
      await loadPatients();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #e8f1ff 0%, #f3f7ff 40%, #f8fbff 100%)",
        padding: 20,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          width: "min(960px, 100%)",
          background: "#ffffff",
          border: "1px solid #dbe7ff",
          borderRadius: 16,
          boxShadow: "0 12px 28px rgba(30, 58, 138, 0.08)",
          padding: 24,
        }}
      >
      <h1 style={{ marginTop: 0, marginBottom: 20, fontSize: "clamp(1.6rem, 2.4vw, 2.1rem)" }}>OpenEMR Patients</h1>

      {/* Add Patient */}
      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 10, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Add patient</h2>

        <form onSubmit={addPatient} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div>
              <label>First name</label>
              <input
                value={fname}
                onChange={(e) => setFname(e.target.value)}
                style={{ width: "100%", padding: 8 }}
                required
              />
            </div>
            <div>
              <label>Last name</label>
              <input
                value={lname}
                onChange={(e) => setLname(e.target.value)}
                style={{ width: "100%", padding: 8 }}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div>
              <label>DOB</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                style={{ width: "100%", padding: 8 }}
                required
              />
            </div>
            <div>
              <label>Sex</label>
              <select value={sex} onChange={(e) => setSex(e.target.value as any)} style={{ width: "100%", padding: 8 }}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" disabled={saving} style={{ padding: "8px 14px" }}>
              {saving ? "Saving..." : "Add"}
            </button>
            <button type="button" onClick={loadPatients} disabled={loading} style={{ padding: "8px 14px" }}>
              Refresh
            </button>
            {saveMsg && <span>{saveMsg}</span>}
          </div>
        </form>
      </div>

      {/* Status */}
      {loading && <p>Loading…</p>}
      {error && (
        <pre style={{ background: "#fff3f3", border: "1px solid #f2c0c0", padding: 12, borderRadius: 8, overflowX: "auto" }}>
          {error}
        </pre>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <p style={{ opacity: 0.8 }}>Found: {patients.length}</p>

          <div style={{ width: "100%", overflowX: "auto" }}>
          <table cellPadding={10} style={{ borderCollapse: "collapse", width: "100%", minWidth: 620, border: "1px solid #ddd" }}>
            <thead>
              <tr style={{ background: "#f6f6f6" }}>
                <th align="left">PID</th>
                <th align="left">Name</th>
                <th align="left">DOB</th>
                <th align="left">Sex</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, idx) => (
                <tr key={String(p.pid ?? p.id ?? idx)} style={{ borderTop: "1px solid #eee" }}>
                  <td>{p.pid ?? p.id ?? "-"}</td>
                  <td>{`${p.fname ?? ""} ${p.lname ?? ""}`.trim() || "-"}</td>
                  <td>{p.DOB ?? "-"}</td>
                  <td>{p.sex ?? "-"}</td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 16 }}>
                    No patients returned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* <details style={{ marginTop: 16 }}>
            <summary>Raw response (debug)</summary>
            <pre style={{ background: "#f6f6f6", padding: 16, borderRadius: 8, overflowX: "auto" }}>
              {JSON.stringify(payload, null, 2)}
            </pre>
          </details> */}
        </>
      )}
      </div>
    </div>
  );
}
