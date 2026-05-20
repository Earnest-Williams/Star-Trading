import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { createFactionState } from '../js/core/factions.js';
import { resetState, state } from '../js/state.js';
import {
    canLegallyAcceptBounty,
    claimBounty,
    getActiveBounties,
    getRecognizedBountyGuilds,
    issueBounty,
    normalizeBountiesDaily,
    playerHasBounty
} from '../js/new/bounties.js';

function setup() {
    resetState();
    state.universe = {
        1: { id: 1, influence: { sda: 70, fu: 10, hc: 5, colonists: 5, traders: 5, miners: 5 } },
        2: { id: 2, influence: { sda: 5, fu: 45, hc: 30, colonists: 35, traders: 20, miners: 10 } }
    };
    state.ports = {
        1: { factionId: 'sda', publicFactionId: 'sda' },
        2: { factionId: 'fu', publicFactionId: 'fu' }
    };
    state.player = {
        id: 'player',
        credits: 100,
        currentSector: 1,
        time: { day: 3, minuteOfDay: 0 },
        factions: createFactionState(),
        bountyGuilds: {
            memberships: {
                sda_marshal: { rank: 2, duesStatus: 'paid', licenseState: 'active', disciplinaryFlags: [] }
            },
            standings: {},
            activeGuildId: 'sda_marshal'
        }
    };
}

