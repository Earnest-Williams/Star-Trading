// Additional authored dialogue strings. These stay separate from the core
// realization code so new English copy can be reviewed as content.

export const DIALOGUE_TEXT_LEXICON_ADDITIONS = Object.freeze({
    default: Object.freeze({
        goodLead: Object.freeze([
            'a live lead',
            'a credible source',
            'someone willing to sell',
            'a dealer with one loose'
        ]),
        badStock: Object.freeze([
            'thin inventory',
            'scarce stock',
            'overpriced scraps',
            'nothing worth your credits'
        ]),
        noStock: Object.freeze([
            'nothing in my bins',
            'no spare stock here',
            'nothing I can sell today',
            'nothing ready to move'
        ]),
        askAround: Object.freeze([
            'put out word',
            'check my contacts',
            'make a few calls',
            'ask the right people'
        ]),
        heldAside: Object.freeze([
            'held back',
            'kept waiting',
            'reserved',
            'marked for you'
        ]),
        supplier: Object.freeze([
            'a broker',
            'a trader',
            'a route contact',
            'a yard seller'
        ]),
        difficult: Object.freeze([
            'scarce right now',
            'not moving freely',
            'hard to place',
            'rare on this route'
        ]),
        risky: Object.freeze([
            'a rough lead',
            'not the safest pull',
            'a touch exposed',
            'a questionable source'
        ])
    }),
    scrapyard_plain: Object.freeze({
        goodLead: Object.freeze([
            'a decent line',
            'a yard line',
            'a seller with one tucked away',
            'a breaker who might part with one'
        ]),
        badStock: Object.freeze([
            'dry shelves',
            'picked-over bins',
            'scrap nobody should pay for',
            'parts that are all scars and excuses'
        ]),
        noStock: Object.freeze([
            'nothing usable on hand',
            'nothing in the pile today',
            'nothing I would sell you',
            'nothing worth bolting on'
        ]),
        askAround: Object.freeze([
            'shake something loose',
            'walk the yards',
            'lean on the breakers',
            'check the back lots'
        ]),
        heldAside: Object.freeze([
            'tucked away',
            'kept under a tarp',
            'put behind the counter',
            'held off the public board'
        ]),
        supplier: Object.freeze([
            'a yard contact',
            'a breaker',
            'a salvage broker',
            'a dockside seller'
        ]),
        difficult: Object.freeze([
            'hard to come by',
            'buried in bad lots',
            'rare outside salvage',
            'scarce unless someone strips a hull'
        ]),
        risky: Object.freeze([
            'a sketchy find',
            'a part with a story',
            'a dangerous pull',
            'a yard gamble'
        ])
    }),
    corporate_precise: Object.freeze({
        goodLead: Object.freeze([
            'a confirmed source',
            'a validated vendor',
            'a compliant supplier',
            'a verified channel'
        ]),
        badStock: Object.freeze([
            'insufficient inventory',
            'unusable supply',
            'nonviable stock',
            'pricing outside tolerance'
        ]),
        noStock: Object.freeze([
            'no stock on hand',
            'no available unit in local inventory',
            'nothing releasable from current stock',
            'no item cleared for sale today'
        ]),
        askAround: Object.freeze([
            'make inquiries',
            'query the vendor list',
            'open a sourcing request',
            'contact approved channels'
        ]),
        heldAside: Object.freeze([
            'reserved',
            'placed on hold',
            'assigned to your account',
            'held pending your review'
        ]),
        supplier: Object.freeze([
            'a verified supplier',
            'an approved vendor',
            'a licensed broker',
            'a registered distributor'
        ]),
        difficult: Object.freeze([
            'subject to availability',
            'constrained by current supply',
            'limited in this market',
            'dependent on vendor response'
        ]),
        risky: Object.freeze([
            'an elevated-risk procurement',
            'a nonstandard source',
            'a vendor-risk exception',
            'a volatile procurement'
        ])
    }),
    dock_direct: Object.freeze({
        goodLead: Object.freeze([
            'a lead',
            'a dock lead',
            'a hauler with one',
            'a cargo hand who heard something'
        ]),
        badStock: Object.freeze([
            'nothing moving',
            'dry holds',
            'bad crates',
            'sellers asking too much'
        ]),
        noStock: Object.freeze([
            'nothing on the dock',
            'nothing in the holds',
            'nothing on the board today',
            'nothing in reach'
        ]),
        askAround: Object.freeze([
            'check the yard',
            'ask the haulers',
            'walk the cargo board',
            'talk to the crews'
        ]),
        heldAside: Object.freeze([
            'pulled aside',
            'kept off the board',
            'stowed for you',
            'held at the bay'
        ]),
        supplier: Object.freeze([
            'a hauler contact',
            'a dock seller',
            'a cargo broker',
            'a crew chief'
        ]),
        difficult: Object.freeze([
            'tough to track',
            'not crossing the dock often',
            'hard to catch before it ships',
            'rare in the incoming holds'
        ]),
        risky: Object.freeze([
            'a risky pull',
            'a bay-side gamble',
            'a lead with heat on it',
            'a rough dock trade'
        ])
    })
});

