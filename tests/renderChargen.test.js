import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ARCHETYPE_PRESETS, DEFAULT_BUILD_SPEC } from '../js/config/chargen.js';
import { setChargenBuild } from '../js/ui/chargenState.js';
import { renderChargenControls } from '../js/ui/renderChargen.js';

describe('renderChargenControls', () => {
    it('marks matching archetype preset as selected', () => {
        const [presetId, preset] = Object.entries(ARCHETYPE_PRESETS)[0];
        setChargenBuild(preset.build);
        const html = renderChargenControls();
        assert.match(html, new RegExp(`<option value="${presetId}" selected>`));
        assert.doesNotMatch(html, /<option value="" selected>Custom<\/option>/);
    });

    it('renders detailed mechanical preview output', () => {
        setChargenBuild(DEFAULT_BUILD_SPEC);
        const html = renderChargenControls();
        assert.match(html, /Mechanical preview:.*?Cash delta/i);
        assert.match(html, /holds \d+/i);
    });
});
