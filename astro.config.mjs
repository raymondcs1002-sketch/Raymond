import { defineConfig, envField } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  env: {
    schema: {
      // Supabase (service role — server only, never sent to the browser)
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // Supabase anon key — this one IS meant to be public. It's sent to the
      // browser so it can upload KYC files directly to Storage using the
      // short-lived signed upload URLs the server creates (the service role
      // key never leaves the server). Safe to expose; protected by RLS.
      PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: "client", access: "public", optional: true, default: "" }),

      // Email notifications (Resend)
      RESEND_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      NOTIFY_FROM_EMAIL: envField.string({ context: "server", access: "secret", optional: true }),

      // Salt used to hash IPs for rate limiting (never store raw IPs)
      IP_HASH_SALT: envField.string({ context: "server", access: "secret", optional: true, default: "dev-salt-change-me" }),

      // Vercel Global Config connection string (auto-set when a store is
      // connected to the project; GLOBAL_CONFIG is the current name, but a
      // store connected before the 2026-07-29 rename sets the legacy
      // EDGE_CONFIG name instead — we accept both). Declared here (rather
      // than read via bare process.env) so `astro dev` actually loads it
      // from .env/.env.local — undeclared vars aren't injected in dev.
      GLOBAL_CONFIG: envField.string({ context: "server", access: "secret", optional: true }),
      EDGE_CONFIG: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
