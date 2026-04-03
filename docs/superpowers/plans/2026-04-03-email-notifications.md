# Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transactional email notifications via Resend + BullMQ queue for Stripe events, student plan enrollment, payment confirmation, and membership approval.

**Architecture:** React Email templates in `packages/email`, BullMQ queue + worker in `apps/api/src/modules/email`, Resend SDK singleton in `apps/api/src/lib/resend.ts`. Worker runs in-process with the API. Jobs carry pre-resolved data — no DB queries in the worker.

**Tech Stack:** Resend SDK, BullMQ, React Email (`@react-email/components`), Redis (existing)

---

### Task 1: Create `packages/email` package with base components

**Files:**
- Create: `packages/email/package.json`
- Create: `packages/email/tsconfig.json`
- Create: `packages/email/src/index.ts`
- Create: `packages/email/src/render.ts`
- Create: `packages/email/src/templates/components/layout.tsx`
- Create: `packages/email/src/templates/components/button.tsx`
- Create: `packages/email/src/templates/components/heading.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@tatame/email",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "email dev --dir src/templates",
    "lint": "echo \"no lint configured\""
  },
  "dependencies": {
    "@react-email/components": "0.0.36",
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "react-email": "4.0.9",
    "typescript": "5.9.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Create layout component**

Create `packages/email/src/templates/components/layout.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

type LayoutProps = {
  preview: string;
  children: ReactNode;
};

export function Layout({ preview, children }: LayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://apptatame.com.br/logo.png"
              width="120"
              height="40"
              alt="Tatame"
            />
          </Section>
          <Section style={content}>{children}</Section>
          <Section style={footer}>
            <Text style={footerText}>
              Tatame — Gestão de academias de artes marciais
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "20px 40px",
};

const content = {
  padding: "0 40px",
};

const footer = {
  padding: "20px 40px",
  borderTop: "1px solid #e6ebf1",
};

const footerText = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};
```

- [ ] **Step 4: Create button component**

Create `packages/email/src/templates/components/button.tsx`:

```tsx
import { Button as EmailButton } from "@react-email/components";

type ButtonProps = {
  href: string;
  children: string;
};

export function Button({ href, children }: ButtonProps) {
  return (
    <EmailButton style={buttonStyle} href={href}>
      {children}
    </EmailButton>
  );
}

const buttonStyle = {
  backgroundColor: "#000000",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 20px",
};
```

- [ ] **Step 5: Create heading component**

Create `packages/email/src/templates/components/heading.tsx`:

```tsx
import { Heading as EmailHeading } from "@react-email/components";
import type { ReactNode } from "react";

type HeadingProps = {
  children: ReactNode;
};

export function Heading({ children }: HeadingProps) {
  return <EmailHeading style={headingStyle}>{children}</EmailHeading>;
}

const headingStyle = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "0 0 16px",
  padding: "0",
};
```

- [ ] **Step 6: Create render utility**

Create `packages/email/src/render.ts`:

```tsx
import { render } from "@react-email/components";
import type { ReactElement } from "react";

