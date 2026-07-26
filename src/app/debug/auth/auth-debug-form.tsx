"use client";

// TEMPORARY DIAGNOSTIC — see actions.ts in this same directory.

import { useState, useTransition } from "react";
import { runSignInDiagnostic, type SignInDiagnosticResult } from "@/app/debug/auth/actions";

export function AuthDebugForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<SignInDiagnosticResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await runSignInDiagnostic(email, password);
      setResult(r);
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ border: "1px solid #999", padding: 4 }}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ border: "1px solid #999", padding: 4 }}
        />
        <button type="submit" disabled={pending} style={{ border: "1px solid #333", padding: "4px 12px" }}>
          {pending ? "Running…" : "Run signInWithPassword()"}
        </button>
      </form>
      {result && <pre style={{ background: "#f0f0f0", padding: 12, overflowX: "auto" }}>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
