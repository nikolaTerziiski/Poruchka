import { dirname } from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

/* eslint-config-next is still an eslintrc-style config in Next 15.5 (it ships
 * no `flat` entry point), so FlatCompat translates it. Under pnpm's isolated
 * node_modules the config's own plugins — eslint-plugin-react-hooks,
 * jsx-a11y, @typescript-eslint, … — are NOT hoisted into apps/web, and
 * FlatCompat resolves plugin names from `baseDirectory` by default, so ESLint
 * exits with "couldn't find the plugin eslint-plugin-react-hooks". Pointing
 * `resolvePluginsRelativeTo` at eslint-config-next's own directory resolves
 * them where they actually live, without adding phantom devDependencies. */
const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: dirname(require.resolve("eslint-config-next")),
});

const config = [
  // Flat config auto-ignores only node_modules and .git, so the build output
  // has to be excluded explicitly or `eslint .` lints .next/.
  { ignores: [".next/**", "next-env.d.ts", "tsconfig.tsbuildinfo", "public/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
