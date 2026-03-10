+++
title = "Empathy Architecture: Designing LLM Outputs That Don't Feel Like Surveillance"
description = "\"After you close the laptop\" vs \"Your Evening Wind-Down\" — why the difference matters, and how to build systems that infer emotion without weaponising it."
date = 2026-03-10

[taxonomies]
tags = ["personalization", "design", "llm-outputs", "user-experience"]
series = ["tier-1-opinions"]

[extra]
reading_time = "12 min"
+++

## The One-Sentence Version

An LLM can know you're anxious without telling you it knows — and that distinction is the entire difference between a system that feels like a thoughtful friend and one that feels like a CCTV camera that's learned to make small talk.

{% callout(type="tldr") %}
**The principle:** Use {{ glossary(term="qualitative signals", def="Signals derived from intention, meaning, and narrative context — what someone is trying to do, how something made them feel, where they're going emotionally. Cannot be expressed as a number without losing the point.") }} (intentions, resolutions, through-lines) to personalise outputs. Never {{ glossary(term="quantitative signals", def="Signals expressed as measurable quantities — time of day, play count, session length, click-through rate. Accurate, auditable, and capable of making users feel like inventory items.") }} (time of day, play count, session duration).

**The test:** Could this copy have been written by a dashboard? If yes, it's wrong.

**The architecture:** {{ glossary(term="emotional state inference", def="The process by which an LLM derives a user's likely emotional context from behavioural patterns, content choices, and interaction history — used internally for ranking and personalisation, never surfaced to users.") }} is a first-class internal concern. It must never become a user-facing concern.
{% end %}

---

## The Problem: Personalisation That Feels Like Being Watched

Here's a scenario. It's 10:43 PM. You've been working since 7 AM, you just closed a difficult project, and you open a music app. The app, which has been tracking your listening patterns for three years, surfaces a playlist called **"Your Late-Night Wind-Down Playlist"**.

It knows it's late. It knows you're probably tired. It's being *helpful*.

And yet something is wrong.

The wrongness is subtle — the kind of wrongness that makes you close the app and open Spotify instead without quite knowing why. You weren't disturbed exactly. You weren't offended. You just felt, faintly, like a metric. Like someone had access to your bathroom and chose to leave a note about your hygiene habits.

Now consider the alternative. Same moment, same data, different output: the app surfaces an album you listened to obsessively during a difficult project six months ago, or recommends something the artist described as "music for when you've just survived something." No mention of the time. No mention of your habits. The system *knows* you're winding down; it just doesn't say so.

That's the difference between {{ glossary(term="surveillance language", def="Copy or UI text that exposes the system's knowledge of a user's behavioural patterns — time-based labels, frequency references, habit callouts. Technically accurate, socially wrong.") }} and {{ glossary(term="empathy-not-surveillance", def="A design principle: the system should act on emotional inference without exposing it. The output should feel attuned, not monitored.") }}.

{% callout(type="warning") %}
The failure mode isn't malice. It's a product team that optimised for *demonstrating personalisation* rather than *delivering it*. There's a difference between making a user feel understood and making a user feel observed. Systems that label their inference — "Based on your 11 PM listening habits..." — are accidentally confessing to surveillance while attempting intimacy.
{% end %}

---

## The Architecture Problem

This isn't just a copy problem. It's an architectural problem, and it starts with a category error that gets baked into systems early and then defended forever.

The category error: treating emotional state inference as a feature to expose rather than a capability to use.

Most personalisation systems are built around explicit signals: you listened to this, you bought that, you opened the app at this time. The outputs then *reference* those signals because the signals feel like proof of personalisation. "Based on your recent listening" is the system showing its work, trying to earn trust by demonstrating that it's paying attention.

But this is backwards. Trust doesn't come from demonstrating surveillance. Trust comes from being useful in exactly the right way at exactly the right moment — without explaining how you knew.

{% callout(type="insight") %}
Consider how humans do this. A good friend who knows you've had a hard week doesn't say "Based on the last three conversations and the tone of your texts, I've inferred you're experiencing elevated stress." They suggest a walk, or bring food, or just sit with you. The inference is invisible. The care is visible.

LLM outputs should work the same way. The model's reasoning — including its emotional state estimates — belongs in the system's internals, not in the user-facing copy.
{% end %}

### The Two-Layer Model

Here's the architecture that actually works:

**Layer 1: Inference Engine (internal)**

