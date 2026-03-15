# Tatame — Class Session Generation (Cron Strategy)

This document defines the strategy used to generate **class sessions** from recurring class schedules in the Tatame system.

The goal is to ensure that upcoming classes exist as concrete records in the database so they can support:

- attendance check-ins
- capacity validation
- class cancellations
- schedule visualization

The system uses a **cron-based generation strategy**.

---

# 1. Overview

Tatame supports **recurring classes**.

Example:

```
Fundamentals
Monday 19:00
Wednesday 19:00
Friday 19:00
```

These recurring definitions are stored in `class_schedules`.

However, attendance and operational actions require **specific class instances**.
These instances are called **class sessions**.

Example sessions:

```
Fundamentals — Monday Mar 10 — 19:00
Fundamentals — Wednesday Mar 12 — 19:00
Fundamentals — Friday Mar 14 — 19:00
```

Sessions are stored in the `class_sessions` table.

---

# 2. Session Generation Strategy

Sessions are generated **automatically via a cron job**.

The cron job runs periodically and ensures that sessions exist for the next **30 days**.

This approach ensures:

- fast schedule queries
- stable check-in references
- predictable system behavior

---

# 3. Cron Job Schedule

Recommended schedule:

```
Runs once per day
Time: 02:00 AM server time
```

Cron expression example:

```
0 2 * * *
```

This job ensures that the system always has sessions created for the next 30 days.

---

# 4. Session Generation Window

The system maintains a rolling generation window.

Example:

```
today: March 1
generation window: March 1 → March 31
```

Every time the cron runs:

```
extend window to maintain 30 future days
```

Example:

```
today: March 10
window: March 10 → April 9
```

---

# 5. Session Generation Logic

The cron job performs the following steps:

1. Fetch all active class schedules.
2. For each schedule, determine which dates within the next 30 days match the scheduled day of week.
3. For each matching date:
   - check if a session already exists
   - if not, create a new session

Pseudo logic:

```
for each class_schedule where active = true
    for each date in next_30_days
        if date.day_of_week == schedule.day_of_week
            if session does not exist
                create class_session
```

---

# 6. Preventing Duplicate Sessions

Before inserting a new session, the system must verify that a session does not already exist.

Unique constraint recommended:

```
unique(class_id, schedule_id, session_date)
```

This ensures that duplicate sessions cannot be created even if the cron job runs multiple times.

---

# 7. Session Fields

Each generated session must contain:

| field        | description                     |
| ------------ | ------------------------------- |
| class_id     | reference to class              |
| schedule_id  | reference to recurring schedule |
| session_date | calendar date of the session    |
| start_time   | full timestamp                  |
| end_time     | full timestamp                  |
| status       | scheduled by default            |

Example:

```
class_id: fundamentals
schedule_id: monday_schedule
session_date: 2026-03-16
start_time: 2026-03-16 19:00
end_time: 2026-03-16 20:00
status: scheduled
```

---

# 8. Handling Schedule Changes

If a schedule is modified (for example, class time changes):

- existing sessions remain unchanged
- new sessions will be generated with the updated schedule

This preserves historical accuracy.

---

# 9. Disabling a Schedule

If a schedule is disabled:

```
class_schedules.active = false
```

Then:

- no new sessions will be generated
- existing sessions remain in the database

Managers may manually cancel individual sessions if needed.

---

# 10. Canceling Individual Sessions

Managers or instructors may cancel a specific session.

Example:

```
class_sessions.status = canceled
```

Effects:

- students cannot check in
- session still appears in schedule as canceled

---

# 11. Advantages of Cron-Based Session Generation

This approach provides several benefits:

- faster schedule queries
- simpler check-in logic
- easier capacity validation
- ability to cancel individual sessions
- clear attendance history

---

# 12. Performance Considerations

Session generation is lightweight because:

- schedules are few
- generation window is small (30 days)

Example scale:

```
academy classes: 15
schedules per class: 3
days generated: 30
sessions generated: ~1350
```

This workload is trivial for PostgreSQL.

---

# 13. Future Improvements

Possible enhancements:

- configurable generation window (30 → 60 days)
- holiday skipping rules
- automatic schedule exceptions
- instructor substitutions
- special event sessions

---
