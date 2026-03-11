+++
title = "Intention-Action Gaps as Behavioral Signals"
description = "What you say you'll do vs what you actually do — the gap is the insight."
date = 2026-03-10T11:00:00+11:00

[taxonomies]
tags = ["personalization", "behavioral-analytics", "product-design", "ethics"]
series = ["product-deep-dives"]

[extra]
reading_time = "10 min"
+++

## The One-Sentence Version

The gap between what you intend to do and what you actually do isn't noise — it's the most honest signal your data produces.

{% callout(type="tldr") %}
**What:** Measuring the divergence between stated intentions ("I want to be more present") and logged actions ("closed laptop, scrolled phone for 40 minutes") as a first-class behavioral signal.
**Why it matters:** Most analytics systems treat behavior as ground truth. But the *relationship* between intention and behavior carries signal that neither captures alone.
**The uncomfortable bit:** This might be ethically distinguishable from analyzing behavior alone — and we should probably have that conversation before shipping the feature.
{% end %}

## The Problem with Only Watching What You Do

Behavioral analytics is built on a seductive premise: actions don't lie. You can watch what users click, skip, open, close, and ignore — and build a picture of what they actually want, rather than what they say they want. Decades of recommendation system research has reinforced this. Revealed preference beats stated preference. Netflix doesn't care what you say you want to watch; it cares what you press play on at 11pm when you're half-asleep.

This is mostly correct and mostly useful. But it has a structural blind spot.

Behavior reveals what you do. It doesn't reveal what you're *trying* to do. And those aren't always the same thing.

{{ glossary(term="behavioral signals", def="Data points derived from observed user actions — clicks, duration, sequences, completions — as distinct from explicit preferences or self-reported data.") }}

A person can scroll social media for two hours while genuinely wanting to meditate. Both things are true simultaneously. The scrolling is real behavior. The wanting-to-meditate is also real. A system that only sees the scrolling builds a model of a person who wants to scroll. A system that *only* captures the intention gets told a pleasant fiction. But a system that tracks both — and notices the gap — is building a model of a person trying to change.

That's a completely different model. And it suggests completely different interventions.

## What "Intentions" Actually Look Like in the Wild

In contemplative and productivity apps, users set {{ glossary(term="set intentions", def="Explicit, forward-looking statements a user makes about what they plan to do or how they want to be — before or at the start of a session or period.") }} in a few characteristic forms:

**Aspirational/identity-level:** "I want to be more present." "I'm trying to spend less time on my phone." These are value statements more than plans. They're directionally meaningful but temporally vague.

**Session-level:** "For this hour, I'm going to focus on writing." "Today I want to finish the report and take a walk." These are specific enough to be testable.

**Transitional:** "I'm closing my laptop with intention." "Putting my phone in the other room." These are behavioral commitments — the person is announcing an action as they take it, which is fascinatingly different from planning one.

Meanwhile, {{ glossary(term="logged intentions", def="Behavioral events that represent an intentional act being executed — a user consciously recording or marking an action as deliberate, rather than the system passively observing it.") }} are what you actually *observe*: the app opened, the session started, the task completed, the device put down. The system's record of what happened.

The {{ glossary(term="intention-action gap", def="The measurable divergence between what a user states they intend to do and what behavioral data shows they actually did. Can be positive (exceeded intentions) or negative (fell short). Direction and magnitude both carry signal.") }} lives between those two layers.

## The Gap as a Signal: What It Actually Tells You

Here's where it gets interesting. The gap isn't just "did they do the thing they said they'd do." It has structure.

**Direction matters.** Falling short of an intention is different from exceeding it. Someone who intends to meditate for ten minutes and does twenty is in a different state than someone who intends twenty and does three. One is undershooting their ceiling; the other is overshooting their floor. Both tell you something about where the real equilibrium is.

**Consistency matters.** A one-off gap is noise. A persistent gap is a signal. But *which* signal depends on trajectory.

**Trajectory is everything.** This is the insight that most intent-tracking systems miss:

{% callout(type="insight") %}
An intention-action gap that's *converging* over time — getting smaller, closing — suggests the user is making real progress toward their stated goal. The intention is pulling behavior along with it.

