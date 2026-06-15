// Next 16's eslint-config-next ships native flat configs; import directly
// rather than via FlatCompat (the legacy compat layer hits a circular-ref
// error with the v16 plugin).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    // `next lint` auto-ignored build output; running the ESLint CLI directly
    // (Next 16 removed `next lint`) means we declare these ourselves.
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "convex/_generated/**",
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // New in eslint-config-next 16 (React Compiler era). Flags pre-existing
      // client-hydration / lazy-init effects (e.g. `setMounted(true)` SSR
      // guards). Downgraded to `warn` so the Next 16 upgrade lands without
      // bundling a behavioral refactor of 9 call sites — tracked as follow-up.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
