import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { DEFAULT_BUILD_SPEC } from '../js/config/chargen.js';
import { isPlatformEmployed, validateBuild } from '../js/core/characterBuild.js';
import { setChargenBuild, setRandomValidBuild } from '../js/ui/chargenState.js';

describe('chargen random build generation', () => {
    beforeEach(() => {
        setChargenBuild(DEFAULT_BUILD_SPEC);
    });

    it('constructs valid builds while respecting employer lane rules', () => {
        for (let attempt = 0; attempt < 40; attempt++) {
            const build = setRandomValidBuild();
            assert.equal(validateBuild(build).valid, true);
            if (isPlatformEmployed(build.platform.type)) {
                assert.ok(build.platform.employerLaneId);
            } else {
                assert.equal(build.platform.employerLaneId, null);
            }
        }
    });
});