A gap that's *diverging* — getting larger — suggests one of two things: either the person is struggling, or the goal has shifted and they haven't updated the intention to match. Both are meaningful, and they require different responses.
{% end %}

A gap that stays constant is the most ambiguous: they're consistently falling short by the same amount. Could be a chronic mismatch between aspiration and reality. Could be a measurement artifact. Could be that the "gap" is actually working as a kind of buffer — they set the intention high on purpose, knowing they'll hit 80% of it.

{{ cite(key="baumeister1994", title="Losing Control: How and Why People Fail at Self-Regulation", authors="Baumeister, R. F., Heatherton, T. F., & Tice, D. M.", year="1994", url="https://psycnet.apa.org/record/1994-97093-000") }}

## The {{ glossary(term="stated vs observed", def="The distinction between what a user explicitly reports (preferences, intentions, goals) and what behavioral data shows they actually do. Core tension in personalization system design.") }} Distinction Isn't New — But We Keep Ignoring It

Survey researchers have known about this for decades. When you ask people what they eat, they lie — not maliciously, but because self-perception and reality diverge. When you watch what they actually buy at the supermarket, you get a different picture. The revealed-vs-stated preference debate in economics covers similar ground.

What's new here is the *temporal* structure. Traditional stated-vs-observed analysis is cross-sectional: ask at a point in time, observe at a point in time, compare. Intention-action gap analysis is longitudinal: track how both the intention and the behavior evolve together, and treat the *relationship* as the thing you're modeling.

{{ cite(key="ajzen1991", title="The theory of planned behavior", authors="Ajzen, I.", year="1991", url="https://www.sciencedirect.com/science/article/abs/pii/074959789190020T") }}

This is genuinely different. It means you're not trying to predict behavior from stated preferences (which is what traditional recommendation systems attempt). You're trying to model the *dynamics* of a person working toward a goal — which requires tracking both the compass heading and the actual trajectory.

## What You Can Actually Build With This

Let's be concrete. Here's what a system that treats intention-action gaps as first-class signals could do:

**Adaptive goal-setting.** If a user's gap is persistently large in one direction, the system can surface this gently and help them recalibrate. "You've been setting intentions to meditate for 20 minutes but averaging 8. Want to try setting 10 minutes and seeing how that feels?" This is radically different from just surfacing the behavior, because it honors the stated goal while working within revealed constraints.

**Struggle detection.** A rapidly widening gap — especially for intentions that were previously being met — is a meaningful signal. Something changed. Maybe life got harder. Maybe motivation shifted. A system that can detect this can prompt appropriately, rather than waiting for the user to explicitly report difficulty.

**Goal-drift identification.** Sometimes the intention and behavior diverge because the person has genuinely moved on. They intended to journal daily six months ago; now they open the app twice a week and seem perfectly content. The gap isn't evidence of failure — it's evidence that the goal has evolved. A system that can distinguish "struggling to meet an active goal" from "moved on from an old goal" is doing something genuinely useful.

**Progress attribution.** When the gap closes — when behavior finally catches up to stated intention — that's worth acknowledging. Not in a gamified "you earned a badge!" way, but meaningfully. The user did something hard. The data shows it.

{% callout(type="question") %}
What does it mean to "improve" in an intention-tracking system? Behavior matching intention? Or behavior *and* intention both moving in a good direction? These aren't the same. Someone can perfectly match a bad intention.
{% end %}

## The Privacy Thing (Which Is Not a Footnote)

Here's where I'm going to say something that might be uncomfortable: analyzing intention-action gaps might be meaningfully more ethically loaded than analyzing behavior alone.

When you track behavior, you're observing what someone *does*. That's the baseline assumption of most data collection — you're measuring actions that occur in your system.

When you track intentions, you're capturing what someone *wants and isn't yet achieving*. You're measuring their relationship with their own goals. You're recording their aspirations, their struggles, their self-perception versus their actual behavior. This is closer to diary data than click data.

{% callout(type="warning") %}
Behavioral data tells you what someone does. Intention data tells you what someone wishes they could do. Gap data tells you where they're failing. Be honest with yourself about whether the people generating this data understand what they're consenting to.
{% end %}