export const DIALOGUE_TEXT_TEMPLATE_BANKS = Object.freeze({
    request_locate_item: Object.freeze({
        fresh_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'I can start a search for a {itemLabel}.',
                    'I can put the request out for a {itemLabel}.',
                    'No {itemLabel} here, but I know who to ask.',
                    'I will see who is moving a {itemLabel}.',
                    'I can open a lead for a {itemLabel} today.'
                ]),
                warm: Object.freeze([
                    'I will ask around for your {itemLabel} and keep it moving.',
                    'I can help with that {itemLabel}. I will start now.',
                    'Leave the {itemLabel} with me. I know a few doors to knock on.',
                    'I will see who can spare a {itemLabel} for you.'
                ]),
                guarded: Object.freeze([
                    'I can look for a {itemLabel}, but I will keep the circle small.',
                    'I will ask carefully about a {itemLabel}.',
                    'I can make a quiet pass for a {itemLabel}.',
                    'I will keep the {itemLabel} search off the public board.'
                ]),
                hostile: Object.freeze([
                    'I will look for a {itemLabel}. Do not turn this into trouble.',
                    'Fine. I can ask after a {itemLabel}. Then you wait.',
                    'I will put out word for a {itemLabel}. Do not crowd me.',
                    'A {itemLabel}. I will ask, but that is all I promise.'
                ]),
                envious: Object.freeze([
                    'A {itemLabel}. Must be nice to shop by request.',
                    'I will look for a {itemLabel}. Some people get doors opened.'
                ]),
                jealous: Object.freeze([
                    'I can look for a {itemLabel}. I am glad you came to me.',
                    'For you, I will ask around for a {itemLabel}.'
                ]),
                intimate: Object.freeze([
                    'I will find your {itemLabel}. Let me handle it.',
                    'A {itemLabel}. I will make the calls myself.'
                ])
            }),
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'I can try to find a {itemLabel}.',
                    'I know a few people who might have a {itemLabel}.',
                    'I can ask about a {itemLabel}.',
                    'Give me time and I will see about a {itemLabel}.'
                ]),
                warm: Object.freeze([
                    'I can look for a {itemLabel} for you.',
                    'I will ask around and see who has a {itemLabel}.'
                ]),
                guarded: Object.freeze([
                    'I can ask quietly about a {itemLabel}.',
                    'I will keep the {itemLabel} question narrow.'
                ]),
                hostile: Object.freeze([
                    'I can look for a {itemLabel}. No promises.',
                    'I will ask once about a {itemLabel}.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I will look for the {itemLabel}.',
                    'I can help you find a {itemLabel}.',
                    'I will see what I can do about the {itemLabel}.'
                ]),
                warm: Object.freeze([
                    'I will find your {itemLabel}.',
                    'You need a {itemLabel}; I will work on it.',
                    'I will make the {itemLabel} search a priority.'
                ]),
                guarded: Object.freeze([
                    'I can look, but quietly. The {itemLabel}.',
                    'I will ask only people I trust about the {itemLabel}.'
                ]),
                hostile: Object.freeze([
                    'I will look for the {itemLabel}. That is all.',
                    'Fine. I will try the {itemLabel} search again.'
                ]),
                envious: Object.freeze([
                    'I will find the {itemLabel}. You always know what to ask for.'
                ]),
                jealous: Object.freeze([
                    'I will find your {itemLabel}. I want this one to come from me.'
                ]),
                intimate: Object.freeze([
                    'I will take care of your {itemLabel}.',
                    'Leave the {itemLabel} with me. I have you.'
                ])
            })
        }),
        active_task: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The {itemLabel} search is open. I am still working it.',
                    'I have not closed the {itemLabel} lead yet.',
                    'The {itemLabel} is still on my list.',
                    'I am waiting on answers about the {itemLabel}.'
                ]),
                warm: Object.freeze([
                    'I am still working on your {itemLabel}.',
                    'Your {itemLabel} is still moving through my contacts.',
                    'I have not let the {itemLabel} go cold.'
                ]),
                guarded: Object.freeze([
                    'Still checking on the {itemLabel}, and keeping it quiet.',
                    'The {itemLabel} search is open, but I am moving carefully.',
                    'No safe answer on the {itemLabel} yet.'
                ]),
                hostile: Object.freeze([
                    'The {itemLabel} is still pending. You will hear when I know.',
                    'No {itemLabel} yet. Asking louder will not make one appear.',
                    'I am still looking. Wait for word on the {itemLabel}.'
                ]),
                envious: Object.freeze([
                    'Still looking for your {itemLabel}. Some requests get attention.',
                    'The {itemLabel} is still pending. Your luck has not landed yet.'
                ]),
                jealous: Object.freeze([
                    'I have not forgotten your {itemLabel}.',
                    'Still looking. I want to be the one who finds that {itemLabel}.'
                ]),
                intimate: Object.freeze([
                    'I am still on your {itemLabel}. Trust me.',
                    'Your {itemLabel} is still mine to solve.'
                ])
            }),
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'Still looking for the {itemLabel}.',
                    'No word yet on the {itemLabel}.',
                    'The {itemLabel} has not turned up yet.'
                ]),
                warm: Object.freeze([
                    'Still working on your {itemLabel}.',
                    'I am still watching for your {itemLabel}.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I am still on the {itemLabel}.',
                    'No luck yet, but I am still looking.'
                ]),
                warm: Object.freeze([
                    'I have not forgotten your {itemLabel}.',
                    'I am still chasing your {itemLabel}.'
                ]),
                guarded: Object.freeze([
                    'I am still looking, carefully, for the {itemLabel}.'
                ]),
                intimate: Object.freeze([
                    'I am still taking care of your {itemLabel}.'
                ])
            })
        }),
        remembered_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The {itemLabel} request is still in my ledger.',
                    'I still have your {itemLabel} request recorded.',
                    'Your {itemLabel} is still an open request.'
                ]),
                warm: Object.freeze([
                    'Your {itemLabel} is still in my notes. I will keep it moving.',
                    'I still have your {itemLabel} request, and I have not forgotten it.'
                ]),
                guarded: Object.freeze([
                    'The {itemLabel} request is still open, but I am keeping it quiet.',
                    'I have the {itemLabel} request. I am not spreading it around.'
                ]),
                hostile: Object.freeze([
                    'I still have the {itemLabel} request. Stop assuming I lost it.',
                    'The {itemLabel} is in my notes. Wait for the next answer.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I still remember the {itemLabel}.',
                    'The {itemLabel} is still in my notes.'
                ]),
                warm: Object.freeze([
                    'Your {itemLabel} is still on my mind.',
                    'I have your {itemLabel} written down. I will not lose it.'
                ]),
                guarded: Object.freeze([
                    'I still have the {itemLabel}. Quietly.'
                ])
            })
        }),
        offer_ready: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'I found a {itemLabel}. The offer is waiting in Communications.',
                    'A {itemLabel} came through. Review the offer in Communications.',
                    'The {itemLabel} lead is ready. Check Communications.'
                ]),
                warm: Object.freeze([
                    'Your {itemLabel} came through. The details are in Communications.',
                    'I found your {itemLabel}. Review it when you are ready.'
                ]),
                guarded: Object.freeze([
                    'A {itemLabel} is available. Read the terms before it disappears.',
                    'I have a {itemLabel} lead. Review it before anyone else asks.'
                ]),
                hostile: Object.freeze([
                    'The {itemLabel} offer is waiting. Decide before it expires.',
                    'I found the {itemLabel}. Read the offer and answer.'
                ])
            }),
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'The {itemLabel} is ready in Communications.',
                    'I found a {itemLabel}. Check the offer.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I found the {itemLabel}. Check Communications.'
                ]),
                warm: Object.freeze([
                    'I found your {itemLabel}. It is waiting for you.',
                    'Your {itemLabel} came through. Go review it.'
                ]),
                intimate: Object.freeze([
                    'I held a {itemLabel} for you. Check Communications.'
                ])
            })
        }),
        found_already: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'That {itemLabel} request is already complete.',
                    'You already accepted the {itemLabel}. A new search needs a new ask.'
                ]),
                warm: Object.freeze([
                    'You already picked up that {itemLabel}. I can look again if needed.'
                ]),
                guarded: Object.freeze([
                    'That {itemLabel} is settled. A fresh ask starts a fresh trail.'
                ]),
                hostile: Object.freeze([
                    'That {itemLabel} is done. Do not make me reopen old books.'
                ])
            }),
            personal: Object.freeze({
                warm: Object.freeze([
                    'You have the {itemLabel}. Tell me if you need another.'
                ])
            })
        }),
        failed_previous: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The last {itemLabel} search failed, but I can try another route.',
                    'No result last time. I can restart the {itemLabel} search.',
                    'The {itemLabel} did not turn up before. I can reopen it.'
                ]),
                warm: Object.freeze([
                    'I missed last time, but I can try again for your {itemLabel}.',
                    'Last pass failed. I will give the {itemLabel} another run.'
                ]),
                guarded: Object.freeze([
                    'Last search failed. I can make another careful pass for the {itemLabel}.',
                    'The {itemLabel} trail died once. I can reopen it quietly.'
                ]),
                hostile: Object.freeze([
                    'The last {itemLabel} search failed. Ask clearly if you want another.',
                    'I missed once. If you want another {itemLabel} search, say so.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I missed on the {itemLabel}. I can try again.'
                ]),
                warm: Object.freeze([
                    'I missed your {itemLabel} last time. I will try again.'
                ])
            })
        })
    }),
    check_back_locate_item: Object.freeze({
        fresh_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'No {itemLabel} request is open yet.',
                    'I do not have a live search for a {itemLabel}.',
                    'There is no active {itemLabel} request under your name.'
                ]),
                warm: Object.freeze([
                    'I do not have a {itemLabel} request from you yet.',
                    'No {itemLabel} request is open, but I can start one.'
                ]),
                guarded: Object.freeze([
                    'No quiet search is open for a {itemLabel}.',
                    'I have no active {itemLabel} request to check.'
                ]),
                hostile: Object.freeze([
                    'There is no {itemLabel} search. Ask first.',
                    'No request exists for a {itemLabel}. That is why there is no answer.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'No open {itemLabel} request yet.'
                ]),
                warm: Object.freeze([
                    'I do not have your {itemLabel} request yet, but I can take it.'
                ])
            })
        }),
        active_task: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Still no result on the {itemLabel}. I am working it.',
                    'The {itemLabel} search is active. No lead worth sending yet.'
                ]),
                warm: Object.freeze([
                    'I am still working on your {itemLabel}.',
                    'Nothing solid yet, but your {itemLabel} is still active.'
                ]),
                guarded: Object.freeze([
                    'The {itemLabel} search is active, but I am moving quietly.'
                ]),
                hostile: Object.freeze([
                    'The {itemLabel} is still pending. Wait for a real answer.'
                ])
            })
        }),
        remembered_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Yes, your {itemLabel} request is still open.',
                    'I still have the {itemLabel} request in my notes.'
                ]),
                warm: Object.freeze([
                    'Yes. Your {itemLabel} is still in my notes.',
                    'I still remember your {itemLabel}. I will send word.'
                ]),
                guarded: Object.freeze([
                    'The {itemLabel} request is still open and quiet.'
                ]),
                hostile: Object.freeze([
                    'Yes, the {itemLabel} is still written down. Wait.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I still remember the {itemLabel}.'
                ]),
                warm: Object.freeze([
                    'I still have your {itemLabel} in mind.'
                ])
            })
        }),
        offer_ready: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The {itemLabel} offer is ready in Communications.',
                    'Yes. The {itemLabel} came through. Review the offer.'
                ]),
                warm: Object.freeze([
                    'Your {itemLabel} came through. Check Communications.'
                ]),
                guarded: Object.freeze([
                    'The {itemLabel} is available, but review the terms soon.'
                ]),
                hostile: Object.freeze([
                    'The {itemLabel} is waiting. Answer before it goes away.'
                ])
            })
        }),
        found_already: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The {itemLabel} was already completed.',
                    'You already settled that {itemLabel} request.'
                ]),
                warm: Object.freeze([
                    'You already picked up that {itemLabel}. Happy to look again if needed.'
                ]),
                hostile: Object.freeze([
                    'That {itemLabel} is already handled.'
                ])
            })
        }),
        failed_previous: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The last {itemLabel} search failed. A new ask can restart it.',
                    'No lead came through last time for the {itemLabel}.'
                ]),
                warm: Object.freeze([
                    'I missed on your {itemLabel} last time. Ask again and I will retry.'
                ]),
                guarded: Object.freeze([
                    'The last {itemLabel} trail went nowhere. Reopening it needs a new ask.'
                ]),
                hostile: Object.freeze([
                    'The {itemLabel} search failed. Ask again if you want me to waste another pass.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I missed on the {itemLabel}. Ask again and I will retry.'
                ]),
                warm: Object.freeze([
                    'I missed your {itemLabel}. I can try again if you ask.'
                ])
            })
        })
    })
});

