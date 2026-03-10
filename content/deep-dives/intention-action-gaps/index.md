+++
title = "Intention-Action Gaps as Behavioral Signals"
description = "What you say you'll do vs what you actually do — the gap is the insight."
date = 2026-03-10

[taxonomies]
tags = ["personalization", "behavioral-analytics", "product-design", "ethics"]
series = ["product-design"]

[extra]
reading_time = "12 min"
tier = 3
+++

## The One-Sentence Version

The gap between what users say they want and what they actually do isn't a data quality problem — it's the most honest signal you have.

{% callout(type="tldr") %}
**What:** Users state intentions ("I want to be more present") and log actions ("closed laptop with intention"). The divergence between these two signals is itself a third signal — one that reveals how people relate to their goals, not just whether they achieve them.
**Why it matters:** Treating intention-action gaps as noise discards the most actionable data in your product. Treating them as convergence targets reveals a rich, evolving picture of goal formation and struggle.
**The ethical wrinkle:** Analyzing what someone *says* they want alongside what they *do* feels categorically different from tracking behavior alone. It probably is. That's worth sitting with.
{% end %}

## The Problem

Here's a scenario. You're building a tool for intentional living — maybe a journaling app, a habit tracker, a reflection product. Users set a daily intention: *"Return to the present moment."* Philosophical, aspirational, the kind of thing you'd carve into a meditation retreat's bathroom wall.

Then you look at their logged actions. The actual thing they did and marked as intentional behavior: *"Shut my laptop with intention."*

That's not a contradiction. Both statements are true. But they're operating at completely different altitudes. The stated intention is cosmological. The observed action is, charitably, operational.

Your first instinct might be to treat this as a {{ glossary(term="signal-to-noise ratio", def="The proportion of meaningful information versus irrelevant or misleading data in a dataset. High noise makes patterns harder to identify.") }} problem — the user "aspirational-washed" their intention, and the behavior is what actually matters. So you filter out the stated intention and analyze the logged action.

You've just thrown away the most interesting data point in the record.

The {{ glossary(term="intention-action gap", def="The measurable distance between what a user states they intend to do and what their observed behavior actually shows they did. The gap itself is a signal about goal formation, struggle, and self-perception.") }} — the distance between *stated goal* and *observed behavior* — is not a rounding error. It's a fingerprint. It tells you something about how this particular human relates to their own aspirations, something that neither the intention nor the action captures in isolation.

## Two Signals, One Person

Let's be precise about what we're actually measuring.

{{ glossary(term="Set intentions", def="Explicit, user-authored statements of what they plan to do or want to achieve, typically captured before or at the start of a session or day. These are stated, not inferred.") }} are what users write into your product when you ask them what they want. They're self-authored. They may be aspirational, vague, specific, or — frequently — all three simultaneously. "Return to the present" is aspirational and vague. "Drink more water" is specific and achievable. "Become a person who doesn't check email before 9am" is aspirational, specific, and also a cry for help.

{{ glossary(term="Logged intentions", def="Actions or behaviors that users explicitly mark as intentional — distinct from passive behavior tracking. The user is making a claim about their own agency: 'I meant to do this.'") }} are different. They're the things users mark as *intentional* within your product — the behaviors they claim ownership over. This is distinct from passive telemetry. When someone logs "shut laptop with intention," they're not just generating a data point. They're making a self-attribution claim: *I did this on purpose. This counts.*

The {{ glossary(term="behavioral signals", def="Data derived from what users actually do — clicks, session lengths, feature usage, timing patterns — as opposed to what they say they intend to do.") }} layer underneath both of these is the objective record: session lengths, feature usage, time-of-day patterns, dropout rates, return frequency. This is the thing most product teams spend 90% of their time on.

Here's the hierarchy of honesty, roughly: behavioral signals don't lie but also don't explain themselves. Logged intentions tell you what someone *thinks* they're doing. Set intentions tell you what someone *wishes* they were doing.

None of these is more true than the others. They're different facets of the same complicated primate trying to close the gap between who they are and who they want to be.

{% callout(type="insight") %}
The {{ glossary(term="stated vs observed", def="The distinction between what users explicitly tell you about their goals and preferences (stated) versus what their actual usage patterns reveal (observed). Research in behavioral economics shows these frequently diverge — and the divergence is often more informative than either signal alone.") }} gap has a long history in behavioral economics. Preference reversals, hyperbolic discounting, the planning fallacy — humans are constitutionally bad at predicting their own behavior. The insight isn't that people are irrational. It's that the gap between stated and revealed preferences is *structured*. Predictably wrong in predictable ways. That structure is the signal.
{% end %}

## The Gap Is the Point

Let's say you have two users. Same product. Same stated intention: "Be more intentional about my digital life."

User A's logged actions: "meditated for ten minutes," "read a physical book," "left phone in another room during dinner."
User B's logged actions: "checked email only three times," "used website blocker for one hour," "wrote in journal for five minutes."

