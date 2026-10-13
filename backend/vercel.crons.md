# Vercel cron schedules (`vercel.json`)

JSON cannot hold comments, so the DST rationale lives here and in `src/routes/cronRoutes.js`.

## Tuesday charge — `subscription-charge`

| Schedule | EDT (UTC−4) | EST (UTC−5) |
| --- | --- | --- |
| `0 13 * * 2` | 9:00 AM | 8:00 AM |
| `0 14 * * 2` | 10:00 AM | 9:00 AM |

Two slots so **one** run is always at or after Tuesday 9:00 AM Toronto. The job no-ops the second clean run via `jobAlreadyFinished`.

## Wednesday lock — `subscription-lock`

| Schedule | EDT (UTC−4) | EST (UTC−5) |
| --- | --- | --- |
| `0 22 * * 3` | **6:00 PM** | **5:00 PM** |

**One slot on purpose.** 22:00 UTC is never before 5:00 PM Toronto:

- Winter (EST): exact 5:00 PM
- Summer (EDT): 6:00 PM (one hour late, still after meal lock)

Do **not** use 21:00 UTC alone — that is 4:00 PM EST and would freeze meals early.

Dual 21:00 + 22:00 (like charge) would also work with `jobAlreadyFinished`; we keep a single late slot so lock stays simple and season-proof without editing schedules twice a year.
