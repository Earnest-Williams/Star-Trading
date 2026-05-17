import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { NPC_FINDABLE_PART_DEFS } from '../js/constants.js';
import * as broadTextStrings from '../js/systems/people/dialogueBroadTextStrings.js';
import * as relationshipTextStrings from '../js/systems/people/dialogueRelationshipTextStrings.js';
import * as textStrings from '../js/systems/people/dialogueTextStrings.js';
import {
    DIALOGUE_PROMPT_TEMPLATE_BANKS,
    DIALOGUE_REGISTERS,
    DIALOGUE_TEMPLATE_BANKS
} from '../js/systems/people.js';

const TEMPLATE_BANK_MODULES = Object.freeze([
    textStrings,
    broadTextStrings,
    relationshipTextStrings
]);

function getExportedTemplateBanks() {
    return TEMPLATE_BANK_MODULES.flatMap(moduleExports => Object.entries(moduleExports))
        .filter(([name]) => name.includes('TEMPLATE_BANKS'));
}

function walkTemplateStrings(value, visit, path = []) {
    if (Array.isArray(value)) {
        value.forEach(template => visit(template, path));
        return;
    }

    Object.entries(value).forEach(([key, childValue]) => {
        walkTemplateStrings(childValue, visit, path.concat(key));
    });
}

function assertLeafArraysOnly(value, path = []) {
    assert.equal(
        value !== null && typeof value === 'object',
        true,
        `${path.join('.')} should be an object tree or string array`
    );

    if (Array.isArray(value)) {
        value.forEach((template, index) => {
            assert.equal(
                typeof template,
                'string',
                `${path.concat(String(index)).join('.')} should be a string`
            );
        });
        return;
    }

    Object.entries(value).forEach(([key, childValue]) => {
        assertLeafArraysOnly(childValue, path.concat(key));
    });
}

function assertWorkNeutralFallbacks(bank, intent) {
    Object.entries(bank[intent]).forEach(([state, stateBank]) => {
        const fallbackLines = stateBank[DIALOGUE_REGISTERS.WORK]?.neutral;
        assert.equal(
            Array.isArray(fallbackLines) && fallbackLines.length > 0,
            true,
            `${intent}.${state} needs at least one work.neutral fallback`
        );
    });
}

function assertPersonalBucketsHavePlainTone(value, path = []) {
    if (Array.isArray(value)) {
        return;
    }

    Object.entries(value).forEach(([key, childValue]) => {
        const childPath = path.concat(key);
        if (key === DIALOGUE_REGISTERS.PERSONAL) {
            const neutralLines = childValue.neutral;
            const warmLines = childValue.warm;
            assert.equal(
                (Array.isArray(neutralLines) && neutralLines.length > 0)
                    || (Array.isArray(warmLines) && warmLines.length > 0),
                true,
                `${childPath.join('.')} needs a neutral or warm tone line`
            );
        }
        assertPersonalBucketsHavePlainTone(childValue, childPath);
    });
}

describe('dialogue text coverage', () => {
    it('keeps exported template banks as object trees with arrays only at leaves', () => {
        getExportedTemplateBanks().forEach(([name, bank]) => {
            assertLeafArraysOnly(bank, [name]);
        });
    });

    it('keeps every template string non-empty', () => {
        getExportedTemplateBanks().forEach(([name, bank]) => {
            walkTemplateStrings(bank, (template, path) => {
                assert.notEqual(template.trim(), '', `${name}.${path.join('.')} is empty`);
            });
        });
    });

    it('uses {itemLabel} instead of hardcoded item names in locate-item templates', () => {
        const itemLabels = Object.values(NPC_FINDABLE_PART_DEFS).map(definition => definition.label.toLowerCase());
        const locateBanks = Object.freeze([
            DIALOGUE_TEMPLATE_BANKS.request_locate_item,
            DIALOGUE_TEMPLATE_BANKS.check_back_locate_item,
            DIALOGUE_PROMPT_TEMPLATE_BANKS.request_locate_item,
            DIALOGUE_PROMPT_TEMPLATE_BANKS.check_back_locate_item
        ]);

        locateBanks.forEach(bank => {
            walkTemplateStrings(bank, (template, path) => {
                const lowerTemplate = template.toLowerCase();
                itemLabels.forEach(label => {
                    assert.equal(
                        lowerTemplate.includes(label) && !template.includes('{itemLabel}'),
                        false,
                        `${path.join('.')} hardcodes ${label}`
                    );
                });
            });
        });
    });

    it('provides work.neutral fallbacks for locate-item request and check-back states', () => {
        assertWorkNeutralFallbacks(DIALOGUE_TEMPLATE_BANKS, 'request_locate_item');
        assertWorkNeutralFallbacks(DIALOGUE_TEMPLATE_BANKS, 'check_back_locate_item');
        assertWorkNeutralFallbacks(DIALOGUE_PROMPT_TEMPLATE_BANKS, 'request_locate_item');
        assertWorkNeutralFallbacks(DIALOGUE_PROMPT_TEMPLATE_BANKS, 'check_back_locate_item');
    });

    it('keeps every personal register bucket reachable through neutral or warm tones', () => {
        getExportedTemplateBanks().forEach(([name, bank]) => {
            assertPersonalBucketsHavePlainTone(bank, [name]);
        });
    });
});
