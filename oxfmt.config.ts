import solanaConfig from '@solana-config/oxc/oxfmt';
import { defineConfig } from 'oxfmt';

export default defineConfig({
    ...solanaConfig,
    arrowParens: 'avoid',
    bracketSameLine: false,
    bracketSpacing: true,
    jsxSingleQuote: false,
    overrides: [
        {
            files: ['*.yaml', '*.yml'],
            options: {
                tabWidth: 2,
            },
        },
    ],
    printWidth: 120,
    quoteProps: 'as-needed',
    semi: true,
    singleQuote: true,
    sortPackageJson: false,
    tabWidth: 4,
    useTabs: false,
});
