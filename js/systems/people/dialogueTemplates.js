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

// ─── NPC response template banks ─────────────────────────────────────────────
// Shape per-intent: state → register → tone → templates[]
// Fallback order in selectNestedTemplate:
//   exact register + exact tone
//   exact register + neutral tone
//   neutral register + exact tone
//   neutral register + neutral tone
//   work register + exact tone
//   work register + neutral tone
//   global DIALOGUE_FALLBACK_LINE

const REQUEST_LOCATE_ITEM_TEMPLATES = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                '{noStock}, but I can {askAround} a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'For you, I can {askAround} a {itemLabel}. Leave it with me.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I can {askAround} a {itemLabel}, but I will keep the search quiet.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'I will {askAround} a {itemLabel}, but do not make me regret the favor.'
            ]),
            [DIALOGUE_TONES.ENVIOUS]: Object.freeze([
                'I can find a {itemLabel}. Some of us have to work for our parts.'
            ]),
            [DIALOGUE_TONES.JEALOUS]: Object.freeze([
                '{noStock}, but I can {askAround} a {itemLabel}. Just for you.'
            ]),
            [DIALOGUE_TONES.INTIMATE]: Object.freeze([
                'Leave it with me. I will find you a {itemLabel}.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Nothing on hand, but I can ask around for a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I can ask around for a {itemLabel} for you.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I can look for a {itemLabel}, though I will keep it quiet.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'I will look for a {itemLabel}, but do not make me regret it.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Nothing now, but I will track down a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I will find you a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I can look, quietly. A {itemLabel}.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'Fine. I will look for a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.ENVIOUS]: Object.freeze([
                'Some contacts you have. I can still find a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.JEALOUS]: Object.freeze([
                'A {itemLabel}? For you, I will make it happen.'
            ]),
            [DIALOGUE_TONES.INTIMATE]: Object.freeze([
                'A {itemLabel}. I will handle it myself.'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Still looking for that {itemLabel}. I will send word when I have news.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Still working on your {itemLabel}. I will send word soon.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'Still looking for that {itemLabel}. I will keep you posted if the trail stays clean.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'Still looking for that {itemLabel}. You will hear when I have something.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Still looking. I will send word on the {itemLabel}.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Still on it. The {itemLabel}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I have not forgotten your {itemLabel}. I will send word.'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Your {itemLabel} request is still in my notes. I will send word.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Still have your {itemLabel} in my notes. I will send word as soon as I have news.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'The {itemLabel} request is in my notes. I will move carefully.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'The {itemLabel} request is in my notes. Wait for word.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'I have the {itemLabel} request. I will send word.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Still in my notes. The {itemLabel}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Your {itemLabel} is still in my notes. I will send word.'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.OFFER_READY]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'I found a {itemLabel}. Check Communications when you are ready.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Found your {itemLabel}. Check Communications when you are ready.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I found a {itemLabel}. Check Communications if you still want it.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'Your {itemLabel} is waiting in Communications. Decide quickly.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'I found a {itemLabel}. Check Communications.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Got a {itemLabel} lined up. Check Communications.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Found your {itemLabel}. Check Communications.'
            ]),
            [DIALOGUE_TONES.INTIMATE]: Object.freeze([
                'I {heldAside} a {itemLabel} for you. Check Communications.'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.FOUND_ALREADY]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'You already picked up that {itemLabel}. Ask again if you need another.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'You already picked up that {itemLabel}. I can look for another if you need it.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'You already picked up that {itemLabel}. A new search needs a new ask.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'You already picked up that {itemLabel}. Do not blur the books.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'You already picked up that {itemLabel}. Ask again for another.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'You already have the {itemLabel}. Ask again if you need another.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'You have your {itemLabel}. Let me know if you need another.'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.FAILED_PREVIOUS]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'I struck out last time, but I can {askAround} for a {itemLabel} again.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I struck out last time. I can restart the search for your {itemLabel}.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I struck out last time. I can look again, carefully, for a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'The last search failed. If you want another search for a {itemLabel}, ask plainly.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'I struck out last time. I can ask around for a {itemLabel} again.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Last time I missed on the {itemLabel}. I can try again.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I missed last time. I will restart the {itemLabel} search.'
            ])
        })
    })
});

