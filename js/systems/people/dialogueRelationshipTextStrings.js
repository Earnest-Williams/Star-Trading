// Authored English strings for interpersonal relationship conversations.
// Keep this file content-only: no game authority, inventory mutation, task
// creation, offer creation, reputation changes, or relationship mutation.

export const DIALOGUE_RELATIONSHIP_TEMPLATE_BANKS = Object.freeze({
    start_personal_chat: Object.freeze({
        casual_open: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'You caught me between work and pretending I was done with work. What can I do for you?',
                    'I have a few minutes. Talk to me.',
                    'No crisis in your voice. That is new. What is on your mind?',
                    'If this is not about freight, parts, or trouble, I might even enjoy it.',
                    'No open request on my desk, so conversation is an option.',
                    'I can spare a plain minute if this is just a check-in.',
                    'You are not here with a manifest. That changes the pace.'
                ]),
                warm: Object.freeze([
                    'I was hoping you would stop by without a problem to solve.',
                    'There you are. I was starting to wonder when you would come around.',
                    'I have time for you. More than I probably should admit.',
                    'You picked a good moment. I could use a better conversation.'
                ]),
                guarded: Object.freeze([
                    'You want to talk? Fine. I am listening.',
                    'I can spare a minute, but do not make me regret it.',
                    'Say what you came to say. I am not good at guessing.',
                    'A personal call? That usually means complicated.'
                ]),
                hostile: Object.freeze([
                    'If you came to waste my time, make it brief.',
                    'Talk, then. I am not in the mood for games.',
                    'You get one civil minute. Use it well.',
                    'I am listening. That is not the same thing as being pleased.'
                ]),
                envious: Object.freeze([
                    'Must be nice, having time to make social calls.',
                    'You drift in like the station opens doors for you. Talk, then.',
                    'I suppose people do make room when it is you asking.',
                    'Go on. I am curious what kind of day people like you get to have.'
                ]),
                jealous: Object.freeze([
                    'You came here first, right?',
                    'I was wondering who had your attention today.',
                    'I have time, especially if you are not making the rounds elsewhere.',
                    'Talk to me. I would rather hear it before someone else does.'
                ]),
                intimate: Object.freeze([
                    'I like when you come by for no reason.',
                    'You do not need an excuse with me.',
                    'I was hoping that look meant you wanted to stay a while.',
                    'Come closer. The room is loud, and I like hearing your voice.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'You wanted to talk. I can do that.',
                    'I am off the public channel for a minute. What is it?',
                    'All right. No ledger, no manifest. Just us talking.',
                    'I can put the day down for a moment.',
                    'I can make this about us for a minute.',
                    'I have room to hear you without the station between us.',
                    'Your voice can have my attention before the work does.'
                ]),
                warm: Object.freeze([
                    'For you, I can always make a little time.',
                    'I like this better when it is just conversation.',
                    'You have my attention. You usually do.',
                    'I am glad you came by.'
                ]),
                guarded: Object.freeze([
                    'Personal talk is not my best lane, but I will try.',
                    'I can talk. I may not say everything right.',
                    'You are asking me to lower my guard. That takes a minute.',
                    'I will hear you out. That is where I can start.'
                ]),
                jealous: Object.freeze([
                    'I am glad it was me you wanted to talk to.',
                    'I know I should not care who else you visit. I do anyway.',
                    'Stay a minute. Let everyone else wait for once.',
                    'I wanted you to choose my door.'
                ]),
                intimate: Object.freeze([
                    'I missed this. Just hearing from you.',
                    'You can have whatever time I can steal.',
                    'I am better when you are near. Do not make me say that twice.',
                    'I am happy you are here.',
                    'I like when you come to me just because you want to.',
                    'Stay a little. I wanted this kind of visit.',
                    'I am glad it is you on the other side of the door.'
                ])
            })
        }),
        getting_familiar: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'You keep showing up. I am starting to think that is deliberate.',
                    'I know your ship by sound now. That should probably worry me.',
                    'You are becoming familiar traffic around here.',
                    'I am learning your habits. You are more predictable than you think.',
                    'Your visits have become part of the station rhythm.',
                    'I recognize your timing now.',
                    'You are no longer a stranger passing through my day.'
                ]),
                warm: Object.freeze([
                    'I am getting used to you being around. That is not a complaint.',
                    'You make this place feel less temporary.',
                    'I notice when you have been gone too long.',
                    'You are easier to talk to than most people who pass through.'
                ]),
                guarded: Object.freeze([
                    'You are becoming familiar. I am deciding what to do with that.',
                    'I do not usually let people become part of my routine.',
                    'I have noticed you. That is all I am admitting today.',
                    'You keep getting close to my private business.'
                ]),
                hostile: Object.freeze([
                    'Familiar is not the same thing as trusted.',
                    'Do not mistake repeated contact for permission.',
                    'I know your face. That does not buy you much.',
                    'You are around often enough to be noticed. Be careful with that.'
                ]),
                envious: Object.freeze([
                    'You collect familiar faces everywhere, do you?',
                    'People remember you. I can see why that must be useful.',
                    'You make this look easy: walk in, smile, become someone people know.',
                    'I wonder what it is like to be welcomed so quickly.'
                ]),
                jealous: Object.freeze([
                    'I notice when you spend your time elsewhere.',
                    'You have a way of making people think they are special. I am trying not to be foolish about it.',
                    'I should not ask who else knows your schedule, but I want to.',
                    'You are becoming familiar to me. I do not want to share that easily.'
                ]),
                intimate: Object.freeze([
                    'I know the way you pause before you ask for something real.',
                    'I know your voice when you are tired. I know when you are pretending not to be.',
                    'You are not just a visitor anymore. Not to me.',
                    'I think I started saving the better parts of my day for you.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'We have talked enough that silence is not awkward anymore.',
                    'I know a little about you now. Enough to know there is more.',
                    'You are becoming someone I expect to see.',
                    'I remember what you tell me. More than I expected to.',
                    'I know the small things now, and they stay with me.',
                    'You are becoming someone I make room for.',
                    'I notice the shape you leave in my day.'
                ]),
                warm: Object.freeze([
                    'I like knowing small things about you.',
                    'I like that you keep coming back.',
                    'I am starting to look forward to these talks.',
                    'You are not background noise to me.',
                    'I like that your stories are starting to feel familiar.',
                    'I look forward to hearing what changed since last time.',
                    'You feel less like traffic and more like someone returning.'
                ]),
                guarded: Object.freeze([
                    'I am not used to wanting someone to understand me.',
                    'I do not open easily, but you keep finding seams.',
                    'Part of me wants to keep this simple. Part of me knows it is not.',
                    'You are getting closer than most.'
                ]),
                intimate: Object.freeze([
                    'You are becoming part of how I measure the day.',
                    'I trust you with more quiet than I give most people.',
                    'I like how ordinary this can feel with you.',
                    'Stay a little longer. I am not done being near you.'
                ])
            })
        }),
        personal_interest: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'I have wondered what you are like when you are not working an angle.',
                    'You talk about routes and cargo. I am more interested in what keeps you moving.',
                    'Tell me something that would not fit on a manifest.',
                    'I want to know who you are when nobody is buying or selling.',
                    'I am asking about you, not your route.',
                    'Tell me something that is not useful to a deal.',
                    'I want the version that does not belong in a report.'
                ]),
                warm: Object.freeze([
                    'I want to know more about you. Not your ship. You.',
                    'There is more to you than a captain with good timing. I would like to hear it.',
                    'Tell me something real. I will keep it safe.',
                    'I am interested in the person behind all that motion.'
                ]),
                guarded: Object.freeze([
                    'I am curious about you, which is inconvenient.',
                    'I do not ask personal questions lightly.',
                    'Tell me something true, and I may return the favor.',
                    'I want to ask more than business allows.'
                ]),
                hostile: Object.freeze([
                    'I do not know why I am curious about you. It is irritating.',
                    'There is more to you. I have not decided if that is useful or dangerous.',
                    'You make people ask questions. That is not always a compliment.',
                    'I am trying to understand what you really want.'
                ]),
                envious: Object.freeze([
                    'You have stories. I can tell. People with options always do.',
                    'I want to know what you have seen that I have not.',
                    'Tell me about one of the places that made you hard to impress.',
                    'I bet your quiet days would sound impossible to half this station.'
                ]),
                jealous: Object.freeze([
                    'I want to know what you tell people when you want them close.',
                    'Who gets the honest version of you?',
                    'I am trying not to wonder who else knows you this well.',
                    'Tell me something you do not hand out to everyone.'
                ]),
                intimate: Object.freeze([
                    'I want the parts of you that do not have to perform.',
                    'Tell me something true, and I will sit with it as long as you need.',
                    'I like learning you slowly.',
                    'I want to know the version of you that comes home tired and stops pretending.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'Tell me something about yourself that is not useful.',
                    'What do you miss when you are out on the lanes?',
                    'What kind of quiet do you look for?',
                    'Who taught you to keep moving?',
                    'Tell me something you would only say when you feel safe.',
                    'What do you carry with you when the ship is quiet?',
                    'I want to know the parts of you the lanes do not get.'
                ]),
                warm: Object.freeze([
                    'I like your stories when you forget to make them impressive.',
                    'Tell me what you wanted before the lanes got hold of you.',
                    'I want to know what makes you soften.',
                    'I am listening because I want to, not because I need something.',
                    'I like hearing about the person behind the captain.',
                    'Tell me what matters to you when nobody is asking for cargo.',
                    'I want to understand what home means to you.'
                ]),
                guarded: Object.freeze([
                    'If I ask too much, tell me. I am still learning where the edges are.',
                    'I want to know you, but I do not want to pry.',
                    'There is a question I keep almost asking.',
                    'I am not good at this kind of interest, but it is real.'
                ]),
                intimate: Object.freeze([
                    'Tell me what you need when the day has taken too much.',
                    'I want to be someone you can stop running with.',
                    'I want the unpolished story. The one you trust me with.',
                    'Let me know you past the part everyone else gets.'
                ])
            })
        }),
        flirting: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'Careful. You keep looking at me like that and I will start negotiating from advantage.',
                    'That smile has probably caused station incidents.',
                    'You are distracting when you are trying not to be.',
                    'I see why people let you talk them into bad ideas.',
                    'That look is a negotiation tactic, whether you admit it or not.',
                    'You make charm look like standard equipment.',
                    'I should charge you for distracting the room.'
                ]),
                warm: Object.freeze([
                    'You are trouble, and I am annoyed by how much I like that.',
                    'Keep smiling at me and I may forget the sensible answer.',
                    'I was trying to be professional. You are making a poor case for it.',
                    'You know exactly what you are doing, do you not?'
                ]),
                guarded: Object.freeze([
                    'Flirting with me is a dangerous use of your time.',
                    'You are pushing your luck. I have not decided whether to stop you.',
                    'I should not enjoy this as much as I do.',
                    'Do not start something unless you mean to stay with it.'
                ]),
                hostile: Object.freeze([
                    'That charm may work elsewhere. Do not count on it here.',
                    'You flirt like someone used to getting away with things.',
                    'Try substance after the smile. It might surprise us both.',
                    'Careful. I bite when people play games.'
                ]),
                envious: Object.freeze([
                    'You really do expect that smile to open doors.',
                    'I hate that the charm almost works.',
                    'People probably forgive you before you finish the sentence.',
                    'You make attention look cheap. I am trying not to spend mine.'
                ]),
                jealous: Object.freeze([
                    'Do you flirt with everyone this easily?',
                    'I want to believe that look is only for me.',
                    'Tell me I am not just another stop on your route.',
                    'I like this less when I imagine you practicing it elsewhere.'
                ]),
                intimate: Object.freeze([
                    'Come closer if you are going to look at me like that.',
                    'I have been thinking about that smile since the last time you left.',
                    'You are dangerous when you lower your voice.',
                    'I know that look. I have missed it.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'You are enjoying yourself. I can tell.',
                    'I should make you work harder for that reaction.',
                    'You have a talent for making a room smaller.',
                    'You are very pleased with yourself right now.',
                    'You know exactly how that lands with me.',
                    'I can tell when you are trying to make me smile.',
                    'You make it hard to pretend this is casual.'
                ]),
                warm: Object.freeze([
                    'I like when you flirt with me. There, I said it.',
                    'You make it difficult to keep my composure.',
                    'I missed this part of you.',
                    'I like your attention on me.',
                    'I like when you choose me for that smile.',
                    'Keep looking at me like that and I will forget my next sentence.',
                    'I missed the way you make the room feel closer.'
                ]),
                guarded: Object.freeze([
                    'Do not tease me unless you mean it.',
                    'I can handle charm. Meaning is harder.',
                    'If this is only sport, tell me before I care more.',
                    'I am not sure whether to step back or lean in.'
                ]),
                jealous: Object.freeze([
                    'I want that smile to mean something when it is aimed at me.',
                    'Tell me I get a version of you nobody else does.',
                    'I am not proud of how much I like having your attention.',
                    'I do not want to be one more person you charm and leave.'
                ]),
                intimate: Object.freeze([
                    'I like being wanted by you.',
                    'Say my name like that again and I will lose my place.',
                    'You make me forget which walls I meant to keep up.',
                    'I have been waiting for you to stop pretending this is subtle.'
                ])
            })
        })
    }),
    deepen_relationship: Object.freeze({
        romantic_tension: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'There is something here, is there not?',
                    'We keep stopping before the honest part.',
                    'I think we both know this has moved past ordinary conversation.',
                    'The silence between us has started saying too much.'
                ]),
                warm: Object.freeze([
                    'I feel it too, if that is what you came to ask.',
                    'I have been waiting for one of us to name this.',
                    'This has not felt casual to me for a while.',
                    'I wanted you to notice. I wanted you to say something.'
                ]),
                guarded: Object.freeze([
                    'I feel the pull. I am not sure I trust it yet.',
                    'This is where things get costly if we are careless.',
                    'I do not step into feelings quickly.',
                    'I know what this could become. That is why I am careful.'
                ]),
                hostile: Object.freeze([
                    'Do not dress confusion up as romance.',
                    'I am not here to be your dockside distraction.',
                    'If this is a game, stop now.',
                    'You do not get to make this intense and then pretend it was nothing.'
                ]),
                envious: Object.freeze([
                    'You can leave whenever the feeling gets inconvenient. I cannot.',
                    'People like you turn longing into another route option.',
                    'I wonder what it is like to want something and assume you can chase it.',
                    'You make possibility look unfairly easy.'
                ]),
                jealous: Object.freeze([
                    'I hate wondering who else gets this version of you.',
                    'I want to ask whether I matter more than the next port.',
                    'If this is real, I need it to be real when you are elsewhere too.',
                    'I am already too aware of every person who makes you smile.'
                ]),
                intimate: Object.freeze([
                    'I feel it every time you are close.',
                    'I have wanted to say yes to this before you asked.',
                    'This stopped being almost nothing a long time ago.',
                    'I want you, and I want whatever we are becoming.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I think we should talk about what is happening between us.',
                    'I do not want to misread this.',
                    'There is a line here, and we keep standing on it.',
                    'I need to know whether this means something to you.'
                ]),
                warm: Object.freeze([
                    'It means something to me.',
                    'I have been hoping you felt it too.',
                    'I want this to be more than timing and proximity.',
                    'You are not imagining it. I am here with you.'
                ]),
                guarded: Object.freeze([
                    'I want to move toward you, but I need honesty more than heat.',
                    'I am scared of wanting this and losing my judgment.',
                    'I can admit there is something here. I cannot pretend that makes it simple.',
                    'I need to know you will not vanish the moment this becomes real.'
                ]),
                intimate: Object.freeze([
                    'I want to stop leaving this unsaid.',
                    'I want your hand in mine when the station goes quiet.',
                    'I want the kind of closeness that survives departure schedules.',
                    'I am tired of almost touching the truth.'
                ])
            })
        }),
        affection_confessed: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'I care about you. More than is convenient.',
                    'You matter to me. I have been trying to find a sensible way to say it.',
                    'This is not casual for me anymore.',
                    'I did not plan on caring this much.'
                ]),
                warm: Object.freeze([
                    'I have feelings for you. Real ones.',
                    'I care about you in a way that keeps following me after you leave.',
                    'You have become important to me.',
                    'I want you in my life, not just passing through it.'
                ]),
                guarded: Object.freeze([
                    'I care about you, and that makes me careful.',
                    'I do not say this easily: you matter to me.',
                    'I have feelings here. I am trying not to let fear speak first.',
                    'You got past defenses I was proud of.'
                ]),
                hostile: Object.freeze([
                    'I care, and I am angry that I do.',
                    'This would be easier if you were easier to dismiss.',
                    'Do not make me regret saying you matter.',
                    'I have feelings here. Do not turn that into leverage.'
                ]),
                jealous: Object.freeze([
                    'I care about you, and I need to know I am not alone in it.',
                    'I want to be more than someone you come back to between other people.',
                    'I have feelings for you. I cannot keep pretending I only want your time when it is spare.',
                    'I want a place in your life that is not temporary.'
                ]),
                intimate: Object.freeze([
                    'I love how I feel when I am with you.',
                    'I have fallen for you. I know exactly what I am saying.',
                    'You have my heart in ways I did not expect.',
                    'I want to choose you openly.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I care about you, and I needed you to know.',
                    'I am not asking for a perfect answer. I just need to be honest.',
                    'You mean more to me than I meant to allow.',
                    'I do not want to hide behind jokes anymore.'
                ]),
                warm: Object.freeze([
                    'I care about you deeply.',
                    'I want us to be something real.',
                    'I am happier when you are near, and I miss you when you are gone.',
                    'You are not just someone I like. You are someone I choose.'
                ]),
                guarded: Object.freeze([
                    'This is hard for me to say, but you are worth the risk.',
                    'I am giving you something true. Please do not make it cheap.',
                    'I care about you enough to be frightened by it.',
                    'I want this, but I need steadiness with it.'
                ]),
                intimate: Object.freeze([
                    'I love you, or I am close enough that the distinction has stopped helping.',
                    'I want a future that makes room for both of us.',
                    'You are where my thoughts go when the day finally quiets down.',
                    'I want to be yours in a way that does not feel like losing myself.'
                ])
            })
        }),
        reassurance: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'I am not going to rush you.',
                    'We can take this one honest step at a time.',
                    'You do not have to have every answer today.',
                    'I would rather go slowly than make this fragile.'
                ]),
                warm: Object.freeze([
                    'I am here. We can figure out the rest as we go.',
                    'You are not too much trouble for me.',
                    'I do not need perfect. I need honest.',
                    'We can move at the pace that keeps this real.'
                ]),
                guarded: Object.freeze([
                    'I need patience too. That does not mean I am leaving.',
                    'I may step carefully, but I am still stepping toward you.',
                    'I can be afraid and still mean what I said.',
                    'Give me steadiness, and I will meet you there.'
                ]),
                hostile: Object.freeze([
                    'Do not ask for reassurance while sharpening the knife.',
                    'I can be patient. I will not be played.',
                    'If you want trust, stop testing it like a weak hull.',
                    'I am willing to try. Do not punish me for it.'
                ]),
                jealous: Object.freeze([
                    'I need to know I am not foolish for wanting you.',
                    'Tell me where I stand, and I can breathe again.',
                    'I can handle distance. I cannot handle being kept vague.',
                    'I do not need to own your time. I need to matter inside it.'
                ]),
                intimate: Object.freeze([
                    'Come here. I am not going anywhere right now.',
                    'You have me. Not as a performance. Not as a favor.',
                    'I choose you even on the difficult days.',
                    'Rest with me a minute. The rest can wait.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'We can be careful without being distant.',
                    'I want this to last, so I am willing to be patient.',
                    'I am not asking you to become someone else.',
                    'Let us make room for the truth and the timing.'
                ]),
                warm: Object.freeze([
                    'You are safe with my feelings.',
                    'I will not turn one hard day into the whole story.',
                    'I am still here, and I still mean it.',
                    'We can learn each other without making it a contest.'
                ]),
                guarded: Object.freeze([
                    'I need consistency more than big promises.',
                    'I can give this time if you give it care.',
                    'I am not closing the door. I am just checking the hinges.',
                    'I want to trust this slowly enough to believe it.'
                ]),
                intimate: Object.freeze([
                    'You can lean on me tonight.',
                    'I am not only here for the easy parts.',
                    'When the lanes pull you thin, come back to me as you are.',
                    'I want to be a place you do not have to armor yourself.'
                ])
            })
        }),
        parting: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'Go on, then. Before I find another reason to keep you here.',
                    'Safe routes. Come back with the ship intact.',
                    'Try not to make the news before I see you again.',
                    'I will be here when the station cycles back to quiet.'
                ]),
                warm: Object.freeze([
                    'Come back soon. I like the place better with you in it.',
                    'Safe travels. I mean that more than I usually do.',
                    'I will look for your transponder on the return board.',
                    'Bring yourself back in one piece.'
                ]),
                guarded: Object.freeze([
                    'Do not make me worry without admitting I am worried.',
                    'Take care out there. That is not sentiment. It is a practical request.',
                    'Leave before this gets harder than it needs to be.',
                    'I will not ask you to stay. I will notice that you left.'
                ]),
                hostile: Object.freeze([
                    'Try not to cause trouble I have to hear about.',
                    'Go, then. You are good at that part.',
                    'Safe routes, if only because paperwork follows wreckage.',
                    'Come back with better answers.'
                ]),
                jealous: Object.freeze([
                    'Do not make everyone else more important than coming back.',
                    'I will try not to imagine who gets your smile at the next port.',
                    'Send word when you dock. I will pretend I am not waiting for it.',
                    'Come back to me, not just back through here.'
                ]),
                intimate: Object.freeze([
                    'Kiss me before you go, even if it has to be quick.',
                    'Come back to me. That is the part I care about.',
                    'I will miss you before the bay doors close.',
                    'I will keep a light on in every way that matters.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I will see you when the route gives you back.',
                    'Go carefully.',
                    'Do not let the lanes take too much out of you.',
                    'I will be glad when you are back.'
                ]),
                warm: Object.freeze([
                    'I will miss you. Travel well.',
                    'Come back when you can. I will want to hear everything.',
                    'You leaving is the worst part of getting used to you.',
                    'Take care of yourself for me.'
                ]),
                guarded: Object.freeze([
                    'I am trying to be graceful about you leaving.',
                    'I will not make this harder. I will just mean it quietly.',
                    'Go before I say something too soft.',
                    'I care. That is all I can say without making the door heavier.'
                ]),
                intimate: Object.freeze([
                    'I will be waiting because I want to, not because I have to.',
                    'Wherever you go next, some part of me is going with you.',
                    'Come home to me when the route is done.',
                    'I love the moment before you leave least, and the moment you return most.'
                ])
            })
        })
    })
});

