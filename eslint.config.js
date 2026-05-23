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
            'js/ui/ui.js',
            'js/ui/renderMap.js',
            'js/ui/renderSpreadsheet.js',
            'tests/stateSliceShimGuard.test.js'
        ],
        rules: {
            'no-unused-vars': 'off'
        }
    },

    {
        files: ['js/ui/**/*.js', 'js/app/**/*.js'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [{
                    group: ['../state.js', '../../state.js', './state.js'],
                    message: 'Use js/core/state selectors/mutations instead of direct js/state.js imports.'
                }]
            }]
        }
    },
    {
        files: [
            'js/ui/renderMarket.js',
            'js/ui/renderShipyard.js',
            'js/ui/renderReputation.js',
            'js/ui/economyFocus.js',
            'js/ui/renderCharacterSheet.js',
            'js/ui/renderCaptains.js',
            'js/ui/renderSector.js',
            'js/ui/renderProperty.js',
            'js/ui/onboarding.js',
            'js/ui/renderLogistics.js',
            'js/ui/ui.js',
            'js/ui/renderMap.js',
            'js/ui/shellController.js',
            'js/ui/renderColony.js',
            'js/ui/renderMissions.js',
            'js/ui/renderComms.js',
            'js/ui/renderHUD.js',
            'js/ui/renderer.js',
            'js/app/gameSessionController.js'
        ],
        rules: {
            'no-restricted-imports': 'off'
        }
    },
    {
        files: ['js/ui/ui.js'],
        rules: {
            'no-extra-boolean-cast': 'off'
        }
    }
];
