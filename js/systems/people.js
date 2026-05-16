import { state } from '../state.js';
import { PERSON_NAME_PARTS, PERSON_ROLES, PERSON_SERVICES_BY_ROLE } from '../config/people.js';
import { dialogueProfileForRole } from './people/dialogueVoice.js';

function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
}

export function resetPeopleState() {
    state.people = {};
    state.peopleBySector = {};
    state.peopleByCompany = {};
    state.nextPersonId = 1;
}

export function createGeneratedPerson({ role, sectorId, companyId = null, polityId = null, factionId }, rng) {
    const id = `person-${state.nextPersonId++}`;
    const safeRole = PERSON_ROLES.includes(role) ? role : 'factor';
    const person = {
        id,
        name: `${pick(PERSON_NAME_PARTS.given, rng)} ${pick(PERSON_NAME_PARTS.family, rng)}`,
        role: safeRole,
        sectorId,
        companyId,
        polityId,
        factionId,
        relationship: 0,
        trust: 0,
        leverage: 0,
        known: false,
        services: (PERSON_SERVICES_BY_ROLE[safeRole] || PERSON_SERVICES_BY_ROLE.factor).slice(),
        dialogueProfile: dialogueProfileForRole(safeRole, { stableSeed: id })
    };
    state.people[id] = person;
    if (!state.peopleBySector[sectorId]) state.peopleBySector[sectorId] = [];
    state.peopleBySector[sectorId].push(id);
    if (companyId) {
        if (!state.peopleByCompany[companyId]) state.peopleByCompany[companyId] = [];
        state.peopleByCompany[companyId].push(id);
    }
    return person;
}

export function getPrimaryCompanyContact(companyId) {
    const ids = state.peopleByCompany?.[companyId] || [];
    return ids.length > 0 ? state.people[ids[0]] || null : null;
}

export {
    DEFAULT_DIALOGUE_PROFILE,
    DEFAULT_RELATIONSHIP_AFFECT,
    DIALOGUE_LEXICON_IDS,
    DIALOGUE_REGISTERS,
    DIALOGUE_TONES,
    dialogueProfileForRole,
    ensurePersonDialogueProfile,
    normaliseDialogueProfile,
    normaliseRelationshipAffect
} from './people/dialogueVoice.js';
export {
    DIALOGUE_PART_TYPES,
    DIALOGUE_SPEAKER_TYPES,
    addDialogueConversationPart,
    getConversationPart,
    getConversationPartCausalChain,
    getConversationParts,
    getConversationPartsBySpeaker,
    getConversationPartsByType,
    getConversationPartsCausedBy,
    getLatestConversationPart,
    ensureDialogueRuntimeStorage,
    normaliseDialogueConversationParts,
    normaliseDialogueTables
} from './people/conversationParts.js';
export { askNpcToFindPart, checkBackWithNpc } from './people/dialogue.js';
export {
    DIALOGUE_CONVERSATION_STATUSES,
    DIALOGUE_CONVERSATION_TYPES,
    ensureDialogueConversation,
    getDialogueConversation,
    getDialogueConversationsForPerson,
    normaliseDialogueConversation,
    ensureDialogueConversationStorage,
    normaliseDialogueConversations,
    rebuildDialogueConversationsFromTables,
    touchDialogueConversation
} from './people/conversations.js';
export {
    DIALOGUE_EVENT_TYPES,
    addDialogueEvent,
    getDialogueEventsByConversationId,
    getDialogueEventsByMemoryId,
    getDialogueEventsByPartId,
    getDialogueEventsByTaskId,
    normaliseDialogueEvent,
    normaliseDialogueEvents
} from './people/dialogueEvents.js';
export {
    DIALOGUE_TASK_STATUSES,
    DIALOGUE_TASK_TYPES,
    createLocateItemDialogueTask,
    normaliseDialogueTask,
    normaliseDialogueTasks,
    resolveDueDialogueTasks
} from './people/dialogueTasks.js';
export {
    DIALOGUE_MESSAGE_STATUSES,
    createDialogueMessage,
    markDialogueMessageRead,
    normaliseDialogueMessage,
    normaliseDialogueMessages
} from './people/messages.js';
export {
    DIALOGUE_MEMORY_SALIENCE,
    DIALOGUE_MEMORY_STATUSES,
    DIALOGUE_MEMORY_TYPES,
    createOrReinforceDialogueMemory,
    decayDialogueMemories,
    getActiveCustomerRequests,
    getDialogueMemoriesForPerson,
    normaliseDialogueMemories,
    normaliseDialogueMemory,
    resolveDialogueMemory,
    supersedeDialogueMemory
} from './people/memory.js';
export {
    DIALOGUE_PROPOSAL_AUTHORITIES,
    DIALOGUE_PROPOSAL_STATUSES,
    acceptDialogueProposal,
    commitDialogueProposal,
    createDialogueProposal,
    getDialogueProposal,
    getDialogueProposalByPartId,
    getDialogueProposalsByConversationId,
    normaliseDialogueProposal,
    normaliseDialogueProposals,
    rejectDialogueProposal
} from './people/proposals.js';
export {
    DIALOGUE_OFFER_STATUSES,
    DIALOGUE_OFFER_TYPES,
    acceptDialogueOffer,
    acceptLocatedItemOffer,
    createDialogueOffer,
    expireDialogueOffers,
    getActiveDialogueOffersForPlayer,
    getDialogueOffer,
    getDialogueOffersByConversationId,
    normaliseDialogueOffer,
    normaliseDialogueOffers,
    rejectDialogueOffer
} from './people/offers.js';
export {
    getActiveDialoguePromisesForPlayer,
    getContactDialogueActionState,
    getConversationSummary,
    getConversationTimeline,
    getDialogueDebugTrace,
    getPersonConversationHistory,
    getUnreadDialogueMessageCountByConversation
} from './people/conversationQueries.js';
export {
    applyDialogueRelationshipDelta,
    getDialogueRelationship,
    normaliseDialogueRelationship
} from './people/relationships.js';
export {
    buildLocateItemResolutionContext,
    normaliseLocateItemResolutionPolicy,
    resolveLocateItemOutcome,
    scoreLocateItemResolution
} from './people/locateItemResolution.js';
export {
    archiveResolvedConversations,
    expireOldDialogueMessages,
    pruneOldDialogueEvents,
    runDialogueMaintenanceDaily
} from './people/dialogueMaintenance.js';
export {
    DIALOGUE_LEXICONS,
    buildDialogueFrame,
    chooseStable,
    deriveDialogueTone,
    realizeDialogueLine,
    realizeDialoguePrompt,
    resolveLexiconSlots,
    selectDialogueRegister,
    selectNestedTemplate,
    validateDialogueFrame
} from './people/dialogueRealization.js';
export {
    DIALOGUE_FALLBACK_LINE,
    DIALOGUE_FRAME_STATES,
    DIALOGUE_INTENTS,
    DIALOGUE_PROMPT_TEMPLATE_BANKS,
    DIALOGUE_TEMPLATE_BANKS
} from './people/dialogueTemplates.js';
