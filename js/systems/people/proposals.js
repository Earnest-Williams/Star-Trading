import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { touchDialogueConversation } from './conversations.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from './dialogueEvents.js';

export const DIALOGUE_PROPOSAL_STATUSES = Object.freeze({
    PROPOSED: 'proposed',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    COMMITTED: 'committed'
});

export const DIALOGUE_PROPOSAL_AUTHORITIES = Object.freeze({
    MEMORY: 'memory',
    DIALOGUE_TASK: 'dialogue_task',
    DIALOGUE_OFFER: 'dialogue_offer',
    MISSION: 'mission',
    RELATIONSHIP: 'relationship'
});

const STATUS_VALUES = Object.values(DIALOGUE_PROPOSAL_STATUSES);
const AUTHORITY_VALUES = Object.values(DIALOGUE_PROPOSAL_AUTHORITIES);

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asNullableString(value) {
    const text = asString(value, '');
    return text.length > 0 ? text : null;
}

function asInteger(value, fallback) {
    if (value === null || typeof value === 'undefined') return fallback;
    const number = Number(value);
    return Number.isInteger(number) ? number : fallback;
}

function currentDialogueTimestamp() {
    const day = asInteger(state.player?.time?.day, 1);
    const minuteOfDay = asInteger(state.player?.time?.minuteOfDay, 0);
    return { day, minuteOfDay, absoluteMinute: (day - 1) * BALANCE.DAY_MINUTES + minuteOfDay };
}

function normaliseTimestamp(value, fallback = null) {
    const source = isObject(value) ? value : {};
    const fallbackSource = isObject(fallback) ? fallback : {};
    return {
        day: asInteger(source.day, asInteger(fallbackSource.day, 1)),
        minuteOfDay: asInteger(source.minuteOfDay, asInteger(fallbackSource.minuteOfDay, 0)),
        absoluteMinute: asInteger(source.absoluteMinute, asInteger(fallbackSource.absoluteMinute, 0))
    };
}

function takeNextId() {
    if (!Number.isInteger(state.nextDialogueProposalId) || state.nextDialogueProposalId < 1) {
        state.nextDialogueProposalId = 1;
    }
    const id = state.nextDialogueProposalId;
    state.nextDialogueProposalId += 1;
    return id;
}

function ensureStorage(target = state) {
    if (!Array.isArray(target.dialogueProposals)) target.dialogueProposals = [];
    if (!Number.isInteger(target.nextDialogueProposalId) || target.nextDialogueProposalId < 1) {
        target.nextDialogueProposalId = 1;
    }
}

function normaliseStatus(value) {
    const status = asString(value, DIALOGUE_PROPOSAL_STATUSES.PROPOSED);
    return STATUS_VALUES.includes(status) ? status : DIALOGUE_PROPOSAL_STATUSES.PROPOSED;
}

function normaliseAuthority(value) {
    const authority = asString(value, DIALOGUE_PROPOSAL_AUTHORITIES.MEMORY);
    return AUTHORITY_VALUES.includes(authority) ? authority : DIALOGUE_PROPOSAL_AUTHORITIES.MEMORY;
}

function nextNumericIdForTable(records) {
    return records.reduce((maxId, record) => Math.max(maxId, asInteger(record?.id, 0)), 0) + 1;
}

function emitProposalEvent(proposal, eventType, extra = {}) {
    const ts = currentDialogueTimestamp();
    touchDialogueConversation(proposal.conversationId, { updatedAt: ts });
    addDialogueEvent({
        eventType,
        sourceSystem: 'dialogue_proposal',
        conversationId: proposal.conversationId,
        partId: proposal.proposalPartId,
        causedBy: { conversationId: proposal.conversationId, partId: proposal.proposalPartId },
        summary: {
            proposalId: proposal.id,
            authority: proposal.authority,
            proposalType: proposal.proposalType,
            status: proposal.status,
            ...extra
        },
        payload: { proposalId: proposal.id, ...extra },
        timestamp: ts
    });
}

export function normaliseDialogueProposal(proposal, fallbackId = 1) {
    const createdAt = normaliseTimestamp(proposal?.createdAt, currentDialogueTimestamp());
    return {
        id: asInteger(proposal?.id, fallbackId),
        conversationId: asString(proposal?.conversationId, 'default'),
        proposalPartId: asInteger(proposal?.proposalPartId, null),
        authority: normaliseAuthority(proposal?.authority),
        proposalType: asString(proposal?.proposalType, 'proposal'),
        status: normaliseStatus(proposal?.status),
        payload: isObject(proposal?.payload) ? proposal.payload : {},
        rejectionReason: asNullableString(proposal?.rejectionReason),
        effectPartId: asInteger(proposal?.effectPartId, null),
        createdAt,
        resolvedAt: isObject(proposal?.resolvedAt) ? normaliseTimestamp(proposal.resolvedAt, createdAt) : null
    };
}

