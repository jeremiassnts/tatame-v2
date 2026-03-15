# Tatame — Core Business Rules

This document defines the core business rules of the Tatame platform.

These rules describe the domain logic that must be enforced by the backend regardless of the client application (mobile or web).

---

# 1. Academy Membership Rules

## 1.1 User Membership

A user may belong to multiple academies.

Each relationship between a user and an academy is represented by the `academy_members` table.

Example:

User A
Academy X → Instructor
Academy Y → Student

---

## 1.2 Membership Status

Memberships may have the following status:

- `pending`
- `active`
- `rejected`

Definitions:

- **pending** → waiting for manager approval
- **active** → member has access to the academy
- **rejected** → membership denied

---

## 1.3 Rejected Memberships

If a student is rejected by a manager:

- the student becomes **blocked from requesting access again**
- only a **manager can manually unblock the student**

---

## 1.4 Single Active Academy for Students

Students may belong to **only one active academy at a time**.

If a student wants to join another academy:

1. The student must **leave the current academy**.
2. Then the student may request access to another academy.

---

# 2. Student Enrollment Rules

## 2.1 Enrollment Flow

The student onboarding flow is:

1. Student creates an account.
2. Student requests to join an academy.
3. Manager reviews the request.
4. Manager approves or rejects the request.

When approved:

- a record in `academy_members` becomes `active`
- role = `student`

---

# 3. Class Rules

## 3.1 Class Ownership

Every class belongs to a specific academy.

The instructor assigned to the class must be a member of the same academy.

Constraint:

```
classes.instructor_member_id must belong to classes.academy_id
```

---

## 3.2 Class Capacity

Classes may define a capacity limit.

Rules:

- `capacity = NULL` → unlimited attendance
- `capacity = number` → check-ins are limited

If the capacity is reached:

- **no additional check-ins are allowed**

This rule applies only to that specific class instance.

---

# 4. Check-in Rules

Check-in logic is a critical system feature.

---

## 4.1 Check-in Window

Students may check in during the following window:

- **12 hours before class start**
- **until class end time**

Example:

Class start: 19:00
Check-in opens: 07:00
Check-in closes: class end time

---

## 4.2 Single Check-in Per Class

A student may only check in **once per class**.

Database constraint:

```
unique(student_member_id, class_id)
```

---

## 4.3 Active Subscription Requirement

A student must have an **active subscription** to perform a check-in.

Validation:

```
current_date <= subscription.end_date
```

If the subscription expired, check-in is blocked.

---

## 4.4 Weekly Check-in Limits

Membership plans may define a weekly check-in limit.

Example:

Plan:

```
weekly_checkin_limit = 2
```

The system must count how many check-ins the student has performed during the current week.

Week definition:

```
Monday → Sunday
```

If the limit is reached:

- the system must block additional check-ins until the next week.

---

## 4.5 Capacity Validation

If a class has a defined capacity:

```
current_checkins >= capacity
```

Then:

```
reject checkin
```

---

# 5. Membership Plan Rules

## 5.1 Plan Assignment

Every active student must have a `student_subscription`.

Subscriptions link students to membership plans.

---

## 5.2 Subscription Validity

Students may attend classes **until the subscription end date**.

Example:

Subscription ends: May 10

Student may attend classes **on May 10**, but not after.

---

## 5.3 Billing Periods

Plans may define different billing periods.

Examples:

- monthly
- quarterly
- custom duration

---

## 5.4 Weekly Attendance Limits

Plans may define weekly attendance limits.

Examples:

Unlimited plan:

```
weekly_checkin_limit = NULL
```

Limited plan:

```
weekly_checkin_limit = 2
```

---

# 6. Financial Rules

## 6.1 Payment Tracking

Payment tracking is manual in the MVP.

Payment status values:

- `paid`
- `pending`

---

## 6.2 Overdue Payments

If a payment becomes overdue:

- the student may continue attending classes for **3 additional days**

During this grace period:

- the system must display a warning

After the grace period:

- the student becomes **blocked from check-ins**

---

# 7. Belt Promotion Rules

## 7.1 Promotion Authority

Belt promotions may be performed by:

- managers
- instructors

Both roles have permission to register promotions.

---

## 7.2 Promotion History

Every promotion must create a record in:

```
student_belt_history
```

The record must include:

- belt
- promotion date
- optional notes

Promotion history must never be deleted.

---

# 8. Security and Access Rules

## 8.1 Academy Data Isolation

Users may only access data belonging to academies where they have membership.

Example:

If a user belongs to Academy A:

- they cannot access data from Academy B.

---

## 8.2 Role-Based Permissions

Manager permissions:

- manage academy
- manage instructors
- manage students
- manage plans
- manage classes
- view financial data
- promote belts

Instructor permissions:

- manage their classes
- view students
- promote belts

Student permissions:

- view classes
- check in to classes
- view personal data
- view belt history

---

# 9. Edge Cases

## 9.1 Late Check-in Attempt

If a student attempts to check in after the class has ended:

Result:

```
reject checkin
```

---

## 9.2 No Active Subscription

If a student attempts to check in without an active subscription:

Result:

```
reject checkin
```

---

## 9.3 Class Capacity Reached

If a class reaches its capacity:

Result:

```
reject checkin
```

---

# 10. Future Extensions

Possible future rules and features:

- online payment integration
- class reservation system
- automated belt progression suggestions
- attendance analytics
- instructor performance metrics
- competition tracking
