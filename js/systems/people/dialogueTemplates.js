import { DIALOGUE_REGISTERS, DIALOGUE_TONES } from './dialogueVoice.js';

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

const DEFAULT_LOCATE_ITEM_TONES = Object.freeze({
    [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
        'No stock today, but I can ask around for a {itemLabel}.'
    ]),
    [DIALOGUE_TONES.WARM]: Object.freeze([
        'For you, I can ask around for a {itemLabel}.'
    ]),
    [DIALOGUE_TONES.WARY]: Object.freeze([
        'I can ask around for a {itemLabel}, but I will keep the search quiet.'
    ]),
    [DIALOGUE_TONES.HOSTILE]: Object.freeze([
        'I will look for a {itemLabel}, but do not make me regret the favor.'
    ]),
    [DIALOGUE_TONES.BRISK]: Object.freeze([
        'No stock. I can ask around for a {itemLabel}.'
    ])
});

function tones(overrides = {}) {
    return Object.freeze({
        ...DEFAULT_LOCATE_ITEM_TONES,
        ...Object.fromEntries(
            Object.entries(overrides).map(([tone, templates]) => [tone, Object.freeze(templates)])
        )
    });
}

function registers(defaultTones, overrides = {}) {
    return Object.freeze({
        [DIALOGUE_REGISTERS.PROFESSIONAL]: defaultTones,
        [DIALOGUE_REGISTERS.PLAIN]: defaultTones,
        [DIALOGUE_REGISTERS.FORMAL]: defaultTones,
        [DIALOGUE_REGISTERS.CASUAL]: defaultTones,
        [DIALOGUE_REGISTERS.UNDERWORLD]: defaultTones,
        ...overrides
    });
}

const REQUEST_LOCATE_ITEM_TEMPLATES = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: registers(DEFAULT_LOCATE_ITEM_TONES, {
        [DIALOGUE_REGISTERS.FORMAL]: tones({
            [DIALOGUE_TONES.NEUTRAL]: ['There is no stock on hand, but I can make inquiries for a {itemLabel}.']
        }),
        [DIALOGUE_REGISTERS.CASUAL]: tones({
            [DIALOGUE_TONES.NEUTRAL]: ['Nothing on the shelf, but I can ask around for a {itemLabel}.']
        }),
        [DIALOGUE_REGISTERS.UNDERWORLD]: tones({
            [DIALOGUE_TONES.NEUTRAL]: ['Nothing clean on hand, but I can shake loose a {itemLabel}.']
        })
    }),
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['I am still looking for that {itemLabel}. I will send word when I have news.'],
        [DIALOGUE_TONES.WARM]: ['I am still working on your {itemLabel}. I will send word when I have news.'],
        [DIALOGUE_TONES.WARY]: ['I am still looking for that {itemLabel}. I will send word if the trail stays clean.'],
        [DIALOGUE_TONES.HOSTILE]: ['I am still looking for that {itemLabel}. You will hear when I have something.'],
        [DIALOGUE_TONES.BRISK]: ['Still looking for that {itemLabel}. I will send word.']
    })),
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['I am still looking for that {itemLabel}. I will send word when I have news.'],
        [DIALOGUE_TONES.WARM]: ['I still have your {itemLabel} in my notes. I will send word when I have news.'],
        [DIALOGUE_TONES.WARY]: ['I still have the {itemLabel} request in my notes. I will move carefully.'],
        [DIALOGUE_TONES.HOSTILE]: ['The {itemLabel} request is still in my notes. That is all for now.'],
        [DIALOGUE_TONES.BRISK]: ['Your {itemLabel} request is still in my notes. I will send word.']
    })),
    [DIALOGUE_FRAME_STATES.OFFER_READY]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['I already found a {itemLabel}; check {contactChannel} when you are ready.'],
        [DIALOGUE_TONES.WARM]: ['I found your {itemLabel}; check {contactChannel} when you are ready.'],
        [DIALOGUE_TONES.WARY]: ['I found a {itemLabel}; check {contactChannel} if you still want it.'],
        [DIALOGUE_TONES.HOSTILE]: ['Your {itemLabel} is waiting in {contactChannel}. Decide quickly.'],
        [DIALOGUE_TONES.BRISK]: ['Found a {itemLabel}. Check {contactChannel}.']
    })),
    [DIALOGUE_FRAME_STATES.FOUND_ALREADY]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['You already picked up that {itemLabel}. Ask again if you need another.'],
        [DIALOGUE_TONES.WARM]: ['You already picked up that {itemLabel}. I can look for another if you need it.'],
        [DIALOGUE_TONES.WARY]: ['You already picked up that {itemLabel}. A new search needs a new ask.'],
        [DIALOGUE_TONES.HOSTILE]: ['You already picked up that {itemLabel}. Do not blur the books.'],
        [DIALOGUE_TONES.BRISK]: ['You already picked up that {itemLabel}. Ask again for another.']
    })),
    [DIALOGUE_FRAME_STATES.FAILED_PREVIOUS]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['I struck out last time, but I can ask around for a {itemLabel} again.'],
        [DIALOGUE_TONES.WARM]: ['I struck out last time, but I can restart the search for your {itemLabel}.'],
        [DIALOGUE_TONES.WARY]: ['I struck out last time. I can ask around again, carefully, for a {itemLabel}.'],
        [DIALOGUE_TONES.HOSTILE]: ['I struck out last time. If you want another search for a {itemLabel}, ask plainly.'],
        [DIALOGUE_TONES.BRISK]: ['Last search failed. I can ask around for a {itemLabel} again.']
    }))
});

