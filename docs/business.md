# Tatame — Product Requirements Document (PRD)

## 1. Product Overview

Tatame is a management platform designed for martial arts academies, initially focused on Brazilian Jiu-Jitsu academies.

The platform aims to provide a modern and simple solution for academy managers to manage:

- students
- class schedules
- attendance
- memberships and payments
- belt graduations

Tatame will be composed of:

- Mobile application (React Native + Expo)
- Backend API (Node.js)
- PostgreSQL database
- Authentication system using Clerk
- Web application (Next.js) for landing page and advanced management tools

The platform will follow a **mobile-first approach**, since most instructors and students interact primarily through mobile devices.

---

# 2. Product Goals

Tatame aims to solve common operational problems faced by martial arts academies:

- manual student management
- difficulty tracking attendance
- informal payment tracking
- lack of structured belt promotion history
- disorganized class schedules

The platform will prioritize:

- simplicity
- speed
- intuitive UX
- modern design

---

# 3. MVP Scope

The MVP will focus on core academy management features:

- academy creation and management
- student onboarding and approval
- class management
- attendance tracking
- membership plans
- basic financial overview
- belt graduation tracking

Online payment processing is **out of scope for the initial MVP**.

Payments will initially be tracked manually.

---

# 4. User Roles

The system has three main roles:

- Manager
- Instructor
- Student

---

# 4.1 Manager

Managers are responsible for running the academy.

Permissions:

- create and edit academy information
- approve or reject student requests
- manage instructors
- create, edit and delete classes
- create membership plans
- assign students to plans
- monitor attendance
- track financial information
- manage belt system and promotions

---

# 4.2 Instructor

Instructors are responsible for teaching classes.

Permissions:

- view class schedule
- create classes
- edit their own classes
- view student list
- manage belt graduations
- edit personal profile

Instructors cannot manage financial data or membership plans.

---

# 4.3 Student

Students are members of the academy.

Permissions:

- request to join an academy
- view class schedule
- check in to classes
- view their belt graduation
- view attendance history
- edit profile

---

# 5. Functional Requirements

---

# 5.1 Authentication

The system must support:

- user registration
- login
- password recovery
- logout

Authentication will be handled by **Clerk**.

---

# 5.2 Academy Management

Managers must be able to:

- create an academy
- edit academy information
- view academy details

Academy data includes:

- academy name
- address
- contact information
- logo (optional)

---

# 5.3 Student Onboarding

Students create their own accounts and request to join an academy.

Flow:

1. Student creates an account.
2. Student sends a join request to an academy.
3. Manager reviews the request.
4. Manager approves or rejects the request.

Once approved, the student becomes part of the academy.

This approach allows academies with large numbers of students to onboard without requiring manual registration by the manager.

---

# 5.4 Instructor Management

Managers must be able to:

- invite instructors
- remove instructors
- view instructor list

Instructors must be able to:

- accept academy invitations

---

# 5.5 Class Management

Managers and instructors must be able to:

- create classes
- edit classes
- cancel classes

A class must contain:

- class name
- instructor
- date
- start time
- end time
- check-in capacity (optional)

If no capacity is defined, the class is considered **unlimited**.

---

# 5.6 Class Schedule

Users must be able to:

- view weekly schedule
- see upcoming classes
- view class details

---

# 5.7 Class Check-In

Students must perform check-in to register attendance.

Check-in rules:

- Check-in opens **12 hours before the class start time**
- Check-in closes **at the end of the class**

Only students can perform check-in in the MVP.

Instructor attendance marking is **not supported initially**.

The system records:

- student
- class
- check-in timestamp

---

# 5.8 Belt Graduation System

Managers and instructors must be able to:

- define the academy belt system
- assign belts to students
- record belt promotions

Promotion data includes:

- belt level
- promotion date
- optional notes

Students must be able to view their belt progression history.

---

# 5.9 Membership Plans

Managers must be able to create membership plans.

Plans define:

- price
- payment periodicity
- weekly attendance limit

Supported payment periods include:

- monthly
- quarterly (3 months)
- custom durations

Attendance rules may include:

- limited number of weekly check-ins (example: 2 per week)
- unlimited access

Students must be assigned to a membership plan.

The system must enforce the weekly attendance limits during check-in.

---

# 5.10 Financial Overview

Managers must be able to view basic financial information:

- number of active students
- number of overdue students
- estimated monthly revenue

Payments will initially be tracked manually using status flags.

Possible payment statuses:

- paid
- pending

---

# 6. Non-Functional Requirements

---

# 6.1 Performance

- API average response time must be below **500ms**.
- Main mobile screens should load in under **2 seconds**.

---

# 6.2 Scalability

The architecture must support growth across multiple academies without major backend redesign.

---

# 6.3 Security

The platform must implement:

- secure authentication via Clerk
- HTTPS-only communication
- role-based access control (RBAC)

---

# 6.4 Availability

The system should maintain at least **99% uptime**.

---

# 6.5 Mobile-First Design

The mobile application is the primary interface of the platform.

The web interface will focus on:

- landing page
- extended manager tools

---

# 6.6 Usability

The platform must prioritize:

- minimal onboarding friction
- simple user flows
- intuitive navigation

---

# 7. Technical Architecture

Initial stack:

Mobile App:

- React Native
- Expo

Backend:

- Node.js
- Express or NestJS

Web:

- Next.js

Database:

- PostgreSQL

Authentication:

- Clerk

---

# 8. Assumptions

- academies typically have between **30 and 300 students**
- instructors may belong to multiple academies
- students belong to **only one academy in the MVP**

---

# 9. Out of Scope (Future Features)

The following features are planned for future versions:

- integrated payment processing
- tournament tracking
- training analytics
- academy marketplace
- automated belt progression recommendations
- wearable integrations

---

# 10. Open Questions (Future Decisions)

Topics to be addressed in future iterations:

- multi-academy organizations
- class reservation systems
- automated payment billing
- instructor attendance management
