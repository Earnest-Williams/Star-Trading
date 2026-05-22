import js from "@eslint/js";

const sharedGlobals = {
    globalThis: 'readonly',
    console: 'readonly',
    process: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    URL: 'readonly'
};

const browserGlobals = {
    ...sharedGlobals,
    window: 'readonly',
    document: 'readonly',
    navigator: 'readonly',
    localStorage: 'readonly',
    CSS: 'readonly',
    FileReader: 'readonly'
};

export default [
    js.configs.recommended,
    {
        files: ['js/**/*.js', 'tests/**/*.js'],
        languageOptions: {
            globals: browserGlobals
        },
        rules: {
            'no-unused-vars': 'off',
            'no-dupe-keys': 'off',
            'no-extra-boolean-cast': 'off'
        }
    }
];