export const DIALOGUE_TEXT_PROMPT_TEMPLATE_BANKS = Object.freeze({
    request_locate_item: Object.freeze({
        fresh_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Can you source a {itemLabel}?',
                    'Can you put out word for a {itemLabel}?',
                    'Can you check your contacts for a {itemLabel}?'
                ]),
                warm: Object.freeze([
                    'Could you help me find a {itemLabel}?',
                    'Would you ask around for my {itemLabel}?'
                ]),
                guarded: Object.freeze([
                    'Can you ask quietly about a {itemLabel}?',
                    'Can you keep this quiet and look for a {itemLabel}?'
                ]),
                hostile: Object.freeze([
                    'Can you find a {itemLabel}, yes or no?',
                    'Can you get a {itemLabel} without wasting my time?'
                ])
            }),
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'Do you know anyone selling a {itemLabel}?',
                    'Could you look for a {itemLabel}?'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'Can you help me with a {itemLabel}?'
                ]),
                warm: Object.freeze([
                    'Would you help me find my {itemLabel}?'
                ]),
                intimate: Object.freeze([
                    'I need a {itemLabel}. Can you handle it for me?'
                ])
            })
        }),
        active_task: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Any movement on that {itemLabel}?',
                    'Is the {itemLabel} search still active?'
                ]),
                warm: Object.freeze([
                    'Any news on my {itemLabel}?'
                ]),
                guarded: Object.freeze([
                    'Any quiet word on the {itemLabel}?'
                ]),
                hostile: Object.freeze([
                    'Do you have an answer on the {itemLabel} yet?'
                ])
            })
        }),
        failed_previous: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Can you try the {itemLabel} search again?',
                    'Can you reopen the {itemLabel} search?'
                ]),
                warm: Object.freeze([
                    'Could you try again for my {itemLabel}?'
                ]),
                guarded: Object.freeze([
                    'Can you make one more careful pass for the {itemLabel}?'
                ]),
                hostile: Object.freeze([
                    'Restart the {itemLabel} search.'
                ])
            })
        })
    }),
    check_back_locate_item: Object.freeze({
        fresh_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Do you have a {itemLabel} request from me?',
                    'Is there an open {itemLabel} search?'
                ]),
                warm: Object.freeze([
                    'Did I already ask you about my {itemLabel}?'
                ]),
                guarded: Object.freeze([
                    'Is there a quiet request open for a {itemLabel}?'
                ]),
                hostile: Object.freeze([
                    'Do you even have a {itemLabel} request open?'
                ])
            })
        }),
        active_task: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Any update on that {itemLabel}?',
                    'Where does the {itemLabel} search stand?'
                ]),
                warm: Object.freeze([
                    'Any luck with my {itemLabel}?'
                ]),
                guarded: Object.freeze([
                    'Any safe lead on the {itemLabel}?'
                ]),
                hostile: Object.freeze([
                    'Is there a {itemLabel} lead or not?'
                ])
            })
        }),
        remembered_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'You still have my {itemLabel} request, right?',
                    'Is the {itemLabel} still on your list?'
                ]),
                warm: Object.freeze([
                    'You still remember my {itemLabel}?'
                ]),
                guarded: Object.freeze([
                    'Is my {itemLabel} request still quiet?'
                ]),
                hostile: Object.freeze([
                    'Tell me you did not lose the {itemLabel} request.'
                ])
            })
        }),
        offer_ready: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Is the {itemLabel} offer ready?',
                    'Did the {itemLabel} come through?'
                ]),
                warm: Object.freeze([
                    'You found my {itemLabel}?'
                ]),
                guarded: Object.freeze([
                    'Is the {itemLabel} offer real?'
                ]),
                hostile: Object.freeze([
                    'Show me the {itemLabel} terms.'
                ])
            })
        }),
        found_already: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'We already settled the {itemLabel}, right?'
                ]),
                warm: Object.freeze([
                    'Thanks again for finding the {itemLabel}.'
                ]),
                hostile: Object.freeze([
                    'That {itemLabel} is already done.'
                ])
            })
        }),
        failed_previous: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The {itemLabel} search failed last time?',
                    'No result on that {itemLabel}?'
                ]),
                warm: Object.freeze([
                    'No luck with my {itemLabel} last time?'
                ]),
                guarded: Object.freeze([
                    'The {itemLabel} trail went nowhere?'
                ]),
                hostile: Object.freeze([
                    'You missed on the {itemLabel}?'
                ])
            })
        })
    })
});

