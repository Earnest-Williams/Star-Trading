export const DIALOGUE_INTENTS = Object.freeze({
    REQUEST_LOCATE_ITEM: 'request_locate_item',
    CHECK_BACK_LOCATE_ITEM: 'check_back_locate_item'
});

export const DIALOGUE_FRAME_STATES = Object.freeze({
    FRESH_REQUEST: 'fresh_request',
    ACTIVE_TASK: 'active_task',
    REMEMBERED_REQUEST: 'remembered_request',
    OFFER_READY: 'offer_ready',
    FOUND_ALREADY: 'found_already',
    FAILED_PREVIOUS: 'failed_previous'
});

export const DIALOGUE_FALLBACK_LINE = 'I can check my notes and get back to you.';

export const LOCATE_ITEM_REQUIRED_SLOTS = Object.freeze(['itemLabel', 'personName']);

const REQUEST_LOCATE_ITEM_TEMPLATES = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: 'No stock today, but I can ask around for a {itemLabel}.',
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]: 'I am still looking for that {itemLabel}. I will send word when I have news.',
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]: 'I am still looking for that {itemLabel}. I will send word when I have news.',
    [DIALOGUE_FRAME_STATES.OFFER_READY]: 'I already found a {itemLabel}; check Communications when you are ready.',
    [DIALOGUE_FRAME_STATES.FOUND_ALREADY]: 'You already picked up that {itemLabel}. Ask again if you need another.',
    [DIALOGUE_FRAME_STATES.FAILED_PREVIOUS]: 'I struck out last time, but I can ask around for a {itemLabel} again.'
});

const CHECK_BACK_LOCATE_ITEM_TEMPLATES = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: 'I do not have an active request for that {itemLabel} yet.',
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]: 'I am still looking for that {itemLabel}. I will send word when I have news.',
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]: 'I still have your {itemLabel} request in my notes. I will send word when I have news.',
    [DIALOGUE_FRAME_STATES.OFFER_READY]: 'I already found a {itemLabel}; check Communications when you are ready.',
    [DIALOGUE_FRAME_STATES.FOUND_ALREADY]: 'You already picked up that {itemLabel}. Ask again if you need another.',
    [DIALOGUE_FRAME_STATES.FAILED_PREVIOUS]: 'I struck out last time on that {itemLabel}. Ask again if you want me to restart the search.'
});

export const DIALOGUE_TEMPLATE_BANKS = Object.freeze({
    [DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM]: REQUEST_LOCATE_ITEM_TEMPLATES,
    [DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM]: CHECK_BACK_LOCATE_ITEM_TEMPLATES
});

const REQUEST_LOCATE_ITEM_PLAYER_PROMPTS = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: 'Can you find a {itemLabel} for me?'
});

const CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS = Object.freeze({
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]: 'Any news on that {itemLabel}?'
});

export const DIALOGUE_PROMPT_TEMPLATE_BANKS = Object.freeze({
    [DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM]: REQUEST_LOCATE_ITEM_PLAYER_PROMPTS,
    [DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM]: CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS
});

export const LOCATE_ITEM_RESULT_MESSAGE_TEMPLATES = Object.freeze({
    success: Object.freeze({
        worn: 'I found a worn {label} from a {source}. It is not pretty, but it will hold.',
        pristine: 'I found a pristine {label} through a {source}. It is clean stock and ready for trade.',
        default: 'I found a {condition} {label} through a {source}. It is available for trade when you are ready.'
    }),
    failure: Object.freeze({
        pirate_pressure: 'No luck on the {label}. The routes are hot and suppliers are holding stock back.',
        market_pressure: 'No luck on the {label}. The local brokers are dry and prices are moving against us.',
        default: 'No luck on the {label}. I did not find a lead worth putting aside.'
    })
});
