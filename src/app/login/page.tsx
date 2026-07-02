"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-light uppercase tracking-[0.35em] text-accent">
          Astrameath
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          The ascent begins.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-10 space-y-4 rounded-lg border border-edge bg-panel p-6"
        >
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent"
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded border border-accent/40 bg-panel-2 py-2 text-sm uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {loading ? "Entering…" : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}
