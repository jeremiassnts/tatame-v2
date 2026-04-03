# Email Notifications Design

## Overview

Sistema de envio de emails transacionais para o Tatame, usando Resend SDK + React Email para templates + BullMQ (Redis) para fila de processamento com retry automático.

## Decisões Globais

- **Idioma:** Português brasileiro, sem i18n
- **Remetente:** Fixo — `Tatame <noreply@apptatame.com.br>`
- **Templates:** React Email (JSX → HTML), mantidos no projeto em `packages/email`
- **Estilo:** Simples e funcional — logo, texto, botão CTA quando aplicável (estilo transacional)
- **Fila:** BullMQ com Redis (mesma instância já usada para locks de check-in)
- **Worker:** Roda no mesmo processo da API (sem worker separado)
- **RESEND_API_KEY:** Opcional — sem chave, jobs são descartados com log warning

## Arquitetura

```
Service (ex: stripe-webhook.handler)
  → emailQueue.add('invoice-paid', { managerId, invoiceData })
    → BullMQ Queue (Redis)
      → Email Worker (mesmo processo, consome a fila)
        → Renderiza template React Email → HTML
        → Envia via Resend SDK
        → Retry automático em caso de falha (3 tentativas, backoff exponencial)
```

## Estrutura de Pastas

```
packages/
  email/
    src/
      templates/
        components/
          layout.tsx              # Layout base (logo, footer, wrapper)
          button.tsx              # Botão CTA reutilizável
          heading.tsx             # Heading estilizado
        invoice-paid.tsx
        payment-failed.tsx
        pro-activated.tsx
        subscription-canceled.tsx
        plan-enrolled.tsx
        payment-confirmed.tsx
        member-approved.tsx       # Serve para aluno e instrutor (variação no texto)
        manager-new-member.tsx
      render.ts                   # Função que renderiza template → HTML
      index.ts
    package.json                  # Deps: @react-email/components, react
    tsconfig.json

apps/api/src/
  modules/
    email/
      email.queue.ts             # Fila BullMQ + tipos dos jobs
      email.worker.ts            # Worker que consome a fila e envia
      email.service.ts           # Funções de alto nível (ex: sendInvoicePaid)
  lib/
    resend.ts                    # Instância singleton do Resend SDK
```

## Mapeamento de Eventos

| Job Name | Trigger | Destinatário | Dados do Job |
|---|---|---|---|
| `invoice-paid` | Stripe webhook `invoice.paid` | Manager | `{ email, managerName, academyName, amountCents, invoiceUrl }` |
| `payment-failed` | Stripe webhook `invoice.payment_failed` | Manager | `{ email, managerName, academyName, amountCents }` |
| `pro-activated` | Stripe webhook `subscription.created` | Manager | `{ email, managerName, academyName }` |
| `subscription-canceled` | Stripe webhook `subscription.deleted` | Manager | `{ email, managerName, academyName, endsAt }` |
| `plan-enrolled` | `subscriptionService.selectPlan()` | Aluno | `{ email, studentName, planName, academyName, startsAt, expiresAt }` |
| `payment-confirmed` | `paymentService.confirmManual()` | Aluno | `{ email, studentName, academyName, amountCents, referenceMonth }` |
| `member-approved` | `membershipService.approve()` | Aluno/Instrutor | `{ email, memberName, academyName, role }` |
| `manager-new-member` | `membershipService.approve()` | Manager | `{ email, managerName, memberName, academyName, role }` |

### Idempotência

Cada job recebe um `jobId` determinístico para evitar duplicatas:

- `invoice-paid:{stripeInvoiceId}`
- `payment-failed:{stripeInvoiceId}`
- `pro-activated:{stripeSubscriptionId}`
- `subscription-canceled:{stripeSubscriptionId}`
- `plan-enrolled:{studentSubscriptionId}`
- `payment-confirmed:{paymentId}`
- `member-approved:{membershipId}`
- `manager-new-member:{membershipId}`

### Dados Pré-Resolvidos

Os jobs recebem dados já resolvidos (nome, email, valor) — o worker não faz queries ao banco. Isso mantém o worker simples e desacoplado.

Para `member-approved`, o trigger na `membershipService.approve()` adiciona 2 jobs: um para o membro e outro para o manager.

## Configuração do BullMQ

```typescript
// email.queue.ts
const emailQueue = new Queue('email', { connection: redisConnection })

// email.worker.ts
const emailWorker = new Worker('email', processEmailJob, {
  connection: redisConnection,
  concurrency: 5,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  }
})
```

### Graceful Shutdown

No `SIGTERM`/`SIGINT`, chama `worker.close()` e `queue.close()` antes de encerrar o processo.

## Integração com Resend

```typescript
// lib/resend.ts — singleton lazy (mesmo padrão de lib/stripe.ts)
import { Resend } from 'resend'

let resend: Resend | null = null

export function getResend(): Resend {
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY)
  }
  return resend
}
```

### Envio no Worker

```typescript
const { data, error } = await getResend().emails.send({
  from: 'Tatame <noreply@apptatame.com.br>',
  to: job.data.email,
  subject: getSubject(job.name, job.data),
  html: renderedHtml,
  headers: {
    'X-Entity-Ref-ID': job.id  // previne agrupamento em threads por Gmail
  }
})

if (error) {
  throw new Error(`Resend error: ${error.message}`)
}
```

## Env Config

No `packages/config/src/env.ts`, adicionar:

```typescript
RESEND_API_KEY: z.string().optional(),
```

### Comportamento sem chave

- A fila é criada normalmente
- Services adicionam jobs normalmente
- O worker verifica se a chave existe; se não, loga `[email] RESEND_API_KEY not set, skipping job {jobName}:{jobId}` e marca o job como completo (sem retry)
- Permite que ambientes de dev/test rodem sem configurar Resend

## Dependências Novas

- `resend` (SDK) — na API
- `bullmq` — na API
- `@react-email/components` — no pacote `packages/email`
- `react` — no pacote `packages/email` (peer dep do React Email)