Both have the same stated intention. The gap in each case is different. User A's actions are *living* the stated intention — the gap is small and convergent. User B's actions are *negotiating* with it — each logged action is a constraint, a workaround, a harm reduction strategy rather than a positive embodiment.

Neither is wrong. But they're in completely different relationships with their own goals. User A is executing. User B is resisting. And if you treat both the same way because they share a stated intention, you're going to give User B the same "keep up the great work!" nudge that serves User A — which is useless at best and patronizing at worst.

Now extend this across time. A user's gap at week one tells you where they're starting. The same user's gap at week twelve tells you whether they're getting somewhere. This is where it gets genuinely interesting.

**Converging gap** (stated and observed closing on each other over time): the user is internalizing their goals. Aspirational intentions are becoming operational ones. The philosophy is becoming practice. This is a healthy trajectory — but the interesting design question is: what did your product do to enable it, and how do you not accidentally get in the way?

**Diverging gap** (stated and observed growing apart over time): the user is struggling, or their goals are shifting, or both. The stated intention is becoming more ambitious as the actions become more modest. Or the stated intention is going stale — the user hasn't updated it since month one, but their behavior has completely changed. The goal they set is no longer the goal they have.

**Stable gap** (distance consistent across time, neither converging nor diverging): the user has reached an equilibrium. They've accepted that they'll aspire to more than they'll do. This is surprisingly common and not necessarily a failure state. Aspiration has value even when imperfectly realized {{ cite(key="oettingen2015", title="Rethinking Positive Thinking: Inside the New Science of Motivation", authors="Oettingen, G.", year="2015", url="https://www.amazon.com/Rethinking-Positive-Thinking-Inside-Motivation/dp/1591846544") }}. But it might also mean your product has become aspirational wallpaper — a place people go to feel like they're trying, without actually being helped to try.

All three trajectories are actionable. None of them is visible if you're only watching behavioral signals, and none is visible if you're only reading stated intentions.

## What This Actually Looks Like in Practice

Concretely: you need both data streams and a way to compute their relationship.

For set intentions, you need a structured capture mechanism — not just a free-text journal but something that lets you compare at scale. That means some degree of categorisation: is this intention about relationship, health, focus, creativity, productivity? It means a timestamp and a recency weight (an intention set six months ago and never revisited is different from one set this morning). And it means tracking whether the user revisits and updates their intentions, which is itself a signal.

For logged intentions, you need the user to do the classification work — they're marking actions as intentional. This is a form of lightweight self-reporting that preserves agency. The user is the expert on whether their behavior was intentional. You're just the archivist {{ cite(key="kahneman2011", title="Thinking, Fast and Slow", authors="Kahneman, D.", year="2011", url="https://www.amazon.com/Thinking-Fast-Slow-Daniel-Kahneman/dp/0374533555") }}.

The gap metric itself can be computed in a few ways, from simple to sophisticated:

- **Semantic distance:** embed both the stated intention and the logged actions in the same vector space, compute cosine similarity. Small angle = small gap. Big angle = big gap. Works reasonably well for surface-level comparison but misses the "philosophically aspirational, operationally practical" pattern that started this whole discussion.

- **Taxonomy alignment:** categorise both stated intentions and logged actions into a shared taxonomy. Count how many categories overlap. If stated intention is "presence/mindfulness" and logged actions are all in "digital boundaries/productivity," that's a measurable gap with a clear character.

- **Longitudinal trend:** neither a single gap value nor a static comparison matters as much as the *direction of change*. A gradient across time — is the gap shrinking or growing this week versus last week? — is often more actionable than the absolute distance.

{% callout(type="question") %}
**Open question:** When a user's stated intention and logged actions converge, is that goal achievement — or goal collapse? Did they grow into their aspiration, or did they quietly lower the bar until the gap disappeared? You probably can't tell from the gap metric alone. You need the behavioral signals layer to distinguish "I became the person I wanted to be" from "I gave up on becoming that person."
{% end %}

## The Ethical Question

Here's where I'm obligated to make you slightly uncomfortable.

Behavioral analytics is, at this point, a normal part of product development. Users expect it. Privacy regulations constrain it but don't prohibit it. The ethics of tracking what people *do* in your product are relatively well-mapped, if not fully resolved.

Analyzing what people say they *want* is different. Not legally different, in most jurisdictions. But categorically different in ways that matter.

When someone tells your product they want to "be more present," they're being vulnerable. They're sharing an aspiration that's personal, probably private, possibly tied to some real dissatisfaction in their life. They typed that into your product because the product asked, and they trusted it enough to answer honestly.

Using that vulnerability to build a behavioral model feels different from analyzing session lengths. It's not a surveillance camera — it's a confessional. And the confessional has different rules.

{{ cite(key="zuboff2019", title="The Age of Surveillance Capitalism", authors="Zuboff, S.", year="2019", url="https://www.amazon.com/Age-Surveillance-Capitalism-Future-Frontier/dp/1610395697") }} would have something very pointed to say here, and she wouldn't be entirely wrong. The commercial incentive to treat stated intentions as training data for personalization — to mine people's aspirations for targeting signals — is real and troubling. The line between "helping users achieve their goals" and "exploiting their goals to increase engagement" is not always clear, and the latter can masquerade as the former with considerable conviction.