const CHECK_BACK_LOCATE_ITEM_TEMPLATES = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'There is no active {itemLabel} request on the books.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I do not have an active {itemLabel} request open yet.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'No active {itemLabel} request on the books.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'No active {itemLabel} request.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'No active request for that {itemLabel} yet.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'No open request for the {itemLabel}.'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]:
        REQUEST_LOCATE_ITEM_TEMPLATES[DIALOGUE_FRAME_STATES.ACTIVE_TASK],
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'I still have your {itemLabel} request in my notes. I will send word when I have news.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Your {itemLabel} request is still in my notes. I will send word as soon as I have news.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'The {itemLabel} request is still in my notes. I will send word if the trail stays clean.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'The {itemLabel} request is still in my notes. Wait for word.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Your {itemLabel} request is in my notes. I will send word.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Still in my notes. The {itemLabel}. I will send word.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Your {itemLabel} is still in my notes. I will send word soon.'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.OFFER_READY]:
        REQUEST_LOCATE_ITEM_TEMPLATES[DIALOGUE_FRAME_STATES.OFFER_READY],
    [DIALOGUE_FRAME_STATES.FOUND_ALREADY]:
        REQUEST_LOCATE_ITEM_TEMPLATES[DIALOGUE_FRAME_STATES.FOUND_ALREADY],
    [DIALOGUE_FRAME_STATES.FAILED_PREVIOUS]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'I struck out last time on that {itemLabel}. Ask again if you want me to restart the search.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I struck out last time on that {itemLabel}. Ask again and I can restart the search.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I struck out last time on that {itemLabel}. A restart needs a clear ask.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'The last {itemLabel} search failed. Ask again if you want it reopened.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Last {itemLabel} search failed. Ask again to restart it.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Last time I missed on the {itemLabel}. Ask again to restart.'
            ])
        })
    })
});

export const DIALOGUE_TEMPLATE_BANKS = Object.freeze({
    [DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM]: REQUEST_LOCATE_ITEM_TEMPLATES,
    [DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM]: CHECK_BACK_LOCATE_ITEM_TEMPLATES
});

// ─── Player prompt template banks ────────────────────────────────────────────

const REQUEST_LOCATE_ITEM_PLAYER_PROMPTS = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Can you find a {itemLabel} for me?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['Could you find a {itemLabel} for me?']),
            [DIALOGUE_TONES.GUARDED]: Object.freeze(['Can you quietly find a {itemLabel} for me?']),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze(['Can you find a {itemLabel}, or not?'])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Can you find a {itemLabel}?'])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Can you find a {itemLabel} for me?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['Would you find a {itemLabel} for me?']),
            [DIALOGUE_TONES.INTIMATE]: Object.freeze(['I need a {itemLabel}. Can you find one?'])
        })
    }),
    [DIALOGUE_FRAME_STATES.FAILED_PREVIOUS]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Can you restart the search for that {itemLabel}?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['Could you take another look for my {itemLabel}?']),
            [DIALOGUE_TONES.GUARDED]: Object.freeze(['Can you make another quiet run at the {itemLabel}?']),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze(['Try again on the {itemLabel}.'])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Can you look again for that {itemLabel}?'])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Can you try again on the {itemLabel}?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['Would you try again on my {itemLabel}?'])
        })
    })
});

const CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS = Object.freeze({
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Any news on that {itemLabel}?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['Any news on my {itemLabel}?']),
            [DIALOGUE_TONES.GUARDED]: Object.freeze(['Any quiet news on that {itemLabel}?']),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze(['Any news on that {itemLabel} yet?'])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['News on that {itemLabel}?'])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Any news on the {itemLabel}?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['Heard anything on my {itemLabel}?'])
        })
    }),
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Do you still have my {itemLabel} request?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['Do you still have my {itemLabel} in your notes?']),
            [DIALOGUE_TONES.GUARDED]: Object.freeze(['Is the {itemLabel} request still open?']),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze(['You still have that {itemLabel} request, right?'])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Is my {itemLabel} request still open?'])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['You still remember the {itemLabel}?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['You still have my {itemLabel} in mind?'])
        })
    }),
    [DIALOGUE_FRAME_STATES.OFFER_READY]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['You found the {itemLabel}?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['You found my {itemLabel}?']),
            [DIALOGUE_TONES.GUARDED]: Object.freeze(['Is the {itemLabel} ready to review?']),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze(['Show me the {itemLabel} offer.'])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['You found a {itemLabel}?'])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['You found the {itemLabel}?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['You came through on my {itemLabel}?'])
        })
    }),
    [DIALOGUE_FRAME_STATES.FOUND_ALREADY]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['That {itemLabel} is already settled, right?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['We already settled the {itemLabel}, right?']),
            [DIALOGUE_TONES.GUARDED]: Object.freeze(['The {itemLabel} is off the books now, yes?']),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze(['That {itemLabel} is already handled.'])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['I already picked up that {itemLabel}, right?'])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['We already handled the {itemLabel}.']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['Thanks again for the {itemLabel}.'])
        })
    }),
    [DIALOGUE_FRAME_STATES.FAILED_PREVIOUS]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['The last {itemLabel} search failed?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['No luck on my {itemLabel} last time?']),
            [DIALOGUE_TONES.GUARDED]: Object.freeze(['The {itemLabel} trail went cold?']),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze(['You missed on the {itemLabel}?'])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['No luck on the {itemLabel}?'])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['Still no {itemLabel}?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['No luck finding my {itemLabel}?'])
        })
    })
});

export const DIALOGUE_PROMPT_TEMPLATE_BANKS = Object.freeze({
    [DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM]: REQUEST_LOCATE_ITEM_PLAYER_PROMPTS,
    [DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM]: CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS
});

// ─── Result message templates ─────────────────────────────────────────────────
// Used by locateItemResolution for system messages, not NPC dialogue lines.

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