export const LOCATE_ITEM_RESULT_MESSAGE_ADDITIONS = Object.freeze({
    success: Object.freeze({
        worn: Object.freeze([
            'I found a worn {label} through a {source}. It has miles on it, but it works.',
            'A {source} has a worn {label}. Ugly shell, useful core.',
            'I can get you a worn {label}. The {source} says it still holds tolerance.'
        ]),
        pristine: Object.freeze([
            'I found a pristine {label} from a {source}. It is ready for immediate trade.',
            'A {source} has a pristine {label} and wants a fast answer.',
            'A pristine {label} came up through a {source}. The price matches the condition.'
        ]),
        default: Object.freeze([
            'I found a {condition} {label} through a {source}. The offer is waiting.',
            'A {source} can supply a {condition} {label}. Review it when ready.',
            'A {condition} {label} turned up. The {source} will not hold it forever.',
            'I have a {condition} {label} lead from a {source}. It is ready for review.'
        ])
    }),
    failure: Object.freeze({
        pirate_pressure: Object.freeze([
            'No lead on the {label}. Raiders have the lanes locked down.',
            'The {label} did not surface. Pirate pressure scared off the useful sellers.',
            'No reliable {label} source answered while the routes are this hot.'
        ]),
        market_pressure: Object.freeze([
            'No luck on the {label}. Sellers are holding stock or asking too much.',
            'The {label} market is too thin today. Nothing worth sending came through.',
            'No useful {label} lead. The few sellers I found wanted fantasy prices.'
        ]),
        default: Object.freeze([
            'No luck on the {label}. I will keep the names in case the market shifts.',
            'The {label} search came up empty. No lead was worth your time.',
            'I asked around for the {label}. Nobody reliable had one to spare.',
            'No source came through on the {label}. I closed this pass without an offer.'
        ])
    })
});
