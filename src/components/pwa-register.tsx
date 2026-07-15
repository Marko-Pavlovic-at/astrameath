"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so Astrameath is installable and works offline.
 * Production only — a SW would fight HMR in dev. Registers after load so it never
 * competes with the first paint. No state, so it's clear of the lint rules.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    const register = () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
