# Guardian & Dependents - Screen Descriptions

Reference document for UI design. Describes each new or modified screen.

---

## New Screens

### 1. Onboarding - User Type Selection (modified)

**Current:** 3 options - Manager, Instructor, Student
**Change:** Add 4th option - "Responsavel"

- Card with icon, title "Responsavel", subtitle "Gerencie o acesso dos seus filhos na academia"
- Same visual pattern as existing cards
- Selecting "Responsavel" follows the same flow as Student (search academy -> request membership)

---

### 2. Guardian Dependent Onboarding

**When:** After guardian is approved in the academy (first access post-approval)
**Purpose:** Force registration of at least 1 dependent before accessing the app

- Title: "Cadastre seu dependente"
- Subtitle: "Para continuar, cadastre pelo menos um dependente"
- Form fields:
  - Nome (text input, required)
  - Data de nascimento (date picker, required)
  - Faixa atual (belt selector, required - kids belt system TBD, use standard belts for now)
- Button: "Cadastrar dependente"
- After registering first dependent: option to "Adicionar outro" or "Continuar"
- "Continuar" takes to the main app (home)

---

### 3. Dependents List Screen

**Access:** Menu "Mais" -> "Dependentes" (both guardian and student)
**Also:** Guardian home has a direct shortcut card to this screen

- Title: "Meus Dependentes"
- List of dependent cards, each showing:
  - Name
  - Age (calculated from birthDate)
  - Current belt (color indicator + text)
  - Subscription status badge (active/expired/no plan)
- FAB or "+" button to add new dependent
- Tap on card -> Dependent Detail screen
- Empty state: "Nenhum dependente cadastrado" with CTA to add

---

### 4. Dependent Detail Screen

**Access:** Tap on dependent in list

- Header: Dependent name, age, current belt
- Quick info section:
  - Subscription status and plan name
  - Total check-ins this month
  - Last check-in date
- Action buttons (2x2 grid or list):
  - "Historico de check-ins" -> Check-in history filtered by dependent
  - "Assinatura" -> Subscription management for this dependent
  - "Historico de pagamentos" -> Payment history filtered by dependent
  - "Editar" -> Edit dependent form
- "Excluir dependente" button at bottom (destructive, with confirmation dialog)

---

### 5. Add/Edit Dependent Form

**Access:** "+" from dependents list OR "Editar" from dependent detail

- Title: "Novo Dependente" or "Editar Dependente"
- Form fields:
  - Nome (text input, required)
  - Data de nascimento (date picker, required)
  - Faixa atual (belt selector, only on creation - disabled on edit with note "Alteracoes de faixa sao feitas pelo manager")
- Button: "Salvar"

---

### 6. Check-in Dependent Selection Modal

**When:** User with dependents taps check-in on a class

- Bottom sheet modal
- Title: "Check-in para quem?"
- List of options:
  - "Eu" (with user's own name and belt) - only shown if user is Student (not Guardian)
  - Each dependent (name + belt color indicator)
- Tap on option -> proceeds with normal check-in flow for selected person
- Each option shows subscription status indicator (active/expired/grace period)

---

### 7. Guardian Home Screen

**For:** Guardian role only (replaces standard student home)

- Academy header (same as student: academy name, logo)
- Shortcut card: "Meus Dependentes" (prominent, takes to dependents list)
- Today's classes section (same as student - so guardian knows when to bring children)
- Recent activity: latest check-ins/payments across all dependents

---

### 8. Consolidated Subscription Screen

**Access:** Guardian or Student with dependents -> Subscription tab/section

- Shows subscription cards stacked:
  - For Student: own subscription card first, then dependents'
  - For Guardian: only dependents' subscription cards
- Each card shows:
  - Dependent name (or "Minha assinatura" for own)
  - Plan name and price
  - Status badge (active/expired/grace period)
  - Expiry date
  - "Alterar plano" button
- Tap "Alterar plano" -> existing plan selection flow, scoped to that dependent

---

## Modified Screens

### 9. Manager - Member List (modified)

**Change:** Dependents appear in the list alongside regular members

- Dependent entries show:
  - Name
  - Belt
  - Tag/badge: "Dependente"
  - Subtitle: "Responsavel: [guardian name]"
- Tapping a dependent shows a detail view with guardian info
- Filter option: "Dependentes" to filter list to only show dependents

---

### 10. Manager - Pending Members (modified)

**Change:** Guardian requests show indicator

- Guardian membership request shows:
  - Tag: "Responsavel" next to the name
  - Subtitle or note: "Nao treina - gerencia dependentes"
- Approval flow is the same (approve/reject/block)

---

### 11. Manager - Belt Promotion (modified)

**Change:** Dependents appear in student list for promotion

- Dependent shows with guardian indication
- Promotion flow is the same as regular students

---

### 12. Menu "Mais" (modified)

**For:** Guardian and Student with dependents

- Add "Dependentes" menu item (icon: people/family)
- Position: after "Avisos", before other items
- Same pattern as existing menu items (icon + label + chevron)

---

### 13. Class Detail - Attendance List (modified)

**Change:** Dependents appear in attendance/check-in list

- Dependent check-in entries show:
  - Dependent name
  - Small label: "por [guardian name]" indicating who did the check-in
