import { createConfigForNuxt } from "@nuxt/eslint-config/flat";
import prettier from "eslint-config-prettier";

export default createConfigForNuxt({
  features: { typescript: true },
})
  .append({
    ignores: ["archive/**", "drizzle/**", "public/**", "data/fixtures/**"],
  })
  .append({
    files: ["**/*.ts", "**/*.vue"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  })
  .append({
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/no-multiple-template-root": "off",
      "no-console": "off",
      "vue/require-default-prop": "off",
      "@typescript-eslint/no-import-type-side-effects": "off",
    },
  })
  .append(prettier);