export async function renderEmail(element: ReactElement): Promise<string> {
  return render(element);
}
```

- [ ] **Step 7: Create index.ts with exports**

Create `packages/email/src/index.ts`:

```ts
export { renderEmail } from "./render.js";
export { Layout } from "./templates/components/layout.js";
export { Button } from "./templates/components/button.js";
export { Heading } from "./templates/components/heading.js";
```

- [ ] **Step 8: Install dependencies and verify build**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm install && pnpm --filter @tatame/email build
```
Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/email/
git commit -m "feat(email): create packages/email with React Email base components"
```

---

### Task 2: Create email templates

**Files:**
- Create: `packages/email/src/templates/invoice-paid.tsx`
- Create: `packages/email/src/templates/payment-failed.tsx`
- Create: `packages/email/src/templates/pro-activated.tsx`
- Create: `packages/email/src/templates/subscription-canceled.tsx`
- Create: `packages/email/src/templates/plan-enrolled.tsx`
- Create: `packages/email/src/templates/payment-confirmed.tsx`
- Create: `packages/email/src/templates/member-approved.tsx`
- Create: `packages/email/src/templates/manager-new-member.tsx`
- Modify: `packages/email/src/index.ts`

- [ ] **Step 1: Create invoice-paid template**

Create `packages/email/src/templates/invoice-paid.tsx`:

```tsx
import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type InvoicePaidProps = {
  managerName: string;
  academyName: string;
  amountCents: number;
  invoiceUrl?: string;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function InvoicePaid({
  managerName,
  academyName,
  amountCents,
  invoiceUrl,
}: InvoicePaidProps) {
  return (
    <Layout preview={`Fatura paga — ${formatBRL(amountCents)}`}>
      <Heading>Fatura paga</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        A fatura da academia <strong>{academyName}</strong> no valor de{" "}
        <strong>{formatBRL(amountCents)}</strong> foi paga com sucesso.
      </Text>
      {invoiceUrl && (
        <Text style={text}>
          <a href={invoiceUrl} style={link}>
            Ver detalhes da fatura
          </a>
        </Text>
      )}
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};

const link = {
  color: "#2563eb",
  textDecoration: "underline",
};
```

- [ ] **Step 2: Create payment-failed template**

Create `packages/email/src/templates/payment-failed.tsx`:

```tsx
import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type PaymentFailedProps = {
  managerName: string;
  academyName: string;
  amountCents: number;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PaymentFailed({
  managerName,
  academyName,
  amountCents,
}: PaymentFailedProps) {
  return (
    <Layout preview="Falha no pagamento da sua assinatura">
      <Heading>Falha no pagamento</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        Não foi possível processar o pagamento de{" "}
        <strong>{formatBRL(amountCents)}</strong> da academia{" "}
        <strong>{academyName}</strong>.
      </Text>
      <Text style={text}>
        Por favor, verifique seus dados de pagamento para evitar a suspensão do
        plano Pro.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
```

- [ ] **Step 3: Create pro-activated template**

Create `packages/email/src/templates/pro-activated.tsx`:

```tsx
import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type ProActivatedProps = {
  managerName: string;
  academyName: string;
};

export function ProActivated({
  managerName,
  academyName,
}: ProActivatedProps) {
  return (
    <Layout preview="Plano Pro ativado!">
      <Heading>Bem-vindo ao plano Pro!</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        O plano Pro da academia <strong>{academyName}</strong> foi ativado com
        sucesso. Agora você tem acesso a todos os recursos sem limitações.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
```

- [ ] **Step 4: Create subscription-canceled template**

Create `packages/email/src/templates/subscription-canceled.tsx`:

```tsx
import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type SubscriptionCanceledProps = {
  managerName: string;
  academyName: string;
  endsAt: string;
};

export function SubscriptionCanceled({
  managerName,
  academyName,
  endsAt,
}: SubscriptionCanceledProps) {
  return (
    <Layout preview="Assinatura cancelada">
      <Heading>Assinatura cancelada</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        A assinatura Pro da academia <strong>{academyName}</strong> foi
        cancelada. Seu acesso ao plano Pro permanece ativo até{" "}
        <strong>{endsAt}</strong>.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
```

- [ ] **Step 5: Create plan-enrolled template**

Create `packages/email/src/templates/plan-enrolled.tsx`:

```tsx
import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type PlanEnrolledProps = {
  studentName: string;
  planName: string;
  academyName: string;
  startsAt: string;
  expiresAt: string;
};

export function PlanEnrolled({
  studentName,
  planName,
  academyName,
  startsAt,
  expiresAt,
}: PlanEnrolledProps) {
  return (
    <Layout preview={`Inscrição realizada — ${planName}`}>
      <Heading>Inscrição realizada!</Heading>
      <Text style={text}>Olá, {studentName}!</Text>
      <Text style={text}>
        Você foi inscrito no plano <strong>{planName}</strong> da academia{" "}
        <strong>{academyName}</strong>.
      </Text>
      <Text style={text}>
        Período: <strong>{startsAt}</strong> até <strong>{expiresAt}</strong>
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
```

- [ ] **Step 6: Create payment-confirmed template**

Create `packages/email/src/templates/payment-confirmed.tsx`:

```tsx
import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type PaymentConfirmedProps = {
  studentName: string;
  academyName: string;
  amountCents: number;
  referenceMonth: string;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PaymentConfirmed({
  studentName,
  academyName,
  amountCents,
  referenceMonth,
}: PaymentConfirmedProps) {
  return (
    <Layout preview={`Pagamento confirmado — ${formatBRL(amountCents)}`}>
      <Heading>Pagamento confirmado</Heading>
      <Text style={text}>Olá, {studentName}!</Text>
      <Text style={text}>
        Seu pagamento de <strong>{formatBRL(amountCents)}</strong> referente ao
        mês <strong>{referenceMonth}</strong> na academia{" "}
        <strong>{academyName}</strong> foi confirmado.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
```

- [ ] **Step 7: Create member-approved template**

Create `packages/email/src/templates/member-approved.tsx`:

```tsx
import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type MemberApprovedProps = {
  memberName: string;
  academyName: string;
  role: "student" | "instructor";
};

const roleLabel: Record<string, string> = {
  student: "aluno",
  instructor: "instrutor",
};

export function MemberApproved({
  memberName,
  academyName,
  role,
}: MemberApprovedProps) {
  return (
    <Layout preview={`Aprovado na ${academyName}!`}>
      <Heading>Você foi aprovado!</Heading>
      <Text style={text}>Olá, {memberName}!</Text>
      <Text style={text}>
        Sua solicitação para entrar na academia{" "}
        <strong>{academyName}</strong> como{" "}
        <strong>{roleLabel[role] ?? role}</strong> foi aprovada.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
```

- [ ] **Step 8: Create manager-new-member template**

Create `packages/email/src/templates/manager-new-member.tsx`:

```tsx
import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type ManagerNewMemberProps = {
  managerName: string;
  memberName: string;
  academyName: string;
  role: "student" | "instructor";
};

const roleLabel: Record<string, string> = {
  student: "aluno",
  instructor: "instrutor",
};

export function ManagerNewMember({
  managerName,
  memberName,
  academyName,
  role,
}: ManagerNewMemberProps) {
  return (
    <Layout preview={`Novo ${roleLabel[role] ?? role} aprovado`}>
      <Heading>Novo membro aprovado</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        <strong>{memberName}</strong> foi aprovado como{" "}
        <strong>{roleLabel[role] ?? role}</strong> na academia{" "}
        <strong>{academyName}</strong>.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
```

- [ ] **Step 9: Update index.ts exports**

Replace `packages/email/src/index.ts`:

```ts
export { renderEmail } from "./render.js";

// Components
export { Layout } from "./templates/components/layout.js";
export { Button } from "./templates/components/button.js";
export { Heading } from "./templates/components/heading.js";

// Templates
export { InvoicePaid, type InvoicePaidProps } from "./templates/invoice-paid.js";
export { PaymentFailed, type PaymentFailedProps } from "./templates/payment-failed.js";
export { ProActivated, type ProActivatedProps } from "./templates/pro-activated.js";
export { SubscriptionCanceled, type SubscriptionCanceledProps } from "./templates/subscription-canceled.js";
export { PlanEnrolled, type PlanEnrolledProps } from "./templates/plan-enrolled.js";
export { PaymentConfirmed, type PaymentConfirmedProps } from "./templates/payment-confirmed.js";
export { MemberApproved, type MemberApprovedProps } from "./templates/member-approved.js";
export { ManagerNewMember, type ManagerNewMemberProps } from "./templates/manager-new-member.js";
```

- [ ] **Step 10: Build and verify**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/email build
```
Expected: Build succeeds.

- [ ] **Step 11: Commit**

```bash
git add packages/email/src/templates/ packages/email/src/index.ts
git commit -m "feat(email): add all 8 email templates with React Email"
```

---

### Task 3: Add env config + Resend singleton + BullMQ dependencies

**Files:**
- Modify: `packages/config/src/env.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/src/lib/resend.ts`

- [ ] **Step 1: Add RESEND_API_KEY to env schema**

In `packages/config/src/env.ts`, add after the `STRIPE_PRO_PRICE_ID` line (line 26):

```typescript
  RESEND_API_KEY: z.string().optional(),
```

- [ ] **Step 2: Create Resend singleton**

Create `apps/api/src/lib/resend.ts`:

```typescript
import { Resend } from "resend";
import { loadEnv } from "@tatame/config";

let resendInstance: Resend | null = null;

export function getResend(): Resend | null {
  const env = loadEnv();
  if (!env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    resendInstance = new Resend(env.RESEND_API_KEY);
  }
  return resendInstance;
}
```

- [ ] **Step 3: Install resend and bullmq in the API**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/api add resend bullmq && pnpm --filter @tatame/api add -D @types/react
```

- [ ] **Step 4: Add @tatame/email dependency to the API**

In `apps/api/package.json`, add to `dependencies`:

```json
"@tatame/email": "workspace:*",
```

Then run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm install
```

- [ ] **Step 5: Build to verify**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/config build && pnpm --filter @tatame/email build && pnpm --filter @tatame/api build
```
Expected: All packages build successfully.

- [ ] **Step 6: Commit**

```bash
git add packages/config/src/env.ts apps/api/src/lib/resend.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): add Resend SDK, BullMQ deps, and RESEND_API_KEY env config"
```

---

### Task 4: Create email queue, worker, and service

**Files:**
- Create: `apps/api/src/modules/email/email.queue.ts`
- Create: `apps/api/src/modules/email/email.worker.ts`
- Create: `apps/api/src/modules/email/email.service.ts`

- [ ] **Step 1: Create email queue with job types**

Create `apps/api/src/modules/email/email.queue.ts`:

```typescript
import { Queue } from "bullmq";
import type { InvoicePaidProps } from "@tatame/email";
import type { PaymentFailedProps } from "@tatame/email";
import type { ProActivatedProps } from "@tatame/email";
import type { SubscriptionCanceledProps } from "@tatame/email";
import type { PlanEnrolledProps } from "@tatame/email";
import type { PaymentConfirmedProps } from "@tatame/email";
import type { MemberApprovedProps } from "@tatame/email";
import type { ManagerNewMemberProps } from "@tatame/email";

export type EmailJobMap = {
  "invoice-paid": InvoicePaidProps & { email: string };
  "payment-failed": PaymentFailedProps & { email: string };
  "pro-activated": ProActivatedProps & { email: string };
  "subscription-canceled": SubscriptionCanceledProps & { email: string };
  "plan-enrolled": PlanEnrolledProps & { email: string };
  "payment-confirmed": PaymentConfirmedProps & { email: string };
  "member-approved": MemberApprovedProps & { email: string };
  "manager-new-member": ManagerNewMemberProps & { email: string };
};

export type EmailJobName = keyof EmailJobMap;

let emailQueue: Queue | null = null;

export function getEmailQueue(redisUrl: string): Queue {
  if (!emailQueue) {
    emailQueue = new Queue("email", {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return emailQueue;
}

export async function closeEmailQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
}
```

- [ ] **Step 2: Create email worker**

Create `apps/api/src/modules/email/email.worker.ts`:

```typescript
import { Worker, type Job } from "bullmq";
import { createElement } from "react";
import {
  renderEmail,
  InvoicePaid,
  PaymentFailed,
  ProActivated,
  SubscriptionCanceled,
  PlanEnrolled,
  PaymentConfirmed,
  MemberApproved,
  ManagerNewMember,
} from "@tatame/email";
import { getResend } from "../../lib/resend.js";
import type { EmailJobMap, EmailJobName } from "./email.queue.js";

const FROM = "Tatame <noreply@apptatame.com.br>";

const subjectMap: Record<EmailJobName, (data: any) => string> = {
  "invoice-paid": () => "Fatura paga com sucesso",
  "payment-failed": () => "Falha no pagamento da sua assinatura",
  "pro-activated": () => "Bem-vindo ao plano Pro!",
  "subscription-canceled": () => "Assinatura cancelada",
  "plan-enrolled": (d) => `Inscrição realizada — ${d.planName}`,
  "payment-confirmed": () => "Pagamento confirmado",
  "member-approved": (d) => `Aprovado na ${d.academyName}!`,
  "manager-new-member": () => "Novo membro aprovado",
};

type TemplateComponent = (props: any) => React.ReactElement;

const templateMap: Record<EmailJobName, TemplateComponent> = {
  "invoice-paid": InvoicePaid,
  "payment-failed": PaymentFailed,
  "pro-activated": ProActivated,
  "subscription-canceled": SubscriptionCanceled,
  "plan-enrolled": PlanEnrolled,
  "payment-confirmed": PaymentConfirmed,
  "member-approved": MemberApproved,
  "manager-new-member": ManagerNewMember,
};

async function processEmailJob(job: Job): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(
      `[email] RESEND_API_KEY not set, skipping job ${job.name}:${job.id}`,
    );
    return;
  }

  const jobName = job.name as EmailJobName;
  const { email, ...templateProps } = job.data as EmailJobMap[typeof jobName] & {
    email: string;
  };

  const Template = templateMap[jobName];
  if (!Template) {
    console.error(`[email] Unknown job name: ${jobName}`);
    return;
  }

  const html = await renderEmail(createElement(Template, templateProps));
  const subject = subjectMap[jobName](job.data);

  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject,
    html,
    headers: {
      "X-Entity-Ref-ID": job.id ?? `${jobName}-${Date.now()}`,
    },
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

let emailWorker: Worker | null = null;

export function startEmailWorker(redisUrl: string): Worker {
  if (emailWorker) return emailWorker;

  emailWorker = new Worker("email", processEmailJob, {
    connection: { url: redisUrl },
    concurrency: 5,
  });

  emailWorker.on("failed", (job, err) => {
    console.error(`[email] Job ${job?.name}:${job?.id} failed:`, err.message);
  });

  return emailWorker;
}

export async function closeEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }
}
```

- [ ] **Step 3: Create email service**

Create `apps/api/src/modules/email/email.service.ts`:

```typescript
import type { Queue } from "bullmq";
import type { EmailJobMap, EmailJobName } from "./email.queue.js";

export class EmailService {
  constructor(private readonly queue: Queue) {}

  private async enqueue<N extends EmailJobName>(
    name: N,
    data: EmailJobMap[N],
    jobId: string,
  ): Promise<void> {
    await this.queue.add(name, data, { jobId });
  }

  async sendInvoicePaid(
    data: EmailJobMap["invoice-paid"],
    stripeInvoiceId: string,
  ) {
    await this.enqueue("invoice-paid", data, `invoice-paid:${stripeInvoiceId}`);
  }

  async sendPaymentFailed(
    data: EmailJobMap["payment-failed"],
    stripeInvoiceId: string,
  ) {
    await this.enqueue(
      "payment-failed",
      data,
      `payment-failed:${stripeInvoiceId}`,
    );
  }

  async sendProActivated(
    data: EmailJobMap["pro-activated"],
    stripeSubscriptionId: string,
  ) {
    await this.enqueue(
      "pro-activated",
      data,
      `pro-activated:${stripeSubscriptionId}`,
    );
  }

  async sendSubscriptionCanceled(
    data: EmailJobMap["subscription-canceled"],
    stripeSubscriptionId: string,
  ) {
    await this.enqueue(
      "subscription-canceled",
      data,
      `subscription-canceled:${stripeSubscriptionId}`,
    );
  }

  async sendPlanEnrolled(
    data: EmailJobMap["plan-enrolled"],
    studentSubscriptionId: string,
  ) {
    await this.enqueue(
      "plan-enrolled",
      data,
      `plan-enrolled:${studentSubscriptionId}`,
    );
  }

  async sendPaymentConfirmed(
    data: EmailJobMap["payment-confirmed"],
    paymentId: string,
  ) {
    await this.enqueue(
      "payment-confirmed",
      data,
      `payment-confirmed:${paymentId}`,
    );
  }

  async sendMemberApproved(
    data: EmailJobMap["member-approved"],
    membershipId: string,
  ) {
    await this.enqueue(
      "member-approved",
      data,
      `member-approved:${membershipId}`,
    );
  }

  async sendManagerNewMember(
    data: EmailJobMap["manager-new-member"],
    membershipId: string,
  ) {
    await this.enqueue(
      "manager-new-member",
      data,
      `manager-new-member:${membershipId}`,
    );
  }
}
```

- [ ] **Step 4: Build to verify**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/api build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/email/
git commit -m "feat(api): add email queue, worker, and service with BullMQ"
```

---

### Task 5: Wire up worker startup and graceful shutdown in server.ts

**Files:**
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Add worker startup and shutdown**

Replace the contents of `apps/api/src/server.ts`:

```typescript
import "./env-bootstrap.js";
import { loadEnv } from "@tatame/config";
import { createApp } from "./app.js";
import { runMigrations } from "./migrate.js";
import { getEmailQueue, closeEmailQueue } from "./modules/email/email.queue.js";
import { startEmailWorker, closeEmailWorker } from "./modules/email/email.worker.js";

const env = loadEnv();

if (env.NODE_ENV === "production") {
  console.log("Running database migrations...");
  await runMigrations(env.DATABASE_URL, "./drizzle");
}

const app = createApp();

// Start email worker if Redis is available
if (env.REDIS_URL) {
  startEmailWorker(env.REDIS_URL);
  console.log("[email] Worker started");
}

const server = app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}/v1`);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down...");
  server.close();
  await closeEmailWorker();
  await closeEmailQueue();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

- [ ] **Step 2: Build to verify**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/api build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat(api): start email worker on boot with graceful shutdown"
```

---

### Task 6: Integrate email notifications into Stripe webhook handler

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/stripe-webhook.handler.ts`
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`

- [ ] **Step 1: Add EmailService dependency to StripeWebhookHandler**

Modify `apps/api/src/modules/manager-subscription/stripe-webhook.handler.ts` to accept an `EmailService` and user/academy repositories. The handler needs to resolve manager name and email from the DB.

Replace the constructor and add imports:

```typescript
import Stripe from "stripe";
import type { IClassRepository } from "../class/class.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { ISubscriptionPlanRepository } from "../subscription/subscription.repository.js";
import type { IManagerSubscriptionRepository } from "./manager-subscription.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";
import { mapStripeStatus } from "./stripe-status.js";

const FREE_STUDENT_LIMIT = 50;
const FREE_PLAN_LIMIT = 1;
const FREE_DAILY_SCHEDULE_LIMIT = 2;

export class StripeWebhookHandler {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly memRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly planRepo: ISubscriptionPlanRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
  ) {}
```

- [ ] **Step 2: Add email sending to onSubscriptionCreated**

After the `subRepo.update` call in `onSubscriptionCreated`, add:

```typescript
  private async onSubscriptionCreated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof stripeSub.customer === "string"
        ? stripeSub.customer
        : stripeSub.customer.id;

    const row = await this.subRepo.findByStripeCustomerId(customerId);
    if (!row) return;

    await this.subRepo.update(row.id, {
      plan: "pro",
      status: "active",
      stripeSubscriptionId: stripeSub.id,
      currentPeriodEnd: this.getPeriodEndFromStripeSub(stripeSub),
    });

    if (this.emailService) {
      const academy = await this.academyRepo.findById(row.academyId);
      if (academy) {
        const owner = await this.userRepo.findByClerkId(academy.ownerId);
        if (owner) {
          await this.emailService.sendProActivated(
            {
              email: owner.email,
              managerName: owner.name,
              academyName: academy.name,
            },
            stripeSub.id,
          );
        }
      }
    }
  }
```

Note: `academy.ownerId` stores the clerk user id based on the schema. Check `findByClerkId` — if `ownerId` is actually the internal `users.id`, use a different method. Looking at the schema, `academies.ownerId` references `users.id`, so we need `findById` on user repo. Let me check.

Actually, looking at the academy schema more carefully — `ownerId` is the `users.id` UUID. The `IUserRepository` doesn't have `findById`. We need to look up the user by their ID. Let me check membership routes — they use `userId` which comes from Clerk auth. Let me trace this.

Looking at the codebase, the `ownerId` field on academies stores the `users.id` (UUID). The `IUserRepository` only has `findByClerkId`. We need a `findById` method, but adding that is scope creep. Instead, we can query the users table directly via the existing DB instance in the routes file.

A simpler approach: add the email/name lookup directly in the webhook handler using a helper repository method. But the cleanest approach is to add `findById` to `IUserRepository`.

Let me revise — we'll add a minimal `findById` to the user repository interface and postgres implementation.

- [ ] **Step 2 (revised): Add findById to IUserRepository**

In `apps/api/src/modules/user/user.repository.ts`, add to the interface:

```typescript
  findById(userId: string): Promise<UserRow | undefined>;
```

In `apps/api/src/modules/user/user.repository.postgres.ts`, add the implementation (find the class and add the method):

```typescript
  async findById(userId: string): Promise<UserRow | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0];
  }
```

In `apps/api/src/modules/user/user.repository.in-memory.ts`, add the implementation:

```typescript
  async findById(userId: string): Promise<UserRow | undefined> {
    return this.rows.find((r) => r.id === userId);
  }
```

- [ ] **Step 3: Add email to onInvoicePaid**

In the `onInvoicePaid` method, after `subRepo.update`, add:

```typescript
  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subRef = invoice.parent?.subscription_details?.subscription;
    const subId = typeof subRef === "string" ? subRef : subRef?.id;
    if (!subId) return;

    const row = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!row) return;

    await this.subRepo.update(row.id, { status: "active" });

    if (this.emailService) {
      const academy = await this.academyRepo.findById(row.academyId);
      if (academy) {
        const owner = await this.userRepo.findById(academy.ownerId);
        if (owner) {
          await this.emailService.sendInvoicePaid(
            {
              email: owner.email,
              managerName: owner.name,
              academyName: academy.name,
              amountCents: invoice.amount_paid ?? 0,
              invoiceUrl: invoice.hosted_invoice_url ?? undefined,
            },
            invoice.id,
          );
        }
      }
    }
  }
```

- [ ] **Step 4: Add email to onInvoicePaymentFailed**

```typescript
  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subRef = invoice.parent?.subscription_details?.subscription;
    const subId = typeof subRef === "string" ? subRef : subRef?.id;
    if (!subId) return;

    const row = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!row) return;

    await this.subRepo.update(row.id, { status: "past_due" });

    if (this.emailService) {
      const academy = await this.academyRepo.findById(row.academyId);
      if (academy) {
        const owner = await this.userRepo.findById(academy.ownerId);
        if (owner) {
          await this.emailService.sendPaymentFailed(
            {
              email: owner.email,
              managerName: owner.name,
              academyName: academy.name,
              amountCents: invoice.amount_due ?? 0,
            },
            invoice.id,
          );
        }
      }
    }
  }
```

- [ ] **Step 5: Add email to onSubscriptionDeleted**

In `onSubscriptionDeleted`, after the downgrade/cancel logic:

```typescript
  private async onSubscriptionDeleted(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const row = await this.subRepo.findByStripeSubscriptionId(stripeSub.id);
    if (!row) return;

    const canDowngrade = await this.canDowngradeToFree(row.academyId);
    if (canDowngrade) {
      await this.subRepo.update(row.id, {
        plan: "free",
        status: "active",
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        canceledAt: null,
      });
    } else {
      await this.subRepo.update(row.id, {
        status: "canceled",
        canceledAt: new Date(),
      });
    }

    if (this.emailService) {
      const academy = await this.academyRepo.findById(row.academyId);
      if (academy) {
        const owner = await this.userRepo.findById(academy.ownerId);
        if (owner) {
          const periodEnd = this.getPeriodEndFromStripeSub(stripeSub);
          await this.emailService.sendSubscriptionCanceled(
            {
              email: owner.email,
              managerName: owner.name,
              academyName: academy.name,
              endsAt: periodEnd
                ? periodEnd.toLocaleDateString("pt-BR")
                : "imediatamente",
            },
            stripeSub.id,
          );
        }
      }
    }
  }
```

- [ ] **Step 6: Update webhook handler instantiation in routes**

In `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`, update imports and the handler construction:

Add imports:

```typescript
import { loadEnv } from "@tatame/config";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
```

Update instantiation (replace the existing `webhookHandler` creation around line 37-42):

```typescript
const userRepo = new PostgresUserRepository(db);

const env = loadEnv();
const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const webhookHandler = new StripeWebhookHandler(
  subRepo,
  memRepo,
  classRepo,
  planRepo,
  userRepo,
  acadRepo,
  emailService,
);
```

- [ ] **Step 7: Build to verify**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/api build
```
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/manager-subscription/ apps/api/src/modules/user/user.repository.ts apps/api/src/modules/user/user.repository.postgres.ts apps/api/src/modules/user/user.repository.in-memory.ts
git commit -m "feat(api): add email notifications to Stripe webhook events"
```

---

### Task 7: Integrate email into membership approval

**Files:**
- Modify: `apps/api/src/modules/membership/membership.routes.ts`

- [ ] **Step 1: Add email service and user/academy repos to the approve route**

In `apps/api/src/modules/membership/membership.routes.ts`, add imports:

```typescript
import { loadEnv } from "@tatame/config";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
```

Add instantiation after the existing service creations (around line 38):

```typescript
const userRepo = new PostgresUserRepository(db);
const env = loadEnv();
const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;
```

- [ ] **Step 2: Send emails after approval**

In the `/:membershipId/approve` route handler (around line 156), after `membershipService.approve` returns, add email sending:

```typescript
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }

      const pending = await membershipRepo.findById(params.data.membershipId);
      if (pending && req.appAuth?.role === "manager") {
        if (pending.role === "instructor") {
          await managerSubService.canApproveInstructor(req.appAuth.activeAcademyId!);
        } else if (pending.role === "student") {
          await managerSubService.canApproveStudent(req.appAuth.activeAcademyId!);
        }
      }

      const updated = await membershipService.approve(
        params.data.membershipId,
        req.appAuth!.userId,
      );

      // Send email notifications
      if (emailService && updated) {
        const member = await userRepo.findById(updated.userId);
        const academy = await academyRepo.findById(updated.academyId);
        const manager = await userRepo.findById(req.appAuth!.userId);

        if (member && academy) {
          await emailService.sendMemberApproved(
            {
              email: member.email,
              memberName: member.name,
              academyName: academy.name,
              role: updated.role as "student" | "instructor",
            },
            updated.id,
          );

          if (manager) {
            await emailService.sendManagerNewMember(
              {
                email: manager.email,
                managerName: manager.name,
                memberName: member.name,
                academyName: academy.name,
                role: updated.role as "student" | "instructor",
              },
              updated.id,
            );
          }
        }
      }

      res.json(updated);
    } catch (e) {
      next(e);
    }
```

Note: We need to reference the academyRepo. Looking at the existing file, `PostgresAcademyRepository` is already instantiated as part of `MembershipService` constructor but not stored separately. We need to create a reference. Add before the service creation:

```typescript
const academyRepo = new PostgresAcademyRepository(db);
const membershipService = new MembershipService(
  membershipRepo,
  academyRepo,
);
```

(Replace the existing inline `new PostgresAcademyRepository(db)` call.)

- [ ] **Step 3: Build to verify**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/api build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/membership/membership.routes.ts
git commit -m "feat(api): send email notifications on membership approval"
```

---

### Task 8: Integrate email into student plan enrollment

**Files:**
- Modify: `apps/api/src/modules/subscription/subscription.routes.ts`

- [ ] **Step 1: Add email service imports and instantiation**

In `apps/api/src/modules/subscription/subscription.routes.ts`, add:

```typescript
import { loadEnv } from "@tatame/config";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
```

After existing service creations, add:

```typescript
const userRepo = new PostgresUserRepository(db);
const academyRepo = new PostgresAcademyRepository(db);
const env = loadEnv();
const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;
```

Note: `PostgresAcademyRepository` is already imported and used inline. Extract it to a variable (`academyRepo`) and pass it to both `SubscriptionService` and email sending.

- [ ] **Step 2: Send email after plan selection**

In the `POST /me/plan` route handler (around line 238), after `subscriptionService.selectPlan` returns:

```typescript
      const result = await subscriptionService.selectPlan(userId, academyId, planId);

      // Send enrollment email
      if (emailService) {
        const student = await userRepo.findById(userId);
        const academy = await academyRepo.findById(academyId);
        if (student && academy) {
          await emailService.sendPlanEnrolled(
            {
              email: student.email,
              studentName: student.name,
              planName: result.plan.name,
              academyName: academy.name,
              startsAt: result.subscription.startsAt,
              expiresAt: result.subscription.expiresAt,
            },
            result.subscription.id,
          );
        }
      }

      res.status(201).json(result);
```

- [ ] **Step 3: Build to verify**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/api build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/subscription/subscription.routes.ts
git commit -m "feat(api): send email notification on student plan enrollment"
```

---

### Task 9: Integrate email into manual payment confirmation

**Files:**
- Modify: `apps/api/src/modules/payment/payment.routes.ts`

- [ ] **Step 1: Add email service imports and instantiation**

In `apps/api/src/modules/payment/payment.routes.ts`, add:

```typescript
import { loadEnv } from "@tatame/config";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
```

After existing service creations, add:

```typescript
const userRepo = new PostgresUserRepository(db);
const academyRepo = new PostgresAcademyRepository(db);
const env = loadEnv();
const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;
```

Note: `PostgresAcademyRepository` is already imported. Extract the existing inline usage to a shared variable.

- [ ] **Step 2: Send email after payment confirmation**

In the `POST /` route handler (around line 41), after `paymentService.confirmManual` returns:

```typescript
      const created = await paymentService.confirmManual(
        managerUserId,
        academyId,
        body,
      );

      // Send payment confirmation email to student
      if (emailService) {
        const student = await userRepo.findById(created.userId);
        const academy = await academyRepo.findById(academyId);
        if (student && academy) {
          await emailService.sendPaymentConfirmed(
            {
              email: student.email,
              studentName: student.name,
              academyName: academy.name,
              amountCents: created.amountCents,
              referenceMonth: created.referenceMonth,
            },
            created.id,
          );
        }
      }

      res.status(201).json(created);
```

- [ ] **Step 3: Build to verify**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/api build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/payment/payment.routes.ts
git commit -m "feat(api): send email notification on manual payment confirmation"
```

---

### Task 10: Final build verification and update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add RESEND_API_KEY to .env.example**

Add to `.env.example`:

```
# Email (Resend) — optional, emails are skipped when unset
RESEND_API_KEY=
```

- [ ] **Step 2: Full build verification**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm install && pnpm -r build
```
Expected: All packages build successfully.

- [ ] **Step 3: Run existing tests**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/api test:unit
```
Expected: All existing tests pass. If any tests break due to the new constructor parameter in `StripeWebhookHandler`, fix them by adding `null` as the last three constructor arguments (userRepo, academyRepo, emailService).

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: add RESEND_API_KEY to .env.example"
```