This is where the LLM earns its keep. Feed it {{ glossary(term="through-lines", def="Persistent narrative threads in a user's content history — recurring themes, emotional arcs, ongoing interests that span multiple sessions and signal meaning rather than just behaviour.") }}: the recurring themes in someone's reading history, the emotional arcs in their music consumption, the projects they return to when they're stuck. Let it build a rich internal model of where this person is and where they're trying to go.

This layer can be brutally honest internally. "User appears to be processing a significant loss. Content skewing toward comfort-seeking. Suggest familiar over novel." That's a valid internal inference. It's a useful ranking signal. It is absolutely not something that should appear in a notification.

**Layer 2: Output Layer (user-facing)**

This layer translates internal inference into outputs that are attuned without being exposing. The ranking is informed by Layer 1. The copy is not. The output should feel like a happy accident — like the system happened to surface exactly the right thing at the right moment, not like it's been studying you.

{% callout(type="warning") %}
**The leakage test:** If you can read a piece of user-facing copy and work backwards to the emotional state inference that produced it, you have a leakage problem. The output has exposed the inference. Rewrite until the inference is invisible but the attunement is still there.
{% end %}

---

## Qualitative vs Quantitative: The Signal Problem

The signal choice is upstream of everything else, and most systems get it wrong by defaulting to whatever's easiest to measure.

Quantitative signals are seductive because they're auditable. "User opened app 47 times this month" is a fact. It fits in a column. It can be aggregated, trended, fed into a model, reported in a board meeting. Quantitative signals feel rigorous.

They also produce outputs that feel like inventory management.

"You've listened to this artist 23 times this month!" is not warmth. It's a receipt. "Your most-played genre this week is ambient" is not insight. It's a spreadsheet. These outputs make users feel like data because they *are* data — the system has simply taken its database query and printed it on the screen.

Qualitative signals are harder to extract and harder to defend in a quarterly review, but they're the difference between a system that understands people and a system that catalogues them.

{% callout(type="insight") %}
**What qualitative signals actually look like:**

- Not "played 23 times" but "returns to this album when [inferred context]"
- Not "active at 11 PM" but "seeks [content type] when transitioning out of work"
- Not "genre: ambient" but "drawn to music with space and deceleration"
- Not "skipped 8 tracks" but "searching for something specific, not finding it"

None of these fit cleanly in a SQL column. All of them are more useful for producing outputs that feel human.
{% end %}

The practical implementation: use LLMs for signal extraction, not just output generation. A cheap inference pass over a user's interaction history — asking "what is this person trying to do, what emotional state does their behaviour suggest, what through-lines are present?" — produces richer, more actionable signals than any amount of click-counting.

{% cite(key="contextual-integrity", title="Privacy as Contextual Integrity", authors="Nissenbaum, H.", year=2004, url="https://digitalcommons.law.uw.edu/wlr/vol79/iss1/10") %}

This is the framework: information flows appropriately when they match the norms of the context in which information was originally shared. A user's 11 PM listening habits were shared in the context of getting music recommendations. Turning that into a label on a playlist crosses a contextual boundary, even if it's technically accurate.

---

## What's New Here

This isn't an argument against personalisation. It's an argument for a specific architectural decision that most teams treat as a design preference when it's actually a technical constraint.

The constraint: **emotional state inference and user-facing output are different systems, and they must be kept separate.**

When teams build personalisation, they typically treat inference and output as a single pipeline: observe behaviour → derive insight → express insight in output. The expression step is where the surveillance language enters. Fixing it requires understanding that the insight is *never* meant for the user. The insight is meant for the ranking algorithm. The output is meant for the user. These are different things.

This sounds obvious when stated plainly. It is apparently not obvious in practice, because the "based on your listening habits" pattern is everywhere, and every single instance of it is a system that failed to separate these concerns.

{% callout(type="insight") %}
The right mental model: emotional state inference is a *compiler step*, not a *runtime step*. It happens before the output is generated, it informs the output, and it should leave no traces in the output. Just as you don't want your compiler's intermediate representation showing up in your executable, you don't want your inference layer's reasoning showing up in your UI copy.
{% end %}

---

## Open Questions

This architecture solves the obvious case — don't print "based on your 11 PM habits" in a notification. But there are harder problems:

**1. How opaque should the system be about its own behaviour?**

There's a real tension between privacy (don't expose inference) and transparency (users deserve to understand how they're being personalised). GDPR and similar frameworks have opinions about this. The answer probably involves making inference *auditable* (users can ask to see it) without making it *ambient* (it doesn't appear unprompted). These are architecturally different.