export const DIALOGUE_RELATIONSHIP_PROMPT_TEMPLATE_BANKS = Object.freeze({
    start_personal_chat: Object.freeze({
        casual_open: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'Do you have a minute to talk?',
                    'I wanted to check in with you.',
                    'Can we talk about something that is not work?',
                    'I had a few quiet minutes and thought of you.'
                ]),
                warm: Object.freeze([
                    'I was hoping I could steal a little of your time.',
                    'I wanted to hear your voice for a minute.',
                    'I came by because I wanted to see you.',
                    'I was hoping you would be free to talk.'
                ]),
                guarded: Object.freeze([
                    'Can we talk privately for a minute?',
                    'I am not sure how to start this, but I want to talk.',
                    'Do you have space for a personal conversation?',
                    'I wanted to say something without the whole station hearing.'
                ]),
                hostile: Object.freeze([
                    'Do you have a minute, or should I stop wasting both our time?',
                    'I need to say something, and I would rather do it directly.',
                    'Can we get one honest minute without all the posturing?',
                    'I came to talk. Do not make it harder than it needs to be.'
                ]),
                envious: Object.freeze([
                    'Do you still have a minute for me, or is everyone else ahead in line?',
                    'I wanted to catch you while you still had time to spare.',
                    'Can we talk before the rest of the station claims you again?',
                    'I thought I would see if I could get a little of your attention.'
                ]),
                jealous: Object.freeze([
                    'Do you have a minute for me first?',
                    'I wanted to talk before someone else took your time.',
                    'Can we have a private minute? Just us.',
                    'I came by because I wanted your attention on me.'
                ]),
                intimate: Object.freeze([
                    'I missed you. Can we talk?',
                    'I wanted a minute with just you.',
                    'I have been looking forward to seeing you.',
                    'Come here a second. I want to talk to you.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'Can we put work aside for a minute?',
                    'I wanted to talk to you, not your job title.',
                    'Do you have room for me right now?',
                    'I wanted to be around someone I trust.'
                ]),
                warm: Object.freeze([
                    'I wanted to spend a little time with you.',
                    'I like talking with you. Do you have a minute?',
                    'I came here because this is where I wanted to be.',
                    'Can I stay a while?'
                ]),
                guarded: Object.freeze([
                    'Can we talk somewhere quieter?',
                    'I wanted to say something personal without an audience.',
                    'Do you have room for a careful conversation?',
                    'I wanted a minute that felt more private than this place usually allows.'
                ]),
                hostile: Object.freeze([
                    'Can we skip the small talk and just be honest for a minute?',
                    'I came to talk to you, not stand here circling the point.',
                    'Do you have room for one direct conversation?',
                    'I need a minute with you, assuming that is still allowed.'
                ]),
                envious: Object.freeze([
                    'I wanted a little time with you before someone else claimed it.',
                    'Can I borrow you for a minute, if the station can spare you?',
                    'I came by because I wanted to be the person you talked to right now.',
                    'Do you have room for me before the rest of this place gets in the way?'
                ]),
                jealous: Object.freeze([
                    'Can I have a little time with you before anyone else does?',
                    'I wanted to catch you alone for once.',
                    'Do you have room for me, specifically me, right now?',
                    'I came here because I wanted your attention to stay with me.'
                ]),
                intimate: Object.freeze([
                    'I needed to be near you for a minute.',
                    'I wanted your attention on me, if you can spare it.',
                    'I missed this. Us.',
                    'Can I have you to myself for a little while?'
                ])
            })
        }),
        getting_familiar: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'I think I am starting to know you.',
                    'You are becoming familiar to me.',
                    'I noticed I look for you when I dock here.',
                    'I have started remembering the small things you say.'
                ]),
                warm: Object.freeze([
                    'I like that we are getting used to each other.',
                    'I missed our talks while I was away.',
                    'I am starting to look forward to seeing you.',
                    'You are becoming part of my routine in a good way.'
                ]),
                guarded: Object.freeze([
                    'I think I am letting you get closer than I planned.',
                    'I do not usually get familiar this quickly.',
                    'You have started to matter more than I expected.',
                    'I am trying to understand what this is becoming.'
                ]),
                hostile: Object.freeze([
                    'You have gotten familiar enough that pretending otherwise feels pointless.',
                    'I notice when you are around. Make of that what you want.',
                    'You have become hard to ignore, which is not always convenient.',
                    'I am used to you now. That does not mean I know what to do with it.'
                ]),
                envious: Object.freeze([
                    'I keep noticing how easily you make yourself part of a place.',
                    'You are becoming familiar in a way I cannot quite stop measuring.',
                    'I notice when you dock here, even if I try not to make much of it.',
                    'I am getting used to you, and that does strange things to my perspective.'
                ]),
                jealous: Object.freeze([
                    'I have started noticing when your routine does not include me.',
                    'You are becoming familiar enough that I miss you when you go elsewhere.',
                    'I look for you more than I should admit.',
                    'I am getting used to you, and I am not eager to share that.'
                ]),
                intimate: Object.freeze([
                    'I notice when you are not around.',
                    'I keep saving stories to tell you.',
                    'I think of you when the ship goes quiet.',
                    'I like how natural this feels with you.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I think we have become familiar in a way I actually like.',
                    'You feel less like a stop on the route and more like part of it now.',
                    'I have started expecting to see you.',
                    'You have become one of the people I carry with me.'
                ]),
                warm: Object.freeze([
                    'I like how natural this is getting with you.',
                    'I miss you in small ways now, which feels important.',
                    'I have started looking forward to you more than I planned.',
                    'You feel familiar in a way that makes the station easier to come back to.'
                ]),
                guarded: Object.freeze([
                    'I am not used to someone feeling this familiar this quickly.',
                    'You are getting closer to me than most people manage.',
                    'I am trying not to flinch at how much I notice you now.',
                    'This is becoming familiar enough to matter.'
                ]),
                hostile: Object.freeze([
                    'You have gotten under my guard enough to feel familiar, which is irritating.',
                    'I am used to you now, whether that was smart or not.',
                    'You have become part of my thinking. I am not thrilled by how easily that happened.',
                    'I know your absence too well for someone I keep arguing with.'
                ]),
                envious: Object.freeze([
                    'You have become familiar to me, and I still do not know how you make it look so easy.',
                    'I notice the space you take up in my day more than I expected.',
                    'You have become one of the people I measure the room against.',
                    'I am getting used to you, and that comes with more feeling than I planned.'
                ]),
                jealous: Object.freeze([
                    'You have become familiar enough that I hate sharing your attention.',
                    'I know when you are gone, and I notice where I think you might be instead.',
                    'I have gotten used to you in a way that makes me possessive.',
                    'You matter enough now that I miss you before I mean to.'
                ]),
                intimate: Object.freeze([
                    'You feel familiar in the ways that matter most to me.',
                    'I have started carrying you with me between stops.',
                    'You have become part of my quiet, and I do not want to lose that.',
                    'Being close to you is starting to feel like the natural state of things.'
                ])
            })
        }),
        personal_interest: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'I want to know more about you.',
                    'Tell me something about yourself.',
                    'What are you like when you are not working?',
                    'What keeps you here?'
                ]),
                warm: Object.freeze([
                    'I want to know the real version of you.',
                    'Tell me something you do not tell every passing captain.',
                    'I am interested in you, not just what you can do.',
                    'What should I know about the person behind the counter?'
                ]),
                guarded: Object.freeze([
                    'Can I ask you something personal?',
                    'Tell me if I am asking too much, but I want to know you better.',
                    'I am curious about you in a way that is hard to ignore.',
                    'Would you tell me something real?'
                ]),
                hostile: Object.freeze([
                    'Tell me something real, if that is not too much to ask.',
                    'I want to know what is actually true about you.',
                    'What are you like when the performance drops away?',
                    'I am asking because I would rather understand you than keep guessing.'
                ]),
                envious: Object.freeze([
                    'Tell me something about the life that made you this hard to ignore.',
                    'What did you get to want before the lanes narrowed things down?',
                    'I want to hear one story only you could have lived.',
                    'What part of your life would someone like me envy most?'
                ]),
                jealous: Object.freeze([
                    'Tell me something real that you do not give to everyone.',
                    'What part of you gets saved for the people who matter?',
                    'I want to know the version of you that is not for public trade.',
                    'Who do you let close, really?'
                ]),
                intimate: Object.freeze([
                    'I want to know what matters to you.',
                    'Tell me the part of you people miss when they rush past.',
                    'I want to understand you slowly.',
                    'What would make you feel less alone here?'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'What matters to you when nobody is asking for anything?',
                    'Tell me something about yourself that feels real.',
                    'What part of your life do you miss when you are moving?',
                    'What do you want when you stop being useful for a minute?'
                ]),
                warm: Object.freeze([
                    'I want to know what softens you.',
                    'Tell me something I would only learn by staying.',
                    'What kind of life would make you feel at ease?',
                    'I want to know the part of you that does not have to impress anyone.'
                ]),
                guarded: Object.freeze([
                    'Can I ask something personal without pushing too hard?',
                    'Tell me if this crosses a line, but I want to know you better.',
                    'I am trying to ask with care: what matters most to you?',
                    'Would you trust me with something honest?'
                ]),
                hostile: Object.freeze([
                    'I want the truth, not the polished version.',
                    'Tell me something honest before I invent the worst answer.',
                    'What matters to you when no one is watching?',
                    'Give me something real to work with.'
                ]),
                envious: Object.freeze([
                    'Tell me about something you got to want that I never did.',
                    'What part of your life would be hardest for anyone else to understand?',
                    'I want to hear about the place or person that still has hold of you.',
                    'What do you miss that the rest of us only imagine?'
                ]),
                jealous: Object.freeze([
                    'Tell me something you only trust certain people with.',
                    'What do you share when someone actually gets close to you?',
                    'I want to know the part of you that is not for everyone else.',
                    'What does someone have to earn before you let them know you?'
                ]),
                intimate: Object.freeze([
                    'Tell me what you need when the day has taken too much.',
                    'I want to know what home feels like to you.',
                    'What part of you still wants to be understood?',
                    'Let me hear the story you save for the quiet hours.'
                ])
            })
        }),
        flirting: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'You know, you are difficult to walk away from.',
                    'I was trying to be professional, but you make that difficult.',
                    'Do you always make people forget why they came in?',
                    'I am starting to think visiting you is bad for my schedule.'
                ]),
                warm: Object.freeze([
                    'I like when you smile at me like that.',
                    'You are trouble. I came back anyway.',
                    'I was hoping you would notice me.',
                    'I like having your attention.'
                ]),
                guarded: Object.freeze([
                    'Tell me if I am reading this wrong.',
                    'I am flirting with danger here, am I not?',
                    'I do not want to play games with you.',
                    'If this is only banter, I should probably know.'
                ]),
                hostile: Object.freeze([
                    'If you are going to stare at me like that, own it.',
                    'Tell me whether this is real or just another game.',
                    'You make it hard to tell whether I should lean in or walk away.',
                    'If this is flirting, say it with your whole chest.'
                ]),
                envious: Object.freeze([
                    'Do you smile like that at everyone, or am I allowed to be curious?',
                    'I want to know whether that look means anything when it lands on me.',
                    'You make attention look effortless. It is unfair.',
                    'I am trying not to wonder how many people get this version of you.'
                ]),
                jealous: Object.freeze([
                    'Tell me that look is for me.',
                    'I would like to know whether you do this with everyone else too.',
                    'If you are flirting, I want to know I am not sharing the moment.',
                    'You are making me wonder who else gets this smile.'
                ]),
                intimate: Object.freeze([
                    'I have been thinking about that look you gave me.',
                    'I wanted to see if you missed this too.',
                    'Come closer. I want to say this quietly.',
                    'I like how you look at me when nobody else is watching.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'You make it very hard to keep this casual.',
                    'I think about you more than I should.',
                    'I like what happens to the room when you are in it.',
                    'You know exactly what you are doing to me.'
                ]),
                warm: Object.freeze([
                    'I missed flirting with you.',
                    'I like the way we circle each other.',
                    'I am trying not to smile too much around you.',
                    'You make me want to linger.'
                ]),
                guarded: Object.freeze([
                    'Tell me if I am stepping too close to the truth.',
                    'I do not want this to be a game between us.',
                    'I am flirting, but not casually.',
                    'If I am being obvious, I would rather you know it is intentional.'
                ]),
                hostile: Object.freeze([
                    'If this is going somewhere, I want honesty more than charm.',
                    'You have me off-balance. I am trying not to resent how much I like it.',
                    'Stop smiling at me like that unless you mean it.',
                    'I want to know whether this is real before I give in to it.'
                ]),
                envious: Object.freeze([
                    'You make being desired look easy, and I hate how much I notice.',
                    'I want to know whether this attention of yours is actually rare.',
                    'You make me curious in ways that feel unfair.',
                    'I am trying not to compare myself to everyone else who notices you.'
                ]),
                jealous: Object.freeze([
                    'If you are going to flirt with me, do not split that smile with the whole station.',
                    'I like your attention best when it stays on me.',
                    'You make me want to be the only person getting this version of you.',
                    'I want to know that this is mine for a minute.'
                ]),
                intimate: Object.freeze([
                    'I want you closer than this.',
                    'I like wanting you.',
                    'I have been waiting to stop pretending this is subtle.',
                    'I want the kind of attention you do not give everyone.'
                ])
            })
        })
    }),
    deepen_relationship: Object.freeze({
        romantic_tension: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'There is something between us, is there not?',
                    'I think we should talk about what this is becoming.',
                    'I do not want to keep pretending this is only friendly.',
                    'Do you feel this too?'
                ]),
                warm: Object.freeze([
                    'I feel something here, and I think you do too.',
                    'I want this to be more than almost.',
                    'I have been waiting for the right time to say this.',
                    'This means something to me.'
                ]),
                guarded: Object.freeze([
                    'I do not want to misread you.',
                    'I want to be honest, but I need to know where you stand.',
                    'This matters enough that I do not want to guess.',
                    'Can we talk about us without dodging the hard part?'
                ]),
                hostile: Object.freeze([
                    'There is clearly something here. I am tired of pretending otherwise.',
                    'If this matters, I want the truth instead of another sidestep.',
                    'Tell me plainly whether this is real or not.',
                    'I do not have patience for half-honest feelings.'
                ]),
                envious: Object.freeze([
                    'You make connection look easier than it feels from my side.',
                    'There is something here, and I want to know whether I imagined the imbalance.',
                    'I want to stop wondering how many other people get this version of you.',
                    'This means enough to me that comparison is starting to poison it.'
                ]),
                jealous: Object.freeze([
                    'If there is something between us, I need to know it is not shared out casually.',
                    'Do you feel this too, or am I only one stop in a longer line?',
                    'I want to know whether this matters to you the way it does to me.',
                    'Tell me whether this is ours before I let it become more.'
                ]),
                intimate: Object.freeze([
                    'I want you, and I want to know if you want this too.',
                    'I am tired of almost saying what I mean.',
                    'I want to choose this with you, not stumble into it.',
                    'I want us to stop pretending this is small.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'There is something here, and I do not want to keep walking around it.',
                    'I think this between us has become too real to ignore.',
                    'I want to talk about what we are becoming.',
                    'Do you feel how close to changing this is?'
                ]),
                warm: Object.freeze([
                    'I want this to become something honest with you.',
                    'I think we are standing at the edge of something good.',
                    'I want to know whether you feel this pulling too.',
                    'This has started to matter to me in a real way.'
                ]),
                guarded: Object.freeze([
                    'I need to know if I am reading us right.',
                    'I want to be honest, but I do not want to step alone.',
                    'This matters enough that I am scared of guessing wrong.',
                    'Can we talk about what this is without either of us hiding?'
                ]),
                hostile: Object.freeze([
                    'I am done pretending this tension is not there.',
                    'If this matters, then say it straight.',
                    'I want the truth about us, not another careful dodge.',
                    'Tell me whether I am wasting my heart here.'
                ]),
                envious: Object.freeze([
                    'I want to know whether this feels as uneven to you as it sometimes does to me.',
                    'This means enough that I keep comparing it to what everyone else seems to have.',
                    'I need to know whether I am imagining the distance between us.',
                    'Tell me whether this is real before envy makes a mess of it.'
                ]),
                jealous: Object.freeze([
                    'If this is becoming something, I need to know I am not sharing your heart by accident.',
                    'I want to hear whether this is ours to claim.',
                    'Tell me whether I matter to you in a way that changes the rest.',
                    'I need to know if I am the one you want here.'
                ]),
                intimate: Object.freeze([
                    'I want to stop circling this and choose you out loud.',
                    'This feels too important to leave half-said.',
                    'I want to know whether we can call this love before it slips by.',
                    'Tell me if your heart is reaching for mine too.'
                ])
            })
        }),
        affection_confessed: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'I care about you.',
                    'You matter to me more than I expected.',
                    'This is not casual for me anymore.',
                    'I needed you to know how I feel.'
                ]),
                warm: Object.freeze([
                    'I have real feelings for you.',
                    'I want you in my life.',
                    'I care about you deeply.',
                    'I think I am falling for you.'
                ]),
                guarded: Object.freeze([
                    'This is hard for me to say, but I care about you.',
                    'I am giving you something honest because you matter.',
                    'I do not say this lightly: I have feelings for you.',
                    'I am afraid of how much I want this, but I still want it.'
                ]),
                hostile: Object.freeze([
                    'Fine. Here is the truth: I care about you.',
                    'I am done pretending this does not matter to me.',
                    'You have gotten past my defenses. I need you to know that.',
                    'I care about you whether that is convenient or not.'
                ]),
                envious: Object.freeze([
                    'I care about you, even when the feeling makes me compare too much.',
                    'You matter to me more than is comfortable to admit.',
                    'I have feelings for you, and they make me want more than I have.',
                    'I care about you enough that it changes the way I see everything else.'
                ]),
                jealous: Object.freeze([
                    'I care about you, and I hate how much I want to keep that feeling close.',
                    'You matter to me enough that I want to be chosen back.',
                    'I have feelings for you that do not leave much room for pretending otherwise.',
                    'I care about you, and I want to know I matter that way to you too.'
                ]),
                intimate: Object.freeze([
                    'I love you.',
                    'I want to build something real with you.',
                    'I choose you.',
                    'I want a future that has room for us.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I need to tell you that I care about you.',
                    'This is real for me now.',
                    'You matter to me in a way I cannot keep treating lightly.',
                    'I wanted you to hear from me that this is love, or close enough to frighten me.'
                ]),
                warm: Object.freeze([
                    'I care about you, and I am done hiding it.',
                    'I want us to be real.',
                    'I want to be with you.',
                    'My heart keeps finding its way back to you.'
                ]),
                guarded: Object.freeze([
                    'This is difficult for me, but it is true: I care about you deeply.',
                    'I am trusting you with the fact that my heart is involved now.',
                    'I do not say this easily, but I have fallen for you.',
                    'I am scared to hand you this truth, but it is yours anyway.'
                ]),
                hostile: Object.freeze([
                    'I care about you. There, it is said.',
                    'You have become important to me, and I am tired of fighting it.',
                    'I love you enough to stop hiding behind sharp edges.',
                    'I want you to know exactly what you have done to me.'
                ]),
                envious: Object.freeze([
                    'I care about you, and sometimes the wanting of it all gets tangled up in envy.',
                    'You matter to me enough that I keep measuring what I fear losing.',
                    'I love you, even when it makes me feel smaller than I want to admit.',
                    'My feelings for you are real, even when they bring out the messier parts of me.'
                ]),
                jealous: Object.freeze([
                    'I care about you enough to want your heart turned toward me.',
                    'I love you, and part of me is terrified of not being your first choice.',
                    'You matter to me in the possessive, vulnerable way I never planned on.',
                    'I want to be yours, not one option among many.'
                ]),
                intimate: Object.freeze([
                    'I love you, and I want you to hear it from me.',
                    'I want to be yours in a way that feels true.',
                    'I want to come back to you and have that mean home.',
                    'I want us, not just moments of us.'
                ])
            })
        }),
        reassurance: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'We can take this slowly.',
                    'I do not need every answer today.',
                    'I want this to be honest, not rushed.',
                    'We can figure it out together.'
                ]),
                warm: Object.freeze([
                    'I am here, and I mean that.',
                    'You are worth patience.',
                    'I do not need perfect. I need real.',
                    'We can move at our own pace.'
                ]),
                guarded: Object.freeze([
                    'I need steadiness more than promises.',
                    'I want to trust this carefully.',
                    'I can wait if we are both being honest.',
                    'I am not running. I am just scared.'
                ]),
                hostile: Object.freeze([
                    'I am still here. That is the part that matters.',
                    'I do not need polished promises. I need you to mean what you say.',
                    'We can do this honestly, even if it is not graceful.',
                    'I am not leaving just because this is difficult.'
                ]),
                envious: Object.freeze([
                    'I know comparison can poison good things. I still want this.',
                    'We do not need what anyone else has. We need what is real for us.',
                    'I want this enough to stay steady through the uglier feelings.',
                    'Even when I feel the imbalance, I still want to build something true with you.'
                ]),
                jealous: Object.freeze([
                    'I am here. Let that count for something solid.',
                    'You do not have to prove everything at once. Just keep choosing this with me.',
                    'I want to trust what we have without clutching it too hard.',
                    'Stay honest with me, and I will stay with you.'
                ]),
                intimate: Object.freeze([
                    'I am with you.',
                    'You can rest with me.',
                    'I choose you on the difficult days too.',
                    'Come back to me as you are.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'We do not need every answer tonight.',
                    'I want to keep choosing this carefully with you.',
                    'We can take the next step without rushing the whole road.',
                    'I am here for the honest version of this.'
                ]),
                warm: Object.freeze([
                    'We can move gently and still mean it.',
                    'I am here, and I am not in a hurry to lose this.',
                    'I want to build this in a way that feels safe for both of us.',
                    'You do not have to be perfect for me to stay.'
                ]),
                guarded: Object.freeze([
                    'I am willing to move slowly if it keeps this honest.',
                    'I need steadiness, but I am still here.',
                    'We can be careful without being afraid of each other.',
                    'I want to trust this one truthful step at a time.'
                ]),
                hostile: Object.freeze([
                    'I am staying. Let us start there.',
                    'We can get through the rough edges without pretending they are not rough.',
                    'I want honesty more than reassurance dressed up as poetry.',
                    'This is hard, but I am not backing away.'
                ]),
                envious: Object.freeze([
                    'Even when I compare, I still want what is ours.',
                    'I know envy can get loud. I do not want it deciding this for us.',
                    'We do not need to look like anyone else to be real.',
                    'I want to keep choosing us over the uglier thoughts.'
                ]),
                jealous: Object.freeze([
                    'I want to trust this without squeezing it too tightly.',
                    'Keep being honest with me, and I can quiet the worst parts of myself.',
                    'I am here because I want to believe in what we are building.',
                    'Stay with me in the truth of this, and I will stay with you.'
                ]),
                intimate: Object.freeze([
                    'Rest here with me. We do not have to solve everything tonight.',
                    'I am not afraid of taking this slowly if it means taking it with you.',
                    'You can bring me the scared parts too.',
                    'I choose us, even while we are still learning how.'
                ])
            })
        }),
        parting: Object.freeze({
            neutral: Object.freeze({
                neutral: Object.freeze([
                    'I should go before this gets harder.',
                    'I will see you when I get back.',
                    'Safe routes until next time.',
                    'I will send word when I dock.'
                ]),
                warm: Object.freeze([
                    'I will miss you.',
                    'Come see me when I get back?',
                    'I already want to return.',
                    'Take care of yourself until I see you again.'
                ]),
                guarded: Object.freeze([
                    'I am trying not to make leaving harder than it is.',
                    'I will be careful out there.',
                    'I will come back when the route lets me.',
                    'Do not forget me too quickly.'
                ]),
                hostile: Object.freeze([
                    'I am leaving now. Do not make this harder than it already is.',
                    'I will come back. That will have to be enough for today.',
                    'Take care of yourself while I am gone.',
                    'I hate this part, so let us keep it honest and brief.'
                ]),
                envious: Object.freeze([
                    'I am going, and I am trying not to resent how easy staying seems for other people.',
                    'I will be back. I just wish leaving looked simpler from my side.',
                    'Take care of what I have to leave behind for a while.',
                    'I already miss what other people get to keep.'
                ]),
                jealous: Object.freeze([
                    'I am going. Try not to give my place away while I am gone.',
                    'I will come back, so save some of that warmth for me.',
                    'Do not make me picture someone else taking my goodbye.',
                    'I already miss you, and I am not even out the door yet.'
                ]),
                intimate: Object.freeze([
                    'Kiss me before I go.',
                    'I will come back to you.',
                    'I will miss you before the bay doors close.',
                    'Wait for me because you want to.'
                ])
            }),
            personal: Object.freeze({
                neutral: Object.freeze([
                    'I will come back as soon as the route lets me.',
                    'Take care until I see you again.',
                    'I will be thinking of you on the way out.',
                    'The leaving is easier if I know I am coming back to you.'
                ]),
                warm: Object.freeze([
                    'I hate leaving you.',
                    'I will carry this with me until I am back.',
                    'I want the next hello already.',
                    'I will take care of myself for you.'
                ]),
                guarded: Object.freeze([
                    'I am trying to leave without making it harder than it has to be.',
                    'I will come back. I just need to get through the leaving first.',
                    'Take care of yourself while I am gone, and I will do the same.',
                    'I mean more in this goodbye than I am saying out loud.'
                ]),
                hostile: Object.freeze([
                    'I am going, and I hate how much that matters.',
                    'I will come back. Let that be the promise for now.',
                    'Do not make me drag this goodbye out any further.',
                    'I care enough that leaving puts me in a foul mood.'
                ]),
                envious: Object.freeze([
                    'I wish I were the one who got to stay with you.',
                    'I will come back, even if I envy anyone who gets your time while I am gone.',
                    'Leaving you makes me resent the distance before it even starts.',
                    'Take care of the part of my heart I am leaving here.'
                ]),
                jealous: Object.freeze([
                    'I am leaving, and I already hate the idea of anyone else getting the time I want.',
                    'Save the best of your welcome for when I come back.',
                    'I will return, so do not let anyone else take up too much of my space with you.',
                    'Part of me wants to stay just so I do not have to share you with the distance.'
                ]),
                intimate: Object.freeze([
                    'I love you. I will come back.',
                    'Come home to me when your shift ends, and I will come home to you when the route does.',
                    'I am yours across the distance too.',
                    'The best part of leaving will be coming back to you.'
                ])
            })
        })
    })
});
