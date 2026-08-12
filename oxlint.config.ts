import solanaConfig from '@solana-config/oxc/oxlint';
import { defineConfig } from 'oxlint';

export default defineConfig({
    extends: [solanaConfig],
    ignorePatterns: ['docs', 'lib', 'test-ledger', 'package-lock.json'],
    options: {
        maxWarnings: 0,
        respectEslintDisableDirectives: true,
    },
    overrides: [
        {
            files: ['examples/**/*', 'test/**/*'],
            rules: {
                'import/extensions': 'off',
            },
        },
    ],
    plugins: ['eslint', 'import', 'typescript', 'oxc'],
    rules: {
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'import/extensions': ['error', 'always', { ignorePackages: true }],
    },
});
