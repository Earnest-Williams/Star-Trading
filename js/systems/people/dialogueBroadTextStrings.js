// Broad authored English dialogue strings. Keep this as content-only data:
// no game authority, inventory mutation, task creation, or relationship changes.

export const DIALOGUE_BROAD_LEXICON_ADDITIONS = Object.freeze({
    default: Object.freeze({
        goodLead: Object.freeze([
            'a promising lead',
            'a real trail',
            'a name worth calling',
            'a seller who may move'
        ]),
        badStock: Object.freeze([
            'dead inventory',
            'bad lots',
            'scraps at premium prices',
            'stock nobody should trust'
        ]),
        noStock: Object.freeze([
            'nothing I can release',
            'nothing I would recommend',
            'nothing in reach today',
            'nothing I can move right now'
        ]),
        askAround: Object.freeze([
            'send out feelers',
            'work my list',
            'test the market',
            'make the quiet calls'
        ]),
        heldAside: Object.freeze([
            'held in reserve',
            'kept off the open list',
            'set aside under your name',
            'kept from the public board'
        ]),
        supplier: Object.freeze([
            'a parts broker',
            'a private seller',
            'a station contact',
            'a warehouse hand'
        ]),
        difficult: Object.freeze([
            'hard to source',
            'thin across the route',
            'slow to surface',
            'rare without patience'
        ]),
        risky: Object.freeze([
            'a hot lead',
            'a trade with teeth',
            'a source with complications',
            'a route-sensitive find'
        ])
    }),
    scrapyard_plain: Object.freeze({
        goodLead: Object.freeze([
            'a hull-side lead',
            'a breaker with a maybe',
            'a crate worth opening',
            'a yard rat who knows where one sits'
        ]),
        badStock: Object.freeze([
            'burnt parts',
            'warped junk',
            'bins full of headaches',
            'metal that wants to fail'
        ]),
        noStock: Object.freeze([
            'nothing I would bolt onto a shuttle',
            'nothing but cracked casings',
            'nothing that survived inspection',
            'nothing worth carrying out'
        ]),
        askAround: Object.freeze([
            'walk the rows',
            'call the salvage crews',
            'check the strip lists',
            'see what came off the latest tow'
        ]),
        heldAside: Object.freeze([
            'kept under a work tarp',
            'stashed behind the cage',
            'left on my private rack',
            'tagged before the vultures saw it'
        ]),
        supplier: Object.freeze([
            'a salvage runner',
            'a teardown crew',
            'a back-lot breaker',
            'a hull stripper'
        ]),
        difficult: Object.freeze([
            'scarce in the yards',
            'usually stripped before it lands',
            'buried under bad pulls',
            'not something people leave lying around'
        ]),
        risky: Object.freeze([
            'a rough-yard pull',
            'a part with scorch marks',
            'a deal from the wrong end of the lot',
            'a gamble from the breaker rows'
        ])
    }),
    corporate_precise: Object.freeze({
        goodLead: Object.freeze([
            'an actionable source',
            'a vendor with available allocation',
            'a compliant channel',
            'a procurement path'
        ]),
        badStock: Object.freeze([
            'unacceptable variance',
            'inventory below threshold',
            'supply with unresolved risk',
            'quotes outside approved range'
        ]),
        noStock: Object.freeze([
            'no cleared inventory',
            'no transferable unit',
            'no approved item in local supply',
            'no release-ready stock'
        ]),
        askAround: Object.freeze([
            'open the procurement loop',
            'contact the approved vendors',
            'run a source check',
            'escalate the vendor request'
        ]),
        heldAside: Object.freeze([
            'allocated',
            'reserved pending acceptance',
            'held under provisional terms',
            'assigned for your review'
        ]),
        supplier: Object.freeze([
            'an approved channel',
            'a contract vendor',
            'a certified distributor',
            'a bonded supplier'
        ]),
        difficult: Object.freeze([
            'constrained by allocation',
            'limited by vendor availability',
            'exposed to price movement',
            'dependent on supplier response'
        ]),
        risky: Object.freeze([
            'a nonstandard procurement',
            'a variance-heavy source',
            'a channel exception',
            'a timing-sensitive acquisition'
        ])
    }),
    dock_direct: Object.freeze({
        goodLead: Object.freeze([
            'a cargo lead',
            'a crew with one listed',
            'a hold manifest worth checking',
            'a hauler who may unload'
        ]),
        badStock: Object.freeze([
            'bad crates',
            'spoiled manifests',
            'cargo nobody wants to claim',
            'overpriced dock sweepings'
        ]),
        noStock: Object.freeze([
            'nothing on the manifest',
            'nothing tied down in bay',
            'nothing crossing the dock today',
            'nothing the crews will release'
        ]),
        askAround: Object.freeze([
            'walk the berths',
            'ask the cargo crews',
            'check the unload lists',
            'talk to the bay chiefs'
        ]),
        heldAside: Object.freeze([
            'held at the bay',
            'kept under cargo lock',
            'left off the public manifest',
            'parked behind the dock office'
        ]),
        supplier: Object.freeze([
            'a cargo crew',
            'a berth broker',
            'a manifest clerk',
            'a hauler captain'
        ]),
        difficult: Object.freeze([
            'not crossing the dock often',
            'gone before the ink dries',
            'tough to hold once it lands',
            'dependent on the next freighter'
        ]),
        risky: Object.freeze([
            'a hot-dock lead',
            'a trade with dockmaster attention',
            'a cargo-floor gamble',
            'a bay deal with pressure on it'
        ])
    })
});

