# Hearthwork: game design

A settlement grows into a village, a town, a city and a metropolis, but only while you work. You are its unseen patron, the Hearthkeeper; the goals you reach earn you the power to shape its story.

The art direction lives in its own document (the Art Design Document). This file records the game design and the decisions made so far.

## Pillars

1. **Your work is the sun.** City time moves only while a focus session runs. When you stop, night falls and the city sleeps. Nothing decays, nobody dies, while you're away.
2. **Alive, not managed.** The city builds itself and lives its own lives. Your powers are nudges.
3. **Every person has a story.** Named people with families, traits, dreams, memories and graves. The Chronicle tells it.
4. **Calm while working, rich while resting.** Nothing interrupts a session. Breaks are when you read what happened and act.
5. **Kind to the worker.** Forgiving goals, no fragile streaks, no punishment for missed days.

## Decisions

| Question | Decision |
| --- | --- |
| Pace | 1 focus hour = 1 city year (360 days; a day is 10 focus seconds, a season 15 minutes). Adjustable later if it feels off. |
| Measuring work | The player chooses when founding (and can change it in Settings): **time worked** or **words written**. Either way a start/stop timer runs the city's clock. With words, Sparks and the daily goal come from the word count entered after each session, and the word field only appears in that mode. Word-count app integrations come later. |
| Platform | Desktop app first (Mac now; Windows next), built with Tauri so Android and iOS can follow from the same code. |
| Eras | Bronze to modern, following the timescale with randomness. Ages are named for the discovery or event that starts them (Age of Bronze, Age of Sail…). Art is organized into seven visual eras. |
| Weirdness | A slider, 0–4: Historical, Folklore, Uncanny, Mythic, Fantastical. |
| Darkness | A slider, 0–100: Gentle, Balanced, Grim. Changes avoidable deaths and how the Chronicle tells hard things. No gore at any setting. |

## A companion while you work (Mac app)

- **Menu-bar clock**: the session timer shows in the Mac menu bar, with Start/Stop there. Closing the window keeps Hearthwork running in the menu bar; the Dock icon or the menu brings it back. Stopping from the menu bar brings the window up for the end-of-session summary.
- **Pause when away**: if there's no keyboard or mouse input for a while (default 15 minutes; Settings), the session pauses at the moment you left, and on return you're asked whether to count the time away (you might have been reading or writing by hand). Time is only counted up to shortly after the last input, so nothing has to be taken back.
- **Notifications**: optional (off by default) notifications for Sparks and the daily goal, only when the window isn't in front. A paused-while-away notice is always sent if notifications are allowed.

## Goals and rewards

| Tier | Default | Reward |
| --- | --- | --- |
| Every focus minute | — | City time moves forward |
| Spark | every 20 minutes, or every 250 words when tracking words | Three parties of travelers arrive at the gate (welcome one, or the city takes one in at dawn), plus 1 Favor |
| Daily goal | 60 minutes, or 1,000 words when tracking words | +5 Favor (later: a Fortune, one of three rare opportunities) |
| Weekly goal | 5 goal days in 7 | Later: a Wonder or a Golden Age |

## Acts (spent with Favor)

Built: **Bless** (1), **Name** a year or a baby (1), **Create a Settler** (3), **Send on a Quest** (3), **Whisper a Law** (5, +2 for each trait that makes the leader dislike it), **Raise a Prophet** (8). Acts that bring people or send them away wait for dawn (the next session start).

**Petitions** at the Old Stone: when someone is gravely ill, away on a long quest, longing for a child, worried about the harvest, or when plague or fire strikes, people ask. Answering costs 1–4 Favor; ignored prayers lapse and life takes its course. Answered prayers inspire faith in the Unseen Keeper.

**Fortunes** (daily goal reward): three rare opportunities, pick one: a master crafter, a traveling healer, a treasure map, a bumper harvest, a master builder, a great feast, or (in a village) a free Raise a Prophet.

Planned: Matchmake, Inspire, Call a Festival, Commission, Avert Calamity, Found a Colony.

## Growth stages

| Stage | Population | Notes |
| --- | --- | --- |
| Settlement | 1–49 | Tents, round huts, mudbrick homes, fields, a well, a dock |
| Village | 50–249 | Market stalls, gathering hall, homes upgraded to mudbrick |
| Town | 250–1,999 | Planned: walls, guilds, leadership and laws |
| City | 2,000–9,999 | Planned: districts, factions, wonders |
| Metropolis | 10,000+ | Planned: crowd simulation at scale |

## What's simulated now (Phase 1)

- People with traits, trades, dreams, orientation, family trees and memories.
- Courtship, weddings (including same-sex couples), pregnancy, births and twins, coming of age, adoption of orphans.
- Illness, injuries at work, old age, childbirth, hunger and cold, all scaled by Darkness.
- Restless people leave on quests and return with plunder, knowledge, spouses, followers, relics or injuries, or never come back (and sometimes come back decades later).
- A self-planning settlement: homes, fields, workshops and civic buildings placed by need; footpaths worn by daily walking become the road network.
- Seasons with harvest swings, lean winters, and emigration after long hunger.
- Omens scaled by Weirdness. Everyday moments between the big events.
- Years named after their most memorable event.

### Village life (Phase 2)

- **Leadership**: in a settlement, people bring their quarrels to whoever they respect (the Eldest); in a village, ambitious people claim the chief's seat, sometimes contested, and a chief who grows unpopular can be challenged and unseated.
- **Laws**: leaders pass and repeal laws that match their personalities: Share the Harvest, Open Gates, the Fever Huts, Feast Days, Work from Dawn, No Blades at the Fire, the Elders' Voice, the Tithe to the Stone. Each has real effects, and people like or dislike each by their traits.
- **Faith**: omens, relics, plagues survived and answered prayers stir people; a pious, charismatic person founds a faith with two tenets. Faiths spread through families (young faiths with extra zeal), are passed to children, keep a holy day, split when they grow large, and fade if no one keeps them.
- **Plague**: arrives more often in crowded villages, spreads by contact, is slowed by the Fever Huts and healers, and burns out. Deadliness follows Darkness.
- **Fire**: thatch catches, especially in dry summers and around kilns; it spreads to neighbors (less with a well), leaves charred shells that are later cleared, and burned-out families get a tent.
- **Businesses**: kilns, forges and market stalls open under names (*The Red Kiln*, *Mira's Pots*) and pass to heirs.
- **Family houses**: big families (six or more under one roof) build a 2×2 family house.
- **Family tree** view for anyone.

## Roadmap

1. **First Fire** (done): timer, goals, Sparks, Favor, four Acts, the Bronze settlement to village, Chronicle, saving, the art test scene. Plus the menu-bar clock and pausing when away.
2. **Village life** (done): leadership and laws, emergent religion, petitions, plague and fire, businesses, Fortunes, family trees.
3. **Town and city**: districts, guilds, crime and trials, factions, neighbors, trade and war, Wonders, family trees, ages advancing by discovery, a bigger map.
4. **Metropolis**: crowd simulation, later eras, performance work, ambient sound.
5. **Polish and integrations**: Windows, Android and iOS, word-count integrations, sync between devices, optional AI-written chronicles.