The asymmetry matters. People broadly understand that apps track what they do. "Your behavior is our data" has been normalized through two decades of the attention economy. But "your aspirations and your failures to meet them are our data" is a different proposition. Most users probably don't think of it that way, even when they're actively entering their intentions into an app.

{{ cite(key="nissenbaum2010", title="Privacy in Context: Technology, Policy, and the Integrity of Social Life", authors="Nissenbaum, H.", year="2010", url="https://www.sup.org/books/title/?id=8862") }}

There's also a power-dynamic question. Who has access to the gap data? Is it only used to improve the experience for the individual user, or is it aggregated, sold, or used to build models that serve third parties? "Your intention-action gap suggests you're struggling with focus" is useful information for a personal productivity tool. It's concerning information to have sitting in a dataset that could be subpoenaed, acquired, or breached.

I'm not saying don't build this. I'm saying build it with explicit consent architecture, clear data minimization practices, and a genuine accounting of what you're actually collecting. "We track your intentions and compare them to your behavior" should be a sentence that appears in your privacy policy in plain language.

{{ cite(key="zuboff2019", title="The Age of Surveillance Capitalism", authors="Zuboff, S.", year="2019", url="https://www.publicaffairsbooks.com/titles/shoshana-zuboff/the-age-of-surveillance-capitalism/9781610395694/") }}

## The Bigger Picture: Modeling People Trying to Change

The reason intention-action gaps are interesting isn't just the feature they enable. It's the underlying model of the user they imply.

Most personalization systems model users as they *are*. You are the person who watches these shows, listens to this music, clicks on these articles. The system reflects you back to yourself with increasing fidelity.

An intention-tracking system models users as they're *trying to be*. You are the person who wants to meditate, wants to exercise, wants to spend less time on your phone — and who is closing, or failing to close, the gap between that self-image and your current behavior. The system builds a picture of a person in motion, not at rest.

This is a fundamentally different product design premise. It means the system is accountable not just to what the user does, but to what the user is trying to do. That's harder. It's also more honest about what tools like this are supposedly *for*.

The risk is that you build a system that knows exactly how someone is failing to meet their goals and uses that knowledge to keep them in the app rather than to genuinely help. That would be a spectacular way to produce a product that is both effective and contemptible.

The way to avoid this is to ask, at every design decision: does this feature serve the user's stated intention, or does it serve engagement? Sometimes those align. When they don't, you have to choose.

## Open Questions

A few things this framing doesn't resolve:

**How do you handle intention revision?** If someone changes their stated intention, does the previous gap disappear? Does it carry forward as context? There's a meaningful difference between updating your goal because you've learned something and abandoning your goal because it's hard.

**What's the right temporal resolution?** A daily gap is very different from a weekly gap or a monthly one. Short-term volatility might be meaningless noise; long-term drift is the signal. Getting the granularity right matters enormously and probably needs to be user-configurable.

**Can you trust the stated intentions?** People sometimes set intentions they know they won't keep, for social or psychological reasons. The gap might be measuring aspirational theater rather than genuine goals. How do you distinguish between a user who is sincerely trying to meditate and one who is performing the act of intending to meditate?

**What do you do when the gap suggests the intention is wrong?** Sometimes the behavior is correct and the intention needs updating. A system that only pushes users toward their stated intentions might be reinforcing goals that no longer serve them.

## Bottom Line

Intention-action gap analysis is a genuinely useful primitive for personalization systems, particularly in wellbeing and productivity contexts. The gap between what people say they'll do and what they actually do isn't measurement error — it's data. Specifically, it's data about where a person is in relationship to their own goals, which is exactly the data you need to build systems that actually help people rather than just model them.

The trajectory of the gap — converging, diverging, stable — is more informative than the gap at any single point in time. Build longitudinal tracking, not snapshots.

And take the privacy question seriously. You're not just collecting behavior data. You're collecting data about aspirations and failures. Handle it accordingly, with explicit consent and genuine data minimization — not because you're legally required to, but because that's the kind of product worth building.

The gap is the insight. Use it carefully.
