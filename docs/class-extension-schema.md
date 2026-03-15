# Tatame — Class Scheduling Model

This document defines how recurring classes are modeled in the Tatame system.

Academies usually have recurring classes (e.g., every Monday and Wednesday).
Therefore, the system separates class definitions from individual occurrences.

The system uses three entities:

- Class
- Class Schedule
- Class Session

---

# 1. Classes

Represents the base definition of a class.

Example:

- Fundamentals
- Advanced
- Kids
- Competition

Table: `classes`

| column               | type               | description            |
| -------------------- | ------------------ | ---------------------- |
| id                   | uuid (pk)          | class id               |
| academy_id           | uuid               | academy                |
| instructor_member_id | uuid               | instructor responsible |
| name                 | text               | class name             |
| description          | text               | optional description   |
| capacity             | integer (nullable) | max checkins           |
| created_at           | timestamp          | creation timestamp     |
| updated_at           | timestamp          | last update            |

Rules:

- capacity NULL → unlimited students

---

# 2. Class Schedules

Defines the recurring schedule of a class.

Example:

Fundamentals → Monday 19:00

Table: `class_schedules`

| column      | type          | description |
| ----------- | ------------- | ----------- |
| id          | uuid (pk)     |             |
| class_id    | uuid          |             |
| day_of_week | integer (0-6) |             |
| start_time  | time          |             |
| end_time    | time          |             |
| active      | boolean       |             |

Day of week example:

```
0 Sunday
1 Monday
2 Tuesday
3 Wednesday
4 Thursday
5 Friday
6 Saturday
```

Rules:

- A class may have multiple schedules.
- Disabling a schedule prevents future sessions.

Example:

```
Fundamentals
 Monday 19:00
 Wednesday 19:00
 Friday 19:00
```

---

# 3. Class Sessions

Represents an individual occurrence of a class.

Example:

```
Fundamentals
Monday Mar 10
19:00
```

Table: `class_sessions`

| column       | type                       | description |
| ------------ | -------------------------- | ----------- |
| id           | uuid (pk)                  |             |
| class_id     | uuid                       |             |
| schedule_id  | uuid                       |             |
| session_date | date                       |             |
| start_time   | timestamp                  |             |
| end_time     | timestamp                  |             |
| status       | enum (scheduled, canceled) |             |
| created_at   | timestamp                  |             |

Rules:

- Sessions represent the actual class instance for a given day.
- Check-ins always reference a session.

---

# 4. Class Check-ins

Attendance is recorded per session.

Table: `class_checkins`

| column            | type      | description |
| ----------------- | --------- | ----------- |
| id                | uuid      |             |
| session_id        | uuid      |             |
| student_member_id | uuid      |             |
| checkin_time      | timestamp |             |

Constraint:

```
unique(session_id, student_member_id)
```

This ensures a student can check in only once per session.

---

# 5. Session Generation

Sessions may be generated automatically.

Recommended strategy:

Generate sessions **30 days ahead**.

Example process:

Daily job:

```
generate sessions for next 30 days
```

Pseudo logic:

```
for each class_schedule
  if schedule.day_of_week matches future date
     create session
```

---

# 6. Class Cancellation

If a class is canceled for a specific date:

Update session:

```
status = canceled
```

Students cannot check in to canceled sessions.

---

# 7. Capacity Validation

Capacity validation happens per session.

Example:

```
class.capacity = 20
```

Validation:

```
count(checkins) >= capacity
```

If true:

```
reject checkin
```

---

# 8. Advantages of this Model

This architecture allows:

- recurring schedules
- single-day cancellations
- attendance history
- future class previews
- schedule changes without losing past data

---

# 9. Future Extensions

Possible improvements:

- substitute instructor per session
- class waitlists
- class reservations
- holiday schedules
- special events