export function normaliseDialogueProposals(target = state) {
    ensureStorage(target);
    target.dialogueProposals = target.dialogueProposals
        .filter(isObject)
        .map((proposal, index) => normaliseDialogueProposal(proposal, index + 1))
        .sort((a, b) => a.createdAt.absoluteMinute - b.createdAt.absoluteMinute || a.id - b.id);
    const nextId = nextNumericIdForTable(target.dialogueProposals);
    if (!Number.isInteger(target.nextDialogueProposalId) || target.nextDialogueProposalId < nextId) {
        target.nextDialogueProposalId = nextId;
    }
}

export function createDialogueProposal({
    conversationId = 'default',
    proposalPartId = null,
    authority = DIALOGUE_PROPOSAL_AUTHORITIES.MEMORY,
    proposalType = 'proposal',
    payload = {}
} = {}) {
    ensureStorage();
    const proposal = normaliseDialogueProposal({
        id: takeNextId(),
        conversationId,
        proposalPartId,
        authority,
        proposalType,
        status: DIALOGUE_PROPOSAL_STATUSES.PROPOSED,
        payload,
        createdAt: currentDialogueTimestamp()
    });
    state.dialogueProposals.push(proposal);
    emitProposalEvent(proposal, DIALOGUE_EVENT_TYPES.DIALOGUE_PROPOSAL_EMITTED);
    return proposal;
}

export function acceptDialogueProposal(proposalId) {
    const proposal = getDialogueProposal(proposalId);
    if (!proposal || proposal.status !== DIALOGUE_PROPOSAL_STATUSES.PROPOSED) return false;
    proposal.status = DIALOGUE_PROPOSAL_STATUSES.ACCEPTED;
    proposal.resolvedAt = currentDialogueTimestamp();
    emitProposalEvent(proposal, DIALOGUE_EVENT_TYPES.DIALOGUE_PROPOSAL_ACCEPTED);
    return proposal;
}

export function rejectDialogueProposal(proposalId, rejectionReason = 'rejected') {
    const proposal = getDialogueProposal(proposalId);
    if (!proposal || proposal.status === DIALOGUE_PROPOSAL_STATUSES.COMMITTED) return false;
    proposal.status = DIALOGUE_PROPOSAL_STATUSES.REJECTED;
    proposal.rejectionReason = asString(rejectionReason, 'rejected');
    proposal.resolvedAt = currentDialogueTimestamp();
    emitProposalEvent(proposal, DIALOGUE_EVENT_TYPES.DIALOGUE_PROPOSAL_REJECTED, { rejectionReason: proposal.rejectionReason });
    return proposal;
}

export function commitDialogueProposal(proposalId, { effectPartId = null, payload = {} } = {}) {
    const proposal = getDialogueProposal(proposalId);
    if (!proposal || proposal.status === DIALOGUE_PROPOSAL_STATUSES.REJECTED) return false;
    proposal.status = DIALOGUE_PROPOSAL_STATUSES.COMMITTED;
    proposal.effectPartId = asInteger(effectPartId, proposal.effectPartId);
    if (isObject(payload)) proposal.payload = { ...proposal.payload, ...payload };
    proposal.resolvedAt = currentDialogueTimestamp();
    emitProposalEvent(proposal, DIALOGUE_EVENT_TYPES.DIALOGUE_PROPOSAL_COMMITTED, { effectPartId: proposal.effectPartId });
    return proposal;
}

export function getDialogueProposal(proposalId) {
    ensureStorage();
    const id = asInteger(proposalId, null);
    return state.dialogueProposals.find(proposal => proposal.id === id) || null;
}

export function getDialogueProposalsByConversationId(conversationId) {
    const safeConversationId = asString(conversationId, '');
    if (safeConversationId.length === 0) return [];
    return (state.dialogueProposals || []).filter(proposal => proposal.conversationId === safeConversationId);
}

export function getDialogueProposalByPartId(partId) {
    const safePartId = asInteger(partId, null);
    if (!Number.isInteger(safePartId)) return null;
    return (state.dialogueProposals || []).find(proposal => proposal.proposalPartId === safePartId) || null;
}
