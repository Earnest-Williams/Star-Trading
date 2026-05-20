import { BALANCE } from '../constants.js';
import { addFactionRep } from '../core/factions.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { state } from '../state.js';

function getCurrentDay() {
    return state.player?.time?.day || 1;
}

function ensureBountyState() {
    if (!state.bounties || typeof state.bounties !== 'object') {
        state.bounties = { byId: {}, allIds: [], nextId: 1 };
    }
    if (!state.bounties.byId || typeof state.bounties.byId !== 'object') state.bounties.byId = {};
    if (!Array.isArray(state.bounties.allIds)) state.bounties.allIds = [];
    if (!Number.isInteger(state.bounties.nextId) || state.bounties.nextId < 1) {
        const maxExistingId = state.bounties.allIds.reduce((maxId, id) => {
            const prefix = 'bounty_';
            if (!id.startsWith(prefix)) return maxId;
            const suffix = id.slice(prefix.length);
            if (!/^\d+$/.test(suffix)) return maxId;
            return Math.max(maxId, Number.parseInt(suffix, 10));
        }, 0);
        state.bounties.nextId = maxExistingId + 1;
    }
    if (!state.player) return;
    if (!state.player.bountyGuilds || typeof state.player.bountyGuilds !== 'object') state.player.bountyGuilds = {};
    const guildState = state.player.bountyGuilds;
    if (!guildState.memberships || typeof guildState.memberships !== 'object') guildState.memberships = {};
    if (!guildState.standings || typeof guildState.standings !== 'object') guildState.standings = {};
    if (!Object.hasOwn(guildState, 'activeGuildId')) guildState.activeGuildId = null;
}

export function getRecognizedBountyGuilds(siteId) {
    const site = state.ports?.[siteId];
    const sector = state.universe?.[siteId];
    if (!site || !sector) return [];
    const jurisdictionFactionId = site?.factionId || site?.publicFactionId || null;
    const influence = sector?.influence || {};
    return BALANCE.BOUNTY_GUILDS.filter(guild => {
        const explicit = Array.isArray(site.bountyGuildOverrides) ? site.bountyGuildOverrides : [];
        if (explicit.includes(guild.id)) return true;
        if (guild.defaultRecognitionProfile.includes(jurisdictionFactionId)) return true;
        return guild.sponsorFactionIds.some(id => (influence[id] || 0) >= BALANCE.BOUNTIES.HUNTER_PRESSURE_HEAT_THRESHOLD);
    }).map(guild => guild.id);
}

export function canLegallyAcceptBounty(bountyId, guildId, siteId) {
    ensureBountyState();
    const bounty = state.bounties.byId[bountyId];
    if (!bounty) return { ok: false, reasons: ['unknown_bounty'] };
    if (bounty.status === 'claimed') return { ok: false, reasons: ['already_claimed'] };
    if (bounty.status === 'expired' || bounty.expiresDay < getCurrentDay()) return { ok: false, reasons: ['expired'] };
    if (bounty.status !== 'active') return { ok: false, reasons: ['unavailable'] };
    if (!guildId) return { ok: false, reasons: ['no_membership'] };
    const membership = state.player?.bountyGuilds?.memberships?.[guildId];
    if (!membership || membership.licenseState !== 'active' || membership.duesStatus !== 'paid') {
        return { ok: false, reasons: ['no_membership'] };
    }
    const recognized = getRecognizedBountyGuilds(siteId);
    if (!recognized.length) return { ok: false, reasons: ['unavailable_jurisdiction'] };
    if (!recognized.includes(guildId) || !bounty.recognizedGuildIds.includes(guildId)) {
        return { ok: false, reasons: ['guild_not_recognized'] };
    }
    if ((membership.rank || 0) < (bounty.requiredGuildTier || 1)) return { ok: false, reasons: ['insufficient_tier'] };
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
        if (existing.status === 'active' && existing.targetId === def.targetId && existing.type === def.type && existing.issuedBy === def.issuedBy) {
            throw new Error('Duplicate active bounty for issuer-target-type');
        }
    }
    const id = `bounty_${state.bounties.nextId}`;
    if (state.bounties.byId[id]) throw new Error(`Bounty id collision for ${id}`);
    state.bounties.nextId += 1;
    const createdDay = getCurrentDay();
    const expirySpan = Math.max(BALANCE.BOUNTIES.EXPIRY_MIN_DAYS, Math.min(BALANCE.BOUNTIES.EXPIRY_DEFAULT_DAYS, BALANCE.BOUNTIES.EXPIRY_MAX_DAYS));
    const expiresDay = def.expiresDay || (createdDay + expirySpan);
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
    return state.bounties.allIds
        .map(id => state.bounties.byId[id])
        .filter(bounty => bounty && bounty.status === 'active')
        .filter(bounty => bounty.expiresDay >= getCurrentDay())
        .map(bounty => ({ ...bounty, eligibility: canLegallyAcceptBounty(bounty.id, guildId, siteId) }));
}

export function claimBounty(id, resolution = 'defeat') {
    ensureBountyState();
    const bounty = state.bounties.byId[id];
    if (!bounty || bounty.status !== 'active') return false;
    const guildId = bounty.acceptedByGuildId || state.player?.bountyGuilds?.activeGuildId;
    const legal = canLegallyAcceptBounty(id, guildId, state.player?.currentSector);
    if (!legal.ok || !bounty.acceptedByPlayer || !bounty.allowedResolutions.includes(resolution)) return false;
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
    for (const id of state.bounties.allIds) {
        const bounty = state.bounties.byId[id];
        if (!bounty || bounty.status !== 'active') continue;
        if (bounty.expiresDay < getCurrentDay()) {
            bounty.status = 'expired';
            continue;
        }
        if (!bounty.acceptedByGuildId) continue;
        const recognized = getRecognizedBountyGuilds(bounty.knownSiteId);
        if (!recognized.includes(bounty.acceptedByGuildId)) {
            bounty.acceptedByGuildId = null;
            bounty.acceptedByPlayer = false;
        }
    }
}