const CHECK_BACK_LOCATE_ITEM_TEMPLATES = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['I do not have an active request for that {itemLabel} yet.'],
        [DIALOGUE_TONES.WARM]: ['I do not have your {itemLabel} request open yet.'],
        [DIALOGUE_TONES.WARY]: ['I do not have an active {itemLabel} request on the books.'],
        [DIALOGUE_TONES.HOSTILE]: ['There is no active {itemLabel} request.'],
        [DIALOGUE_TONES.BRISK]: ['No active {itemLabel} request yet.']
    })),
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]: REQUEST_LOCATE_ITEM_TEMPLATES[DIALOGUE_FRAME_STATES.ACTIVE_TASK],
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['I still have your {itemLabel} request in my notes. I will send word when I have news.'],
        [DIALOGUE_TONES.WARM]: ['Your {itemLabel} request is still in my notes. I will send word as soon as I have news.'],
        [DIALOGUE_TONES.WARY]: ['The {itemLabel} request is still in my notes. I will send word if the trail stays clean.'],
        [DIALOGUE_TONES.HOSTILE]: ['The {itemLabel} request is still in my notes. Wait for word.'],
        [DIALOGUE_TONES.BRISK]: ['Your {itemLabel} request is in my notes. I will send word.']
    })),
    [DIALOGUE_FRAME_STATES.OFFER_READY]: REQUEST_LOCATE_ITEM_TEMPLATES[DIALOGUE_FRAME_STATES.OFFER_READY],
    [DIALOGUE_FRAME_STATES.FOUND_ALREADY]: REQUEST_LOCATE_ITEM_TEMPLATES[DIALOGUE_FRAME_STATES.FOUND_ALREADY],
    [DIALOGUE_FRAME_STATES.FAILED_PREVIOUS]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['I struck out last time on that {itemLabel}. Ask again if you want me to restart the search.'],
        [DIALOGUE_TONES.WARM]: ['I struck out last time on that {itemLabel}. Ask again and I can restart the search.'],
        [DIALOGUE_TONES.WARY]: ['I struck out last time on that {itemLabel}. A restart needs a clear ask.'],
        [DIALOGUE_TONES.HOSTILE]: ['The last {itemLabel} search failed. Ask again if you want it reopened.'],
        [DIALOGUE_TONES.BRISK]: ['Last {itemLabel} search failed. Ask again to restart it.']
    }))
});

export const DIALOGUE_TEMPLATE_BANKS = Object.freeze({
    [DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM]: REQUEST_LOCATE_ITEM_TEMPLATES,
    [DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM]: CHECK_BACK_LOCATE_ITEM_TEMPLATES
});

const REQUEST_LOCATE_ITEM_PLAYER_PROMPTS = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['Can you find a {itemLabel} for me?'],
        [DIALOGUE_TONES.WARM]: ['Could you find a {itemLabel} for me?'],
        [DIALOGUE_TONES.WARY]: ['Can you quietly find a {itemLabel} for me?'],
        [DIALOGUE_TONES.HOSTILE]: ['Can you find a {itemLabel}, or not?'],
        [DIALOGUE_TONES.BRISK]: ['Can you find a {itemLabel}?']
    }))
});

const CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS = Object.freeze({
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]: registers(tones({
        [DIALOGUE_TONES.NEUTRAL]: ['Any news on that {itemLabel}?'],
        [DIALOGUE_TONES.WARM]: ['Any news on my {itemLabel}?'],
        [DIALOGUE_TONES.WARY]: ['Any quiet news on that {itemLabel}?'],
        [DIALOGUE_TONES.HOSTILE]: ['Any news on that {itemLabel} yet?'],
        [DIALOGUE_TONES.BRISK]: ['News on that {itemLabel}?']
    }))
});

export const DIALOGUE_PROMPT_TEMPLATE_BANKS = Object.freeze({
    [DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM]: REQUEST_LOCATE_ITEM_PLAYER_PROMPTS,
    [DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM]: CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS
});

export const LOCATE_ITEM_RESULT_MESSAGE_TEMPLATES = Object.freeze({
    success: Object.freeze({
        worn: Object.freeze([
            'I found a worn {label} from a {source}. It is not pretty, but it will hold.',
            'A {source} had a worn {label}. It is rough, but serviceable.'
        ]),
        pristine: Object.freeze([
            'I found a pristine {label} through a {source}. It is clean stock and ready for trade.',
            'A {source} came through with a pristine {label}. It is ready for trade.'
        ]),
        default: Object.freeze([
            'I found a {condition} {label} through a {source}. It is available for trade when you are ready.',
            'A {source} located a {condition} {label}. It is available when you are ready.'
        ])
    }),
    failure: Object.freeze({
        pirate_pressure: Object.freeze([
            'No luck on the {label}. The routes are hot and suppliers are holding stock back.',
            'No lead on the {label}. Pirate pressure has the route brokers locked down.'
        ]),
        market_pressure: Object.freeze([
            'No luck on the {label}. The local brokers are dry and prices are moving against us.',
            'No lead on the {label}. The market is thin and the useful stock is overpriced.'
        ]),
        default: Object.freeze([
            'No luck on the {label}. I did not find a lead worth putting aside.',
            'No lead on the {label}. Nothing reliable came through.'
        ])
    })
});