describe('bounty system', () => {
    beforeEach(setup);

    it('defines exactly seven bounty guilds', () => {
        assert.equal(BALANCE.BOUNTY_GUILDS.length, 7);
    });

    it('issues and blocks duplicate active issuer-target-type bounties', () => {
        const issued = issueBounty({
            targetId: 'capt_1',
            targetKind: 'captain',
            type: 'warrant',
            issuedBy: 'sda',
            jurisdictionFactionId: 'sda'
        });
        assert.equal(issued.status, 'active');
        assert.throws(() => issueBounty({
            targetId: 'capt_1',
            targetKind: 'captain',
            type: 'warrant',
            issuedBy: 'sda',
            jurisdictionFactionId: 'sda'
        }));
    });

    it('supports overlapping recognition and membership gating', () => {
        const bounty = issueBounty({
            targetId: 'capt_2',
            targetKind: 'captain',
            type: 'private_contract',
            issuedBy: 'fu',
            jurisdictionFactionId: 'fu',
            recognizedGuildIds: ['sda_marshal', 'free_hands_union']
        });
        const recognized = getRecognizedBountyGuilds(2);
        assert.ok(recognized.includes('free_hands_union'));
        const active = getActiveBounties({ siteId: 2, guildId: 'sda_marshal' });
        assert.equal(active[0].id, bounty.id);
        const blocked = canLegallyAcceptBounty(bounty.id, 'free_hands_union', 2);
        assert.deepEqual(blocked, { ok: false, reasons: ['no_membership'] });
    });

    it('handles political nonrecognition and expiry normalization', () => {
        const bounty = issueBounty({
            targetId: 'capt_3',
            targetKind: 'captain',
            type: 'warrant',
            issuedBy: 'sda',
            jurisdictionFactionId: 'sda',
            expiresDay: 2
        });
        state.player.time.day = 1;
        assert.deepEqual(getActiveBounties({ siteId: 2, guildId: 'sda_marshal' }).map(entry => entry.id), [bounty.id]);
        state.player.time.day = 3;
        assert.deepEqual(canLegallyAcceptBounty(bounty.id, 'sda_marshal', 2), { ok: false, reasons: ['expired'] });
        assert.deepEqual(getActiveBounties({ siteId: 2, guildId: 'sda_marshal' }), []);
        normalizeBountiesDaily();
        assert.equal(state.bounties.byId[bounty.id].status, 'expired');
    });

    it('clears accepted contracts when recognition changes during daily normalization', () => {
        const bounty = issueBounty({
            targetId: 'capt_transit',
            targetKind: 'captain',
            type: 'warrant',
            issuedBy: 'sda',
            jurisdictionFactionId: 'sda'
        });
        state.bounties.byId[bounty.id].acceptedByGuildId = 'sda_marshal';
        state.bounties.byId[bounty.id].acceptedByPlayer = true;
        state.universe[1].influence = {};
        state.ports[1].factionId = 'vc';
        state.ports[1].publicFactionId = 'vc';
        assert.deepEqual(getRecognizedBountyGuilds(1), []);

        normalizeBountiesDaily();

        assert.equal(state.bounties.byId[bounty.id].acceptedByGuildId, null);
        assert.equal(state.bounties.byId[bounty.id].acceptedByPlayer, false);
    });

    it('enforces claim validations and rewards valid claims', () => {
        const bounty = issueBounty({
            targetId: 'capt_4',
            targetKind: 'captain',
            type: 'warrant',
            issuedBy: 'sda',
            jurisdictionFactionId: 'sda'
        });
        assert.equal(claimBounty(bounty.id), false);
        state.bounties.byId[bounty.id].acceptedByGuildId = 'sda_marshal';
        state.bounties.byId[bounty.id].acceptedByPlayer = true;
        const ok = claimBounty(bounty.id, 'defeat');
        assert.equal(ok, true);
        assert.equal(state.bounties.byId[bounty.id].status, 'claimed');
        assert.ok(state.player.credits > 100);
    });

    it('reports expired bounties accurately and filters inactive board entries', () => {
        const expired = issueBounty({
            targetId: 'capt_expired',
            targetKind: 'captain',
            type: 'warrant',
            issuedBy: 'sda',
            jurisdictionFactionId: 'sda',
            expiresDay: 2
        });
        const claimed = issueBounty({
            targetId: 'capt_claimed',
            targetKind: 'captain',
            type: 'warrant',
            issuedBy: 'sda',
            jurisdictionFactionId: 'sda'
        });
        state.bounties.byId[claimed.id].acceptedByGuildId = 'sda_marshal';
        state.bounties.byId[claimed.id].acceptedByPlayer = true;
        assert.equal(claimBounty(claimed.id, 'defeat'), true);

        assert.deepEqual(canLegallyAcceptBounty(expired.id, 'sda_marshal', 1), { ok: false, reasons: ['expired'] });
        assert.deepEqual(canLegallyAcceptBounty(claimed.id, 'sda_marshal', 1), { ok: false, reasons: ['already_claimed'] });
        assert.deepEqual(getActiveBounties({ siteId: 1, guildId: 'sda_marshal' }), []);
    });

    it('derives player bounty status and supports legacy save normalization', () => {
        state.bounties = null;
        assert.equal(playerHasBounty(), false);
        issueBounty({
            targetId: 'player',
            targetKind: 'player',
            type: 'warrant',
            issuedBy: 'sda',
            jurisdictionFactionId: 'sda'
        });
        assert.equal(playerHasBounty(), true);
    });

    it('uses nextId normalization to avoid reusing legacy bounty ids', () => {
        state.bounties = {
            byId: {
                bounty_2: {
                    id: 'bounty_2',
                    targetId: 'legacy_a',
                    targetKind: 'captain',
                    type: 'warrant',
                    issuedBy: 'sda',
                    jurisdictionFactionId: 'sda',
                    status: 'claimed',
                    expiresDay: 6
                },
                bounty_7: {
                    id: 'bounty_7',
                    targetId: 'legacy_b',
                    targetKind: 'captain',
                    type: 'warrant',
                    issuedBy: 'fu',
                    jurisdictionFactionId: 'fu',
                    status: 'active',
                    expiresDay: 9
                }
            },
            allIds: ['bounty_2', 'bounty_7']
        };

        const bounty = issueBounty({
            targetId: 'capt_legacy',
            targetKind: 'captain',
            type: 'private_contract',
            issuedBy: 'hc',
            jurisdictionFactionId: 'hc'
        });

        assert.equal(bounty.id, 'bounty_8');
        assert.equal(state.bounties.nextId, 9);
    });
});
