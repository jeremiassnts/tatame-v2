# Tatame — Check-in Validation Algorithm

This document defines the backend validation logic required when a student attempts to check in to a class.

Check-in is one of the most critical operations in the system and must enforce business rules strictly.

---

# 1. Overview

A check-in request occurs when a student attempts to attend a class.

Example request:

```
POST /classes/{classId}/checkin
```

Authenticated user must be a **student**.

---

# 2. High-Level Flow

The system must validate the request in the following order:

1. Validate academy membership
2. Validate student role
3. Validate class existence
4. Validate check-in window
5. Validate subscription status
6. Validate overdue payment grace period
7. Validate weekly attendance limit
8. Validate class capacity
9. Prevent duplicate check-ins
10. Create check-in record

---

# 3. Validation Steps

---

# Step 1 — Validate Membership

The user must be an **active student** in the academy that owns the class.

Validation:

```
academy_members.status = active
academy_members.role = student
```

If not valid:

Result:

```
reject checkin
```

---

# Step 2 — Validate Class

The class must exist.

The class must belong to the student's academy.

If not:

```
reject checkin
```

---

# Step 3 — Validate Check-in Window

Check-in is allowed:

- from **12 hours before class start**
- until **class end time**

Example:

Class start: 19:00
Check-in opens: 07:00

Validation:

```
now >= class.start_time - 12h
AND
now <= class.end_time
```

If not valid:

```
reject checkin
```

---

# Step 4 — Validate Active Subscription

The student must have an active subscription.

Validation:

```
current_date <= subscription.end_date
```

If subscription expired:

```
reject checkin
```

---

# Step 5 — Validate Payment Status

If payment status is `paid`:

```
continue
```

If payment status is `pending`:

Check grace period.

Grace period:

```
3 days after payment due date
```

If within grace period:

- allow check-in
- return warning flag

If beyond grace period:

```
reject checkin
```

---

# Step 6 — Validate Weekly Check-in Limit

If plan has unlimited check-ins:

```
weekly_checkin_limit = NULL
```

Skip validation.

If plan has a limit:

Example:

```
weekly_checkin_limit = 2
```

The system must count check-ins between:

```
Monday 00:00
Sunday 23:59
```

Query example:

```
count(checkins)
WHERE student_member_id = X
AND checkin_time BETWEEN week_start AND week_end
```

If:

```
count >= weekly_checkin_limit
```

Then:

```
reject checkin
```

---

# Step 7 — Validate Class Capacity

If class capacity is NULL:

```
unlimited
```

If capacity exists:

Example:

```
capacity = 20
```

Count current check-ins.

If:

```
current_checkins >= capacity
```

Then:

```
reject checkin
```

---

# Step 8 — Prevent Duplicate Check-in

Ensure a student cannot check in twice.

Constraint:

```
unique(student_member_id, class_id)
```

If check-in already exists:

```
reject checkin
```

---

# Step 9 — Create Check-in

If all validations pass:

Insert record:

```
class_checkins
```

Fields:

```
id
class_id
student_member_id
checkin_time
```

---

# 4. Concurrency Protection

Multiple students may attempt check-in simultaneously.

To prevent exceeding class capacity, the backend must enforce **transactional validation**.

Recommended approach:

```
database transaction
```

Steps:

1. Lock class row
2. Count check-ins
3. Validate capacity
4. Insert check-in
5. Commit transaction

Example approach:

```
SELECT ... FOR UPDATE
```

This prevents race conditions.

---

# 5. Check-in Response

Possible responses:

Success:

```
200 OK
{
  success: true
}
```

Grace period warning:

```
200 OK
{
  success: true,
  warning: "payment_overdue"
}
```

Rejected:

```
400
{
  error: "weekly_limit_reached"
}
```

Other error codes:

```
class_full
checkin_window_closed
subscription_expired
not_academy_member
duplicate_checkin
```

---

# 6. Performance Considerations

Indexes required:

```
class_checkins (class_id)
class_checkins (student_member_id)
class_checkins (checkin_time)
```

These indexes allow fast weekly limit validation.

---

# 7. Future Enhancements

Possible future improvements:

- instructor attendance override
- QR code check-in
- geolocation validation
- anti-fraud check-ins
- waitlist for full classes

```

```