export const DIALOGUE_BROAD_TEMPLATE_BANKS = Object.freeze({
    request_locate_item: Object.freeze({
        fresh_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'I can open a search for a {itemLabel}. If {supplier} has one, I will hear about it.',
                    'Nothing here today, but I can {askAround} for a {itemLabel}.',
                    'I will start with my regular names and see who can move a {itemLabel}.',
                    'I can log the {itemLabel} request and run it through my vendor routes.',
                    'I will put the {itemLabel} on the sourcing ledger today.',
                    'I can check stock channels for a {itemLabel} and report back.'
                ]),
                warm: Object.freeze([
                    'I can do that. I will {askAround} for your {itemLabel}.',
                    'I will put your {itemLabel} ahead of the casual asks.',
                    'Leave it with me. I will see who can spare a {itemLabel}.',
                    'I will keep your {itemLabel} request moving until a supplier answers.',
                    'I can handle the {itemLabel} search for you.',
                    'Your {itemLabel} request gets a real pass from me.'
                ]),
                guarded: Object.freeze([
                    'I can look for a {itemLabel}, but I will keep the request narrow.',
                    'I will ask about a {itemLabel} without putting your name on the board.',
                    'I can make a quiet pass for a {itemLabel}.',
                    'I will keep the {itemLabel} request off the common route.',
                    'I can ask trusted vendors about the {itemLabel} only.',
                    'The {itemLabel} search stays narrow until I know more.'
                ]),
                hostile: Object.freeze([
                    'I can look for a {itemLabel}. Then you wait like everyone else.',
                    'Fine. I will ask about a {itemLabel}, but I am not chasing ghosts for you.',
                    'I will make the calls. Do not turn the {itemLabel} into my emergency.'
                ]),
                envious: Object.freeze([
                    'A {itemLabel}. Of course you need the thing everyone wants.',
                    'I will look for a {itemLabel}. Some requests always seem to rise to the top.'
                ]),
                jealous: Object.freeze([
                    'I will look for your {itemLabel}. I would rather you hear it from me than anyone else.',
                    'Yes, I can find a {itemLabel}. You came to the right person.'
                ]),
                intimate: Object.freeze([
                    'I will handle your {itemLabel} myself.',
                    'Leave the {itemLabel} with me. I will make it happen if anyone can.'
                ])
            }),
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'I can ask around for a {itemLabel}.',
                    'I may know someone with a {itemLabel}. Give me time.',
                    'No {itemLabel} here, but I can start looking.'
                ]),
                warm: Object.freeze([
                    'I can help you look for a {itemLabel}.',
                    'I will ask around and let you know what turns up.'
                ]),
                guarded: Object.freeze([
                    'I can ask quietly about a {itemLabel}.',
                    'I will keep the {itemLabel} question discreet.'
                ]),
                hostile: Object.freeze([
                    'I can look. Do not expect miracles on a {itemLabel}.',
                    'I will ask once and see if a {itemLabel} exists.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I will look for the {itemLabel}.',
                    'I can help with the {itemLabel}.',
                    'I will keep your request in mind while I ask.',
                    'I can take your request and look for the {itemLabel}.',
                    'I will handle it and see who has the {itemLabel}.'
                ]),
                warm: Object.freeze([
                    'I will find your {itemLabel}, or at least find out who has one.',
                    'I will make time for your {itemLabel}.',
                    'I have your request. I will handle the {itemLabel}.',
                    'I will keep the {itemLabel} in mind until I have an answer.',
                    'Leave your {itemLabel} request with me.'
                ]),
                guarded: Object.freeze([
                    'I will ask people I trust about the {itemLabel}.',
                    'Quietly, yes. I can look for the {itemLabel}.'
                ]),
                intimate: Object.freeze([
                    'I have you. The {itemLabel} is mine to chase now.',
                    'I will take care of the {itemLabel}.'
                ])
            })
        }),
        active_task: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The {itemLabel} search is active. I am waiting on replies.',
                    'No usable lead yet, but the {itemLabel} request is still open.',
                    'I have feelers out on the {itemLabel}.',
                    'The {itemLabel} request is still open on my ledger.',
                    'The {itemLabel} search is routed and pending.',
                    'No vendor has closed on the {itemLabel} yet.'
                ]),
                warm: Object.freeze([
                    'I am still working your {itemLabel}. You will hear from me.',
                    'Your {itemLabel} is still moving through my list.'
                ]),
                guarded: Object.freeze([
                    'I am still checking on the {itemLabel}, carefully.',
                    'The {itemLabel} trail is open, but I am not widening it yet.'
                ]),
                hostile: Object.freeze([
                    'No {itemLabel} yet. I said I would send word when I had something.',
                    'The {itemLabel} has not surfaced. Wait for a real answer.'
                ])
            }),
            personal: Object.freeze({
                warm: Object.freeze([
                    'I have not forgotten your {itemLabel}.',
                    'I am still on your {itemLabel}.',
                    'I have not forgotten your request.',
                    'Your request is still with me.',
                    'I am keeping your {itemLabel} in mind.'
                ]),
                intimate: Object.freeze([
                    'I am still carrying your {itemLabel} request myself.'
                ])
            })
        }),
        remembered_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Your {itemLabel} request is still recorded.',
                    'I still have the {itemLabel} on my sheet.',
                    'The {itemLabel} request has not been closed.',
                    'The {itemLabel} request remains open on my ledger.',
                    'I still have the {itemLabel} search filed for follow-up.',
                    'The {itemLabel} request is recorded and waiting on a supplier.'
                ]),
                warm: Object.freeze([
                    'Your {itemLabel} is still in my notes. I will not let it drift.',
                    'I still have your {itemLabel} marked for follow-up.',
                    'I have not forgotten your {itemLabel} request.',
                    'Your {itemLabel} is still moving through my follow-up list.',
                    'I kept your {itemLabel} request in the active notes.'
                ]),
                guarded: Object.freeze([
                    'The {itemLabel} request is still open and quiet.',
                    'I have the {itemLabel} noted, but I am keeping the circle tight.'
                ]),
                hostile: Object.freeze([
                    'I still have the {itemLabel} written down. Do not mistake silence for neglect.',
                    'The {itemLabel} is still on the list. Stop prodding.'
                ])
            }),
            personal: Object.freeze({
                warm: Object.freeze([
                    'I still have your request on file.',
                    'Your request is still recorded in my notes.',
                    'I kept the {itemLabel} on my follow-up list.'
                ])
            })
        }),
        offer_ready: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'A {itemLabel} came through. The offer is waiting in Communications.',
                    'I have a {itemLabel} available. Review the terms in Communications.',
                    'The {itemLabel} lead resolved. Check Communications before it expires.',
                    'The {itemLabel} offer is logged and ready for review.',
                    'A supplier answered on the {itemLabel}. The terms are in Communications.',
                    'The {itemLabel} sourcing request has an offer attached.'
                ]),
                warm: Object.freeze([
                    'Your {itemLabel} came through. I put the offer in Communications.',
                    'I found your {itemLabel}. Review it when you are ready.'
                ]),
                guarded: Object.freeze([
                    'A {itemLabel} is available. Read the terms before you answer.',
                    'I have a {itemLabel}, but do not let the offer sit too long.'
                ]),
                hostile: Object.freeze([
                    'The {itemLabel} is waiting. Accept it or reject it.',
                    'I found the {itemLabel}. Read the offer before someone else gets clever.'
                ])
            }),
            personal: Object.freeze({
                warm: Object.freeze([
                    'I found your {itemLabel}. It is waiting for you.',
                    'Your {itemLabel} came through. Go look at the offer.',
                    'I kept your {itemLabel} aside. Check the offer.',
                    'Your request came through. The {itemLabel} is waiting.',
                    'I found your {itemLabel} and held it for you.'
                ]),
                intimate: Object.freeze([
                    'I held your {itemLabel} aside. Check Communications.'
                ])
            })
        }),
        found_already: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'That {itemLabel} request is complete. Ask again if you need another.',
                    'You already accepted the {itemLabel}. A new search needs a new request.'
                ]),
                warm: Object.freeze([
                    'You already picked up the {itemLabel}. I can look again if you need another.'
                ]),
                guarded: Object.freeze([
                    'That {itemLabel} is settled. A new request starts a new trail.'
                ]),
                hostile: Object.freeze([
                    'The {itemLabel} is done. I am not reopening old work without a new ask.'
                ])
            })
        }),
        failed_previous: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The last {itemLabel} pass failed. I can try a different route.',
                    'No lead came through before. I can reopen the {itemLabel} search.',
                    'The {itemLabel} did not surface last time, but I can ask again.',
                    'The previous {itemLabel} search closed without stock. I can reroute it.',
                    'No vendor filled the {itemLabel} request last time. I can reopen the ledger.',
                    'The last {itemLabel} route went dry. A new request can restart it.'
                ]),
                warm: Object.freeze([
                    'I missed last time. I can take another run at your {itemLabel}.',
                    'The first pass failed, but I can keep trying for your {itemLabel}.',
                    'I have not forgotten your request. I can try the {itemLabel} again.',
                    'I will handle it if the {itemLabel} appears on another pass.',
                    'Your request stayed with me. I can look for the {itemLabel} again.'
                ]),
                guarded: Object.freeze([
                    'The last {itemLabel} trail died. I can reopen it carefully.',
                    'I can make one more quiet pass on the {itemLabel}.'
                ]),
                hostile: Object.freeze([
                    'The last {itemLabel} search failed. Ask clearly if you want another.',
                    'I missed once. I will not pretend the next pass is guaranteed.'
                ])
            }),
            personal: Object.freeze({
                warm: Object.freeze([
                    'I have not forgotten your request. I can try the {itemLabel} again.',
                    'I will handle it if the {itemLabel} appears on another pass.',
                    'Your request stayed with me. I can look for the {itemLabel} again.'
                ])
            })
        })
    }),
    check_back_locate_item: Object.freeze({
        fresh_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'No {itemLabel} search is open yet.',
                    'I do not have an active request for a {itemLabel}.',
                    'There is no live {itemLabel} request under your name.'
                ]),
                warm: Object.freeze([
                    'I do not have your {itemLabel} request yet, but I can start one.',
                    'No {itemLabel} request is open. I can take it now.'
                ]),
                guarded: Object.freeze([
                    'No quiet search is open for a {itemLabel}.',
                    'I have no discreet {itemLabel} request to check.'
                ]),
                hostile: Object.freeze([
                    'There is no {itemLabel} request. Ask first.',
                    'No {itemLabel} search exists, so there is no status to give.'
                ])
            })
        }),
        active_task: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Still active. No useful {itemLabel} lead yet.',
                    'The {itemLabel} search is still open.',
                    'No result yet, but I am still asking about the {itemLabel}.'
                ]),
                warm: Object.freeze([
                    'I am still working on your {itemLabel}.',
                    'Nothing solid yet, but your {itemLabel} has not been dropped.'
                ]),
                guarded: Object.freeze([
                    'The {itemLabel} search is still moving quietly.',
                    'No safe lead on the {itemLabel} yet.'
                ]),
                hostile: Object.freeze([
                    'No {itemLabel} yet. You will hear when I have something.',
                    'The {itemLabel} is still pending. Wait.'
                ])
            })
        }),
        remembered_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Yes. The {itemLabel} request is still in my notes.',
                    'I still have the {itemLabel} request open.'
                ]),
                warm: Object.freeze([
                    'Yes. I still have your {itemLabel} in mind.',
                    'Your {itemLabel} is still on my list.'
                ]),
                guarded: Object.freeze([
                    'The {itemLabel} request is still open and quiet.',
                    'I still have the {itemLabel} noted. I am keeping it contained.'
                ]),
                hostile: Object.freeze([
                    'Yes, the {itemLabel} is still written down. Wait for word.'
                ])
            })
        }),
        offer_ready: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The {itemLabel} offer is ready in Communications.',
                    'Yes. The {itemLabel} came through. Review the offer.',
                    'A {itemLabel} is available. The terms are waiting.'
                ]),
                warm: Object.freeze([
                    'Your {itemLabel} came through. Check Communications.',
                    'I found your {itemLabel}. The offer is ready.'
                ]),
                guarded: Object.freeze([
                    'The {itemLabel} is available, but review the terms soon.',
                    'A {itemLabel} is waiting. Do not leave it exposed.'
                ]),
                hostile: Object.freeze([
                    'The {itemLabel} is waiting. Give the offer an answer.',
                    'I found it. Now read the {itemLabel} terms.'
                ])
            })
        }),
        found_already: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'The {itemLabel} request was already completed.',
                    'You already settled that {itemLabel} request.'
                ]),
                warm: Object.freeze([
                    'You already picked up that {itemLabel}. I can help again if you ask.'
                ]),
                guarded: Object.freeze([
                    'That {itemLabel} trail is closed.'
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
                    'The {itemLabel} search failed. Ask again if you want another pass.'
                ])
            })
        })
    })
});

export const DIALOGUE_BROAD_PROMPT_TEMPLATE_BANKS = Object.freeze({
    request_locate_item: Object.freeze({
        fresh_request: Object.freeze({
            work: Object.freeze({
                neutral: Object.freeze([
                    'Can you source a {itemLabel}?',
                    'Can you put a search out for a {itemLabel}?',
                    'Can you check your list for a {itemLabel}?'
                ]),
                warm: Object.freeze([
                    'Could you help me find a {itemLabel}?',
                    'Would you ask around for my {itemLabel}?'
                ]),
                guarded: Object.freeze([
                    'Can you ask quietly about a {itemLabel}?',
                    'Can you keep this off the board and look for a {itemLabel}?'
                ]),
                hostile: Object.freeze([
                    'Can you find a {itemLabel}, yes or no?',
                    'Can you get a {itemLabel} without making this difficult?'
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

export const LOCATE_ITEM_RESULT_MESSAGE_BROAD_ADDITIONS = Object.freeze({
    success: Object.freeze({
        worn: Object.freeze([
            'I found a worn {label} through a {source}. It has scars, but the core checks out.',
            'A {source} has a worn {label}. It is not pretty, but it should hold.',
            'I can get you a worn {label}. The {source} says it still meets tolerance.'
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
