import { defineConfig } from "oxlint";

export default defineConfig({
    plugins: ["eslint", "import", "typescript", "oxc"],
    ignorePatterns: ["docs", "lib", "test-ledger", "package-lock.json"],
    options: {
        maxWarnings: 0,
        respectEslintDisableDirectives: true,
    },
    rules: {
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/consistent-type-imports": "error",
        "import/extensions": ["error", "always", { ignorePackages: true }],
    },
    overrides: [
        {
            files: ["examples/**/*", "test/**/*"],
            rules: {
                "import/extensions": "off",
            },
        },
    ],
});
