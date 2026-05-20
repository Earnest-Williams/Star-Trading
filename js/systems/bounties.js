import { BALANCE } from '../constants.js';
import { addFactionRep } from '../core/factions.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { state } from '../state.js';

function getCurrentDay() {
    return state.player?.time?.day || 1;
}

function ensureBountyState() {
    if (!state.bounties || typeof state.bounties !== 'object') {
        state.bounties = { byId: {}, allIds: [] };
    }
    if (!state.bounties.byId || typeof state.bounties.byId !== 'object') {
        state.bounties.byId = {};
    }
    if (!Array.isArray(state.bounties.allIds)) {
        state.bounties.allIds = [];
    }
    if (!state.player) return;
    if (!state.player.bountyGuilds || typeof state.player.bountyGuilds !== 'object') {
        state.player.bountyGuilds = {};
    }
    const guildState = state.player.bountyGuilds;
    if (!guildState.memberships || typeof guildState.memberships !== 'object') {
        guildState.memberships = {};
    }
    if (!guildState.standings || typeof guildState.standings !== 'object') {
        guildState.standings = {};
    }
    if (!guildState.activeGuildId) {
        guildState.activeGuildId = null;
    }
}

export function getRecognizedBountyGuilds(siteId) {
    const site = state.ports?.[siteId];
    const sector = state.universe?.[siteId];
    const stationFactionId = site?.factionId || site?.publicFactionId || null;
    const influence = sector?.influence || {};
    const profile = BALANCE.BOUNTY_GUILDS;
    return profile.filter(guild => {
        if (guild.defaultRecognitionProfile.includes(stationFactionId)) return true;
        return guild.sponsorFactionIds.some(id => (influence[id] || 0) >= 30);
    }).map(guild => guild.id);
}

export function canLegallyAcceptBounty(bountyId, guildId, siteId) {
    ensureBountyState();
    const bounty = state.bounties.byId[bountyId];
    if (!bounty) return { ok: false, reasons: ['unknown_bounty'] };
    if (bounty.status !== 'active') return { ok: false, reasons: ['already_claimed'] };
    if (bounty.expiresDay < getCurrentDay()) return { ok: false, reasons: ['expired'] };
    const membership = state.player?.bountyGuilds?.memberships?.[guildId];
    if (!membership || membership.licenseState !== 'active') {
        return { ok: false, reasons: ['no_membership'] };
    }
    const recognized = getRecognizedBountyGuilds(siteId);
    if (!recognized.includes(guildId) || !bounty.recognizedGuildIds.includes(guildId)) {
        return { ok: false, reasons: ['guild_not_recognized'] };
    }
    if ((membership.rank || 0) < (bounty.requiredGuildTier || 1)) {
        return { ok: false, reasons: ['insufficient_tier'] };
    }
    return { ok: true, reasons: [] };
}

export function issueBounty(def) {
    ensureBountyState();
    const required = ['targetId', 'targetKind', 'type', 'issuedBy', 'jurisdictionFactionId'];
    for (const field of required) {
        if (!def || !def[field]) throw new Error(`Missing required bounty field: ${field}`);
    }
    for (const id of state.bounties.allIds) {
        const existing = state.bounties.byId[id];
        if (!existing) continue;
        if (existing.status === 'active' && existing.targetId === def.targetId && existing.type === def.type
            && existing.issuedBy === def.issuedBy) {
            throw new Error('Duplicate active bounty for issuer-target-type');
        }
    }
    const id = `bounty_${state.bounties.allIds.length + 1}`;
    const createdDay = getCurrentDay();
    const expiresDay = def.expiresDay || (createdDay + BALANCE.BOUNTIES.EXPIRY_DEFAULT_DAYS);
    const knownSiteId = def.knownSiteId || state.player?.currentSector || null;
    const recognizedGuildIds = def.recognizedGuildIds || getRecognizedBountyGuilds(knownSiteId);
    const bounty = {
        id,
        targetId: def.targetId,
        targetKind: def.targetKind,
        type: def.type,
        issuedBy: def.issuedBy,
        jurisdictionFactionId: def.jurisdictionFactionId,
        reward: Math.max(def.reward || 0, BALANCE.BOUNTIES.REWARD_FLOOR),
        status: 'active',
        createdDay,
        expiresDay,
        knownSiteId,
        visibility: def.visibility || 'public',
        recognizedGuildIds,
        requiredGuildTier: def.requiredGuildTier || 1,
        acceptedByGuildId: null,
        acceptedByPlayer: false,
        allowedResolutions: def.allowedResolutions || ['defeat', 'capture'],
        resolution: null,
        payload: def.payload || {}
    };
    state.bounties.byId[id] = bounty;
    state.bounties.allIds.push(id);
    addWorldEvent({
        type: 'bounty_issued',
        text: `Bounty posted: ${bounty.type}`,
        importance: 2,
        payload: { bountyId: id, targetId: bounty.targetId, issuedBy: bounty.issuedBy }
    });
    return bounty;
}

export function getActiveBounties(context = {}) {
    ensureBountyState();
    const siteId = context.siteId || state.player?.currentSector;
    const guildId = context.guildId || state.player?.bountyGuilds?.activeGuildId || null;
    return state.bounties.allIds.map(id => state.bounties.byId[id]).filter(Boolean).map(bounty => {
        const eligibility = canLegallyAcceptBounty(bounty.id, guildId, siteId);
        if (bounty.expiresDay < getCurrentDay()) {
            return { ...bounty, eligibility: { ok: false, reasons: ['expired'] } };
        }
        return { ...bounty, eligibility };
    });
}

export function claimBounty(id, resolution = 'defeat') {
    ensureBountyState();
    const bounty = state.bounties.byId[id];
    if (!bounty) return false;
    if (bounty.status !== 'active') return false;
    const guildId = bounty.acceptedByGuildId || state.player?.bountyGuilds?.activeGuildId;
    const legal = canLegallyAcceptBounty(id, guildId, state.player?.currentSector);
    if (!legal.ok) return false;
    if (!bounty.acceptedByPlayer) return false;
    if (!bounty.allowedResolutions.includes(resolution)) return false;
    bounty.status = 'claimed';
    bounty.resolution = resolution;
    state.player.credits = (state.player.credits || 0) + bounty.reward;
    addFactionRep(bounty.jurisdictionFactionId, BALANCE.BOUNTIES.CLAIM_REP_GAIN, 'bounty claim');
    addWorldEvent({
        type: 'bounty_claimed',
        text: `Bounty claimed: ${bounty.type}`,
        importance: 3,
        payload: { bountyId: id, reward: bounty.reward, resolution }
    });
    return true;
}

export function playerHasBounty() {
    ensureBountyState();
    const playerId = state.player?.id || 'player';
    return state.bounties.allIds.some(id => {
        const bounty = state.bounties.byId[id];
        return bounty && bounty.targetId === playerId && bounty.status === 'active' && bounty.expiresDay >= getCurrentDay();
    });
}

export function normalizeBountiesDaily() {
    ensureBountyState();
    const recognized = getRecognizedBountyGuilds(state.player?.currentSector);
    for (const id of state.bounties.allIds) {
        const bounty = state.bounties.byId[id];
        if (!bounty || bounty.status !== 'active') continue;
        if (bounty.expiresDay < getCurrentDay()) {
            bounty.status = 'expired';
            continue;
        }
        if (bounty.acceptedByGuildId && !recognized.includes(bounty.acceptedByGuildId)) {
            bounty.acceptedByGuildId = null;
            bounty.acceptedByPlayer = false;
        }
    }
}