{% callout(type="warning") %}
**The ethical floor, at minimum:**

1. **Transparency:** Users should know their stated intentions are being used to personalize their experience. Not buried in a privacy policy — actually communicated.
2. **Control:** Users should be able to set intentions without those intentions feeding a model. The product that requires you to share your aspirations in order to function has made an ethical choice, and it's not a good one.
3. **Data minimization:** Compute the gap metric, use it for personalization, then delete the raw stated intentions. You don't need to store "return to the present" forever. You need the derived insight.
4. **No leakage:** Stated intentions should stay within the personalization context. They should not flow to ad targeting, third-party data brokers, or anywhere the user hasn't explicitly consented to.

These are not radical positions. They're the minimum viable ethical posture for a product that asks people to share their aspirations.
{% end %}

The privacy question for intention-action gap analysis isn't whether it's worse than pure behavioral tracking. In some ways, it might be *better* — because you're explicitly asking rather than implicitly inferring, and explicit data at least gives the user something to consent to. The question is whether you're treating the stated intention with the gravity it deserves.

## What's Actually New Here

Behavioral analytics has been around since the first product manager noticed that users weren't using the feature she'd spent three months building. Stated preferences have been a research topic in economics since the 1960s. Intention-behavior gaps are well-documented in psychology, habit research, and clinical intervention literature {{ cite(key="webb2006", title="Does changing behavioral intentions engender behavior change? A meta-analysis of the experimental evidence", authors="Webb, T. L., & Sheeran, P.", year="2006", url="https://doi.org/10.1037/0033-2909.132.2.249") }}.

What's relatively new is the product opportunity: tools that *explicitly capture both signals* and *surface the gap as a first-class UI element*.

Most products collect behavioral data passively and stated preferences occasionally (onboarding surveys, NPS). Very few products make the gap between the two visible *to the user* as a mirror of their own relationship with their goals. That's a different design choice — the gap as a feature, not a metric.

Imagine a weekly review that shows you: *Here's what you said you wanted. Here's what you actually did. Here's how the distance between those things has changed over the past month.* Not accusatory. Not gamified with a streak counter that makes you feel bad for being human. Just reflective. Here's your fingerprint. What do you think?

That's a product category that largely doesn't exist yet. The tools that get closest — some journaling apps, certain productivity systems — tend to do one or the other: either they track behavior and leave stated intentions as decorative text, or they collect aspirations beautifully and do nothing with the behavioral data that would tell you whether those aspirations are being realized.

## Open Questions

A few things I don't have clean answers to:

**Who gets to define convergence?** If a user's stated intention is "read more" and their logged actions are "listened to audiobooks," is the gap closing or not? By semantic embedding, maybe. By cultural definition, some people would say audiobooks don't count (they are wrong, but they'd say it). The gap metric needs a theory of what counts as aligned — and that theory encodes values.

**What do you do with permanently stable gaps?** Some users will maintain a consistent distance between aspiration and action indefinitely. This is, arguably, the human condition. Does your product design accommodate that as a valid steady state, or does it treat it as a problem to solve? Treating it as a problem is a commercial incentive. It may also be an imposition.

**How does the gap metric interact with mental health?** A user whose stated intentions are increasingly ambitious while their actions are increasingly modest might be showing you goal inflation driven by anxiety, or depression's signature move of wanting more while doing less. That's a clinical territory most product teams are not equipped to navigate, and most apps' terms of service explicitly disclaim. But the signal doesn't care about your disclaimer.

## The Bigger Picture

Intention-action gap analysis is ultimately about closing the distance between what products know about users and what users know about themselves.

Most personalization is patronizing in a specific way: it builds a model of you from your behavior, and then it optimizes that model without showing you the model. You're the subject of a study you can't read. The algorithm knows what you'll click on; you're still surprised by what you click on.

A product that explicitly captures stated intentions, tracks behavior, and surfaces the relationship between the two is doing something different. It's making you a co-investigator in your own behavioral archaeology. It's saying: here's what we see. Is that who you're trying to be?

That's a harder product to build. It's a harder product to explain. The dashboard doesn't go up and to the right. But it's a product that actually serves the user's stated goal — which, if you read your own stated intentions, is what we're all trying to do.

## Bottom Line

The intention-action gap isn't a data quality problem. It's your richest signal.

Both what users say they want and what they actually do are true. The relationship between them is what evolves over time, and that evolution tells you whether your product is helping, whether your user is struggling, and whether the goal they set last month is still the goal they have today.

Capture both signals explicitly. Compute the gap. Track its direction. Surface it back to users as a mirror, not a judgment. And treat the stated intention data with the ethical care it deserves — because someone told you what they want to become, and that's not a targeting opportunity. It's a trust.