{% callout(type="question") %}
At what point does appropriate opacity about inference become deceptive? If a system knows a user is grieving and adjusts its recommendations accordingly, does the user have a right to know that inference exists — even if surfacing it would be uncomfortable?
{% end %}

**2. When does attunement become manipulation?**

A system that knows you're anxious and surfaces calming content is being helpful. A system that knows you're anxious and surfaces content designed to *keep* you anxious — because anxious users engage more — is doing something else. The inference layer is the same. The intent isn't. This is a governance problem that architecture alone can't solve, but the architecture should make the intent explicit enough to audit.

**3. Cross-session through-lines vs in-session context**

Qualitative signals extracted from long-term history are relatively stable and relatively easy to reason about. In-session signals — you just had a frustrating interaction, you just received bad news, your typing speed has changed — are faster, noisier, and raise harder questions about what the system is allowed to infer. Real-time emotional inference is technically feasible and architecturally dangerous.

{% cite(key="affective-computing", title="Affective Computing", authors="Picard, R.W.", year=1997, url="https://mitpress.mit.edu/9780262661157/affective-computing/") %}

Picard's foundational work here is worth re-reading with contemporary LLM capabilities in mind. The inference problem she described in 1997 — recognising emotional state from behaviour — is largely solved. The ethical framework for what to do with that inference has not kept pace.

---

## The Bigger Picture

The "surveillance language" problem is a symptom of a broader failure mode in AI-assisted products: systems that are technically personalised but socially illegible.

Social illegibility is the condition in which a system's behaviour doesn't match the social contract that users expect. Users expect a music app to have good taste, the way a friend might. They don't expect the music app to have a detailed dossier on their habits that it occasionally recites back to them. The capability gap between "what the system can infer" and "what users expect the system to know" has widened dramatically with LLMs, and most products haven't updated their mental models accordingly.

{% cite(key="weapons-math-destruction", title="Weapons of Math Destruction", authors="O'Neil, C.", year=2016, url="https://www.penguinrandomhouse.com/books/241363/weapons-of-math-destruction-by-cathy-oneil/") %}

O'Neil's framing of algorithmic opacity is relevant here from the other direction. She argues (correctly) that opaque algorithms cause harm when their decisions affect people's lives — credit, employment, housing. The call is for transparency. But not all algorithmic contexts are the same: a recommendation system isn't making decisions about your mortgage, and transparency about emotional inference in a music app serves different interests than transparency about a credit score model. The architecture needs to distinguish between "opacity that protects users" and "opacity that hides accountability."

The empathy architecture principle doesn't oppose transparency. It opposes the specific pattern where transparency is achieved by printing the inference in the UI copy, which is the lowest-effort implementation of transparency and also the most socially disruptive one.

{% cite(key="value-sensitive-design", title="Value Sensitive Design: Shaping Technology with Moral Imagination", authors="Friedman, B., Hendry, D.G.", year=2019, url="https://mitpress.mit.edu/9780262039536/value-sensitive-design/") %}

Value-sensitive design as a methodology offers a useful frame here: the technical choice (separate inference from output) is downstream of a values choice (users should feel understood, not catalogued). Making the values choice explicit forces the technical choice to follow. Most teams skip the values conversation and then wonder why their personalisation feels creepy.

---

## Bottom Line

The principle is simple enough to fit on a Post-it note: **the LLM knows things about the user that the user-facing copy must not say.**

The implementation is simple in architecture and hard in practice, because every A/B test will show that explicitly personalised copy ("Based on your Evening Wind-Down habits...") out-converts implicitly personalised copy in the short term. Users *click* on things that demonstrate they've been noticed. They also, over time, stop trusting systems that make them feel watched, and they churn to alternatives that feel smarter without the surveillance aftertaste.

The distinction between "After you close the laptop" and "Your Evening Wind-Down" is not semantic. It's architectural. The first is a qualitative through-line — a moment of life that the system has recognised without naming. The second is a quantitative label that turned your habits into a product feature.

Build systems that know the first. Don't build systems that say the second.

If your personalisation copy could have been written by a dashboard — if it just printed a query result and called it warmth — it's wrong. Not slightly wrong. Wrong in a way that will eventually cost you your users' trust, one mildly uncomfortable playlist label at a time.

{% callout(type="tldr") %}
**Architecture checklist:**
1. Emotional state inference lives in the ranking layer, not the output layer.
2. User-facing copy references no quantitative signals.
3. The leakage test: can you reverse-engineer the inference from the output? If yes, rewrite.
4. Qualitative through-lines in; play count and session-time labels out.
5. Inference is auditable by request. It is never ambient.
{% end %}
