import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: false,
        include: ['**/*.test.ts'],
        pool: 'forks',
        fileParallelism: false,
        testTimeout: 120_000,
        hookTimeout: 120_000,
    },
});
