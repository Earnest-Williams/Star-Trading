import { DIALOGUE_REGISTERS, DIALOGUE_TONES } from './dialogueVoice.js';
import {
    DIALOGUE_TEXT_PROMPT_TEMPLATE_BANKS,
    DIALOGUE_TEXT_TEMPLATE_BANKS,
    LOCATE_ITEM_RESULT_MESSAGE_ADDITIONS
} from './dialogueTextStrings.js';
import { mergeFrozenStringTree } from './common.js';

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
                '{noStock}, but I can {askAround} for a {itemLabel}.',
                '{noStock}. I can start asking after a {itemLabel}.',
                'I do not have a {itemLabel} here, but I can {askAround}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'For you, I can {askAround} a {itemLabel}. Leave it with me.',
                'I can put feelers out for a {itemLabel}. I will let you know what turns up.',
                'I will make time for it. A {itemLabel}, yes?'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I can {askAround} a {itemLabel}, but I will keep the search quiet.',
                'I can ask after a {itemLabel}. No names unless I need them.',
                'I will see who has a {itemLabel} without making noise.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'I will {askAround} a {itemLabel}, but do not make me regret the favor.',
                'Fine. I will ask after a {itemLabel}. Keep your end simple.',
                'I can look for a {itemLabel}. Do not waste my time.'
            ]),
            [DIALOGUE_TONES.ENVIOUS]: Object.freeze([
                'I can find a {itemLabel}. Some of us have to work for our parts.',
                'A {itemLabel}. Of course. I will see what your luck buys today.'
            ]),
            [DIALOGUE_TONES.JEALOUS]: Object.freeze([
                '{noStock}, but I can {askAround} a {itemLabel}. Just for you.',
                'I can ask around for a {itemLabel}. I suppose you came to me first.'
            ]),
            [DIALOGUE_TONES.INTIMATE]: Object.freeze([
                'Leave it with me. I will find you a {itemLabel}.',
                'I will handle the {itemLabel} myself. You will hear from me.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Nothing on hand, but I can ask around for a {itemLabel}.',
                'No {itemLabel} here, but I can ask around.',
                'I can look for a {itemLabel}. It may take a little time.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I can ask around for a {itemLabel} for you.',
                'I will see who can spare a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I can look for a {itemLabel}, though I will keep it quiet.',
                'I can make a quiet search for a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'I will look for a {itemLabel}, but do not make me regret it.',
                'I will look for a {itemLabel}. Do not press me for miracles.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Nothing now, but I will track down a {itemLabel}.',
                'I do not have one, but I will find a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I will find you a {itemLabel}.',
                'Leave the {itemLabel} with me. I will work on it.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I can look, quietly. A {itemLabel}.',
                'I can ask carefully about a {itemLabel}.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'Fine. I will look for a {itemLabel}.',
                'I will look. Do not make the {itemLabel} my problem twice.'
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
                'Still looking for that {itemLabel}. I will send word when I have news.',
                'The {itemLabel} search is still open. No useful lead yet.',
                'I am still asking after that {itemLabel}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Still working on your {itemLabel}. I will send word soon.',
                'I have not dropped your {itemLabel}. I will send word when I have something.',
                'Your {itemLabel} is still on my list.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'Still looking for that {itemLabel}. I will keep you posted if the trail stays clean.',
                'The {itemLabel} search is moving slowly. I am being careful.',
                'I am still checking on that {itemLabel}, quietly.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'Still looking for that {itemLabel}. You will hear when I have something.',
                'No {itemLabel} yet. I will say something when there is something to say.',
                'The {itemLabel} is not in my hand yet. Wait.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Still looking. I will send word on the {itemLabel}.',
                'No answer yet on the {itemLabel}.',
                'The {itemLabel} is still pending.'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Still on it. The {itemLabel}.',
                'I am still watching for the {itemLabel}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I have not forgotten your {itemLabel}. I will send word.',
                'Your {itemLabel} is still on my mind.'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Your {itemLabel} request is still in my notes. I will send word.',
                'I still have the {itemLabel} request open.',
                'The {itemLabel} is still logged. I have not closed it.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Still have your {itemLabel} in my notes. I will send word as soon as I have news.',
                'Your {itemLabel} is still on my sheet. I will tell you when I have a lead.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'The {itemLabel} request is in my notes. I will move carefully.',
                'I still have the {itemLabel} request. I am keeping the circle small.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'The {itemLabel} request is in my notes. Wait for word.',
                'I have not lost the {itemLabel} request. Do not ask me every hour.'
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
                'I found a {itemLabel}. Check Communications when you are ready.',
                'There is a {itemLabel} offer waiting in Communications.',
                'I have a line on a {itemLabel}. Review it in Communications.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Found your {itemLabel}. Check Communications when you are ready.',
                'I found your {itemLabel}. The details are in Communications.',
                'Your {itemLabel} came through. Check Communications.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I found a {itemLabel}. Check Communications if you still want it.',
                'A {itemLabel} is available. The details are in Communications.',
                'I have a {itemLabel} lead. Review it before it goes stale.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'Your {itemLabel} is waiting in Communications. Decide quickly.',
                'I found the {itemLabel}. Read the offer and move.',
                'The {itemLabel} offer is up. Do not make me chase you for an answer.'
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
                'You already picked up that {itemLabel}. Ask again if you need another.',
                'That {itemLabel} is already settled.',
                'The last {itemLabel} request is complete. A new one needs a new ask.'
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
                'I struck out last time, but I can {askAround} for a {itemLabel} again.',
                'Last search came up empty. I can reopen the hunt for a {itemLabel}.',
                'No luck last time. I can start over on the {itemLabel}.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I struck out last time. I can restart the search for your {itemLabel}.',
                'Last time did not work out. I can try again for your {itemLabel}.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'I struck out last time. I can look again, carefully, for a {itemLabel}.',
                'The last {itemLabel} search went nowhere. I can make another careful pass.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'The last search failed. If you want another search for a {itemLabel}, ask plainly.',
                'The {itemLabel} did not turn up. Say so if you want me to waste another pass.'
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
                'There is no active {itemLabel} request on the books.',
                'I do not have a live {itemLabel} request from you.',
                'Nothing is open for a {itemLabel} right now.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'I do not have an active {itemLabel} request open yet.',
                'I do not see a {itemLabel} request from you. I can open one if you want.'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'No active {itemLabel} request on the books.',
                'No {itemLabel} request is open under your name.'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'No active {itemLabel} request.',
                'There is no {itemLabel} request. Ask first, then check back.'
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
                'I still have your {itemLabel} request in my notes. I will send word when I have news.',
                'Your {itemLabel} is still listed. No result yet.',
                'The {itemLabel} request is still open on my end.'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Your {itemLabel} request is still in my notes. I will send word as soon as I have news.',
                'I still have your {itemLabel} in the queue. I will tell you when it moves.'
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

const BASE_DIALOGUE_TEMPLATE_BANKS = Object.freeze({
    [DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM]: REQUEST_LOCATE_ITEM_TEMPLATES,
    [DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM]: CHECK_BACK_LOCATE_ITEM_TEMPLATES
});

// ─── Player prompt template banks ────────────────────────────────────────────

const REQUEST_LOCATE_ITEM_PLAYER_PROMPTS = Object.freeze({
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Can you find a {itemLabel} for me?',
                'Can you ask around for a {itemLabel}?',
                'I am looking for a {itemLabel}. Can you help?'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Could you find a {itemLabel} for me?',
                'Would you help me track down a {itemLabel}?'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'Can you quietly find a {itemLabel} for me?',
                'Can you keep a quiet eye out for a {itemLabel}?'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'Can you find a {itemLabel}, or not?',
                'Can you get a {itemLabel} without turning this into a lecture?'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Can you find a {itemLabel}?',
                'Do you know where I can get a {itemLabel}?',
                'Can you look for a {itemLabel}?'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Can you find a {itemLabel} for me?',
                'Can you help me get a {itemLabel}?'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Would you find a {itemLabel} for me?',
                'Could you help me with a {itemLabel}?'
            ]),
            [DIALOGUE_TONES.INTIMATE]: Object.freeze([
                'I need a {itemLabel}. Can you find one?',
                'Can you find me a {itemLabel}? I trust your hands on this.'
            ])
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
            [DIALOGUE_TONES.WARM]: Object.freeze(['Would you try again on my {itemLabel}?']),
            [DIALOGUE_TONES.INTIMATE]: Object.freeze([
                'I still need that {itemLabel}. Can you try again?'
            ])
        })
    })
});

const CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS = Object.freeze({
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Any news on that {itemLabel}?',
                'Have you heard anything about the {itemLabel}?',
                'Where are we on the {itemLabel}?'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Any news on my {itemLabel}?',
                'Did anything turn up on my {itemLabel}?'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'Any quiet news on that {itemLabel}?',
                'Any safe word on the {itemLabel}?'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'Any news on that {itemLabel} yet?',
                'Do you have the {itemLabel} lead yet, or not?'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'News on that {itemLabel}?',
                'Anything on the {itemLabel}?',
                'Any word on the {itemLabel}?'
            ])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Any news on the {itemLabel}?',
                'Did the {itemLabel} turn up?'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Heard anything on my {itemLabel}?',
                'Any luck with my {itemLabel}?'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'What is the status of that {itemLabel}?',
                'Do we have a {itemLabel} request open?',
                'Did I already ask you about a {itemLabel}?'
            ])
        })
    }),
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]: Object.freeze({
        [DIALOGUE_REGISTERS.WORK]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'Do you still have my {itemLabel} request?',
                'Is my {itemLabel} request still on your list?'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'Do you still have my {itemLabel} in your notes?',
                'You still remember my {itemLabel}, right?'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'Is the {itemLabel} request still open?',
                'Is my {itemLabel} request still on the quiet list?'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'You still have that {itemLabel} request, right?',
                'Tell me you did not lose the {itemLabel} request.'
            ])
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
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'You found the {itemLabel}?',
                'Is the {itemLabel} offer ready?'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'You found my {itemLabel}?',
                'Did my {itemLabel} come through?'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'Is the {itemLabel} ready to review?',
                'Is there a real offer on the {itemLabel}?'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'Show me the {itemLabel} offer.',
                'Let me see the {itemLabel} terms.'
            ])
        }),
        [DIALOGUE_REGISTERS.NEUTRAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['You found a {itemLabel}?'])
        }),
        [DIALOGUE_REGISTERS.PERSONAL]: Object.freeze({
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze(['You found the {itemLabel}?']),
            [DIALOGUE_TONES.WARM]: Object.freeze(['You came through on my {itemLabel}?']),
            [DIALOGUE_TONES.INTIMATE]: Object.freeze(['You found my {itemLabel}? I knew you would.'])
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
            [DIALOGUE_TONES.NEUTRAL]: Object.freeze([
                'The last {itemLabel} search failed?',
                'No result on the {itemLabel}?'
            ]),
            [DIALOGUE_TONES.WARM]: Object.freeze([
                'No luck on my {itemLabel} last time?',
                'Did my {itemLabel} search come up empty?'
            ]),
            [DIALOGUE_TONES.GUARDED]: Object.freeze([
                'The {itemLabel} trail went cold?',
                'Nothing safe came through on the {itemLabel}?'
            ]),
            [DIALOGUE_TONES.HOSTILE]: Object.freeze([
                'You missed on the {itemLabel}?',
                'So the {itemLabel} search failed?'
            ])
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

const REQUEST_LOCATE_ITEM_PLAYER_PROMPTS_WITH_FOLLOWUPS = Object.freeze({
    ...REQUEST_LOCATE_ITEM_PLAYER_PROMPTS,
    [DIALOGUE_FRAME_STATES.ACTIVE_TASK]:
        CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS[DIALOGUE_FRAME_STATES.ACTIVE_TASK],
    [DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST]:
        CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS[DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST],
    [DIALOGUE_FRAME_STATES.OFFER_READY]:
        CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS[DIALOGUE_FRAME_STATES.OFFER_READY],
    [DIALOGUE_FRAME_STATES.FOUND_ALREADY]:
        CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS[DIALOGUE_FRAME_STATES.FOUND_ALREADY]
});

const BASE_DIALOGUE_PROMPT_TEMPLATE_BANKS = Object.freeze({
    [DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM]: REQUEST_LOCATE_ITEM_PLAYER_PROMPTS_WITH_FOLLOWUPS,
    [DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM]: CHECK_BACK_LOCATE_ITEM_PLAYER_PROMPTS
});

export const DIALOGUE_PROMPT_TEMPLATE_BANKS = mergeFrozenStringTree(
    BASE_DIALOGUE_PROMPT_TEMPLATE_BANKS,
    DIALOGUE_TEXT_PROMPT_TEMPLATE_BANKS
);


// ─── Result message templates ─────────────────────────────────────────────────
// Used by locateItemResolution for system messages, not NPC dialogue lines.

const BASE_LOCATE_ITEM_RESULT_MESSAGE_TEMPLATES = Object.freeze({
    success: Object.freeze({
        worn: Object.freeze([
            'I found a worn {label} from a {source}. It is not pretty, but it will hold.',
            'A {source} had a worn {label}. It is rough, but serviceable.',
            'A {source} can part with a worn {label}. It has seen use, but it is available.',
            'I have a worn {label} lined up through a {source}. It should do the job.'
        ]),
        pristine: Object.freeze([
            'I found a pristine {label} through a {source}. It is clean stock and ready for trade.',
            'A {source} came through with a pristine {label}. It is ready for trade.',
            'A pristine {label} is available through a {source}. The price reflects the condition.',
            'I found a pristine {label}. The {source} will not hold it forever.'
        ]),
        default: Object.freeze([
            'I found a {condition} {label} through a {source}. It is available for trade when you are ready.',
            'A {source} located a {condition} {label}. It is available when you are ready.',
            'I have a {condition} {label} offer from a {source}. Review it when you are ready.',
            'A {condition} {label} turned up through a {source}. The offer is waiting.'
        ])
    }),
    failure: Object.freeze({
        pirate_pressure: Object.freeze([
            'No luck on the {label}. The routes are hot and suppliers are holding stock back.',
            'No lead on the {label}. Pirate pressure has the route brokers locked down.',
            'The {label} did not turn up. Too many raiders on the lanes and nobody wants exposure.',
            'No reliable {label} source answered. Pirate pressure has everyone sitting tight.'
        ]),
        market_pressure: Object.freeze([
            'No luck on the {label}. The local brokers are dry and prices are moving against us.',
            'No lead on the {label}. The market is thin and the useful stock is overpriced.',
            'The {label} market is against us. Nothing came in at a price worth sending.',
            'No useful {label} lead. Local sellers either have nothing or want too much.'
        ]),
        default: Object.freeze([
            'No luck on the {label}. I did not find a lead worth putting aside.',
            'No lead on the {label}. Nothing reliable came through.',
            'The {label} search came up empty this pass.',
            'I asked around for the {label}. Nothing worth your credits turned up.'
        ])
    })
});

export const DIALOGUE_TEMPLATE_BANKS = mergeFrozenStringTree(
    BASE_DIALOGUE_TEMPLATE_BANKS,
    DIALOGUE_TEXT_TEMPLATE_BANKS
);


export const LOCATE_ITEM_RESULT_MESSAGE_TEMPLATES = mergeFrozenStringTree(
    BASE_LOCATE_ITEM_RESULT_MESSAGE_TEMPLATES,
    LOCATE_ITEM_RESULT_MESSAGE_ADDITIONS
);
