# Tatame — Database Schema (v1)

This document defines the initial relational database schema for **Tatame**, a SaaS platform for martial arts academy management.

Database: **PostgreSQL**

Authentication is handled by **Clerk**, so user identity is synchronized via `clerk_user_id`.

The system is designed as a **multi-tenant architecture**, meaning multiple academies share the same infrastructure while keeping their data isolated.

---

# 1. Users

Represents a system user authenticated via Clerk.

A user may belong to multiple academies with different roles.

Profile data is partially synchronized from Clerk, but some additional fields are stored locally to support academy management.

Table: `users`

| column            | type          | description                         |
| ----------------- | ------------- | ----------------------------------- |
| id                | uuid (pk)     | internal user id                    |
| clerk_user_id     | text (unique) | id from Clerk                       |
| email             | text          | user email                          |
| name              | text          | display name                        |
| profile_image_url | text          | profile image URL provided by Clerk |
| phone             | text          | contact phone number                |
| instagram         | text          | instagram username or profile URL   |
| birth_date        | date          | user birth date                     |
| created_at        | timestamp     | creation timestamp                  |
| updated_at        | timestamp     | last update                         |

Notes:

- `profile_image_url` should be synchronized from Clerk during authentication.
- `phone`, `instagram`, and `birth_date` can be edited by the user inside the app.
- `instagram` should ideally store only the **username**, but storing the full URL is also acceptable depending on frontend implementation.

# 2. Academies

Represents a martial arts academy.

Table: `academies`

| column        | type      | description        |
| ------------- | --------- | ------------------ |
| id            | uuid (pk) | academy id         |
| name          | text      | academy name       |
| address       | text      | academy address    |
| contact_email | text      | contact email      |
| logo_url      | text      | academy logo       |
| created_at    | timestamp | creation timestamp |
| updated_at    | timestamp | last update        |

---

# 3. Academy Membership

Defines the relationship between users and academies.

Supports multiple roles.

Table: `academy_members`

| column     | type                                | description         |
| ---------- | ----------------------------------- | ------------------- |
| id         | uuid (pk)                           | membership id       |
| academy_id | uuid (fk academies)                 | academy             |
| user_id    | uuid (fk users)                     | user                |
| role       | enum (manager, instructor, student) | role inside academy |
| status     | enum (pending, active, rejected)    | membership status   |
| created_at | timestamp                           | creation timestamp  |

---

# 4. Join Requests

Students request to join an academy.

Managers review and approve/reject requests.

Table: `academy_join_requests`

| column      | type                               | description             |
| ----------- | ---------------------------------- | ----------------------- |
| id          | uuid (pk)                          | request id              |
| academy_id  | uuid                               | academy                 |
| user_id     | uuid                               | student user            |
| status      | enum (pending, approved, rejected) | request status          |
| created_at  | timestamp                          | request creation        |
| reviewed_at | timestamp                          | approval/rejection time |

---

# 5. Belt Systems

Defines the belt structure for an academy.

Example:

white → blue → purple → brown → black

Table: `belt_systems`

| column     | type      | description    |
| ---------- | --------- | -------------- |
| id         | uuid (pk) | belt system id |
| academy_id | uuid      | academy        |
| name       | text      | system name    |

---

# 6. Belts

Individual belts inside a system.

Table: `belts`

| column         | type      | description       |
| -------------- | --------- | ----------------- |
| id             | uuid (pk) | belt id           |
| belt_system_id | uuid      | belt system       |
| name           | text      | belt name         |
| order_index    | integer   | progression order |

Example progression:

| order | belt   |
| ----- | ------ |
| 1     | white  |
| 2     | blue   |
| 3     | purple |
| 4     | brown  |
| 5     | black  |

---

# 7. Student Belt History

Tracks promotions for students.

Table: `student_belt_history`

| column            | type      | description        |
| ----------------- | --------- | ------------------ |
| id                | uuid (pk) | record id          |
| student_member_id | uuid      | student membership |
| belt_id           | uuid      | belt               |
| promotion_date    | date      | promotion date     |
| notes             | text      | optional notes     |

---

# 8. Classes

Represents a scheduled class.

Table: `classes`

| column               | type               | description   |
| -------------------- | ------------------ | ------------- |
| id                   | uuid (pk)          | class id      |
| academy_id           | uuid               | academy       |
| instructor_member_id | uuid               | instructor    |
| name                 | text               | class name    |
| start_time           | timestamp          | class start   |
| end_time             | timestamp          | class end     |
| capacity             | integer (nullable) | max students  |
| created_at           | timestamp          | creation time |

Rules:

- If `capacity` is NULL, the class is **unlimited**.

---

# 9. Class Checkins

Stores attendance records.

Table: `class_checkins`

| column            | type      | description       |
| ----------------- | --------- | ----------------- |
| id                | uuid (pk) | checkin id        |
| class_id          | uuid      | class             |
| student_member_id | uuid      | student           |
| checkin_time      | timestamp | checkin timestamp |

Constraints:

- A student may check in **only once per class**.

---

# 10. Membership Plans

Plans created by managers.

Table: `membership_plans`

| column               | type                              | description        |
| -------------------- | --------------------------------- | ------------------ |
| id                   | uuid (pk)                         | plan id            |
| academy_id           | uuid                              | academy            |
| name                 | text                              | plan name          |
| price                | numeric                           | plan price         |
| billing_period       | enum (monthly, quarterly, custom) | billing cycle      |
| weekly_checkin_limit | integer (nullable)                | weekly class limit |
| created_at           | timestamp                         | creation time      |

Rules:

- `weekly_checkin_limit = NULL` → unlimited attendance.

---

# 11. Student Subscriptions

Represents the plan assigned to a student.

Table: `student_subscriptions`

| column            | type                 | description        |
| ----------------- | -------------------- | ------------------ |
| id                | uuid (pk)            | subscription id    |
| student_member_id | uuid                 | student            |
| plan_id           | uuid                 | membership plan    |
| start_date        | date                 | subscription start |
| end_date          | date                 | subscription end   |
| payment_status    | enum (paid, pending) | payment status     |
| created_at        | timestamp            | creation time      |

---

# 12. Financial Overview (Derived Data)

Financial information should be calculated dynamically.

Examples:

- active_students
- overdue_students
- monthly_revenue

These metrics should be derived from:

- `student_subscriptions`
- `membership_plans`

No separate financial tables are required in the MVP.

---

# 13. Core Business Constraints

1. A user may belong to multiple academies.
2. A student belongs to **only one academy in the MVP**.
3. Classes always belong to a specific academy.
4. Only students may perform class check-ins.
5. Weekly attendance limits must be validated against the student's membership plan.

---

# 14. Suggested Indexes

Indexes for performance optimization:

academy_members (academy_id)
academy_members (user_id)

classes (academy_id)
classes (start_time)

class_checkins (student_member_id)
class_checkins (class_id)

student_subscriptions (student_member_id)

academy_join_requests (academy_id)

---

# 15. Future Schema Extensions

Possible future expansions:

- online payment integrations (Stripe)
- attendance analytics
- competition tracking
- multi-location academies
- training history
- instructor performance metrics
- automated belt promotion suggestions

---
