import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        files: ['js/**/*.js', 'tests/**/*.js']
    }
];
