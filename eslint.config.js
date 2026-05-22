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
        }
    },
    {
        files: ['js/config/skillTrees.js', 'js/config/traits.js'],
        rules: {
            'no-dupe-keys': 'off'
        }
    },
    {
        files: [
            'js/systems/captains/implementation.js',
            'js/systems/companies.js',
            'js/systems/economy/marketIntelligence.js',
            'js/systems/market.js',
            'js/systems/tradeRoutes/implementation.js',
            'js/ui/renderLogistics.js',
            'js/ui/renderSpreadsheet.js',
            'tests/stateSliceShimGuard.test.js'
        ],
        rules: {
            'no-unused-vars': 'off'
        }
    },
    {
        files: ['js/ui/ui.js'],
        rules: {
            'no-extra-boolean-cast': 'off'
        }
    }
];
