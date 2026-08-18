import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.{test,spec}.ts'],
        exclude: ['dist/**', 'node_modules/**', 'tmp/**'],
        environment: 'node',
        fileParallelism: false,
        pool: 'forks',
        poolOptions: { forks: { singleFork: true } },
    },
});
