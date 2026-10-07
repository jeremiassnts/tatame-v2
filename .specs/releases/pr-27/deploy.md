# PR #27 — passos manuais de deploy

Tudo o que o merge não faz sozinho. Execute nesta ordem.

A `main` deploya no merge, então **os passos 1 a 3 acontecem antes do merge.**

Valores de referência: `{ROOT_KEY}` é a API key de produção da conta raiz do Asaas,
`{API_PUBLIC_URL}` é a URL pública da API (o mesmo valor da env var), `{TOKEN}` é o que
o passo 1 gera. A base URL de produção do Asaas é `https://api.asaas.com`.

---

## Antes do merge

### 1. Definir o token do webhook de pagamento no Coolify

```bash
openssl rand -hex 32     # 64 caracteres, dentro dos 32–255 que o schema aceita
```

Defina `ASAAS_PAYMENT_WEBHOOK_TOKEN` com esse valor no serviço da API no Coolify.

- **Use um valor diferente do `ASAAS_WEBHOOK_TOKEN` e diferente por ambiente.** Ele cai
  para o `ASAAS_WEBHOOK_TOKEN` quando não está definido, mas compartilhar o valor anula
  a razão de ter sido separado: o token de conta é gravado em toda subconta de academia,
  onde um operador consegue ler.
- É opcional no schema, então o deploy não falha sem ele. Definir primeiro é o que evita
  uma janela em que entregas reais tomam 401.

### 2. Confirmar que existe uma chave Pix na conta raiz

```bash
curl -s -H "access_token: {ROOT_KEY}" https://api.asaas.com/v3/pix/addressKeys
```

Espere pelo menos uma chave com `"status": "ACTIVE"`.

- Se a lista vier vazia, crie uma no painel do Asaas e aguarde — o Asaas provisiona
  chaves de forma assíncrona.
- **Enquanto nenhuma chave estiver ACTIVE, toda busca de QR code Pix falha** com
  `400 invalid_action` ("Você não possui uma chave Pix cadastrada para recebimentos").

### 3. Confirmar que os limites da avaliação cabem

Os primeiros 60 dias de uma conta de produção do Asaas permitem **10 subcontas** e
**R$ 2.000 por cobrança**. Confira a contagem atual de subcontas:

```bash
curl -s -H "access_token: {ROOT_KEY}" "https://api.asaas.com/v3/accounts?limit=100" \
  | grep -o '"totalCount":[0-9]*'
```

Uma subconta por academia. Se o rollout precisar de mais do que a folga restante, peça
ao Asaas para subir o limite antes de onboardar academias — a recusa chega como um 400
com o motivo em português, que o app mostra literalmente.

---

## Merge e deploy

### 4. Fazer o merge do PR #27

Manual. O merge dispara o deploy da `main`.

### 5. Aplicar as migrations

`0021`, `0022` e `0023`. As três são aditivas — seguras de rodar antes do deploy, e
seguras de deixar aplicadas se o deploy for revertido. Não há restrição de ordem em
relação à versão da API.

```bash
pnpm --filter @tatame/db migrate
```

- `0021` — tabela `pending_asaas_payments`, `payments.asaas_payment_id` (unique),
  `users.asaas_customer_id`
- `0022` — enum `pending_asaas_kind` em `pending_asaas_payments`
- `0023` — índice único em `pending_asaas_payments (subscription_id, reference_month)`

A `0021` e a `0022` já foram aplicadas no banco do Coolify à mão, e as duas são
reexecutáveis, então aplicar o conjunto de novo é no-op para elas.

**Se a `0023` falhar** com `could not create unique index`: a tabela tem duas cobranças
abertas para o mesmo mês, o que significa duas cobranças pagáveis no Asaas e dinheiro
real. Leia os dois ids, cancele a perdedora no Asaas, apague aquela linha e rode de
novo. Não apague uma linha só para a migration passar.

Reverso, se um dia precisar:

```sql
DROP INDEX IF EXISTS "pending_asaas_payments_subscription_month_unique";
```

### 6. Registrar o webhook da conta raiz — o passo que decide o release

```bash
curl -X POST https://api.asaas.com/v3/webhooks \
  -H "access_token: {ROOT_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tatame-payments-prod",
    "url": "{API_PUBLIC_URL}/v1/webhooks/asaas",
    "email": "jeremiassnts3@gmail.com",
    "enabled": true,
    "interrupted": false,
    "apiVersion": 3,
    "sendType": "SEQUENTIALLY",
    "authToken": "{TOKEN}",
    "events": [
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_REFUNDED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
    ]
  }'
```

- **Sem isso, nenhum pagamento de aluno é registrado, e nada no código avisa.** Uma
  subconta não é notificada de um split que ela apenas recebe, então a única conta que
  fica sabendo do pagamento de um aluno é a raiz.
- Rode **depois** do deploy, para a URL já responder.
- O `authToken` tem que ser o valor do passo 1. Um token errado **dá 401 em silêncio**, e
  o Asaas interrompe uma fila que falha repetidamente até alguém reativar à mão.
- `sendType: SEQUENTIALLY` é o que impede o `PAYMENT_CONFIRMED` de passar na frente do
  `PAYMENT_RECEIVED`.
- O `PAYMENT_DELETED` fica de fora de propósito. O handler tolera; nós mesmos causamos
  esse evento em toda baixa manual, e alertar nele faria um manager recebendo dinheiro no
  balcão parecer pagamento perdido.

Confirme que ficou registrado:

```bash
curl -s -H "access_token: {ROOT_KEY}" https://api.asaas.com/v3/webhooks
```

Confira `enabled: true` e `interrupted: false`.

---

## Verificar em produção

### 7. Um pagamento real, ponta a ponta

1. Um aluno de uma academia com conta de recebimento **aprovada** abre a tela do Pix.
2. O QR code aparece (prova o passo 2).
3. Pague de verdade, valor pequeno.
4. Em segundos o pagamento aparece no Financeiro do manager, e o dinheiro está na
   carteira Asaas **da academia**, não na nossa (prova os passos 1 e 6).

Se o QR code aparece mas o pagamento nunca entra, a causa é o webhook e não a cobrança —
revise o passo 6.

```sql
-- deve ficar vazia depois que o pagamento entra; uma linha sobrando significa
-- que o webhook nunca chegou
select * from pending_asaas_payments;
```

---

## Depois do release

### 8. Submeter o build 2.1.3 nas lojas

Versão e build numbers já estão incrementados (`c56212e`: 2.1.3, `buildNumber` 2,
`versionCode` 2). Só a submissão está pendente.

As lojas pedem link para os Termos e a Política de Privacidade, e **nenhuma tela do app
tem um**. Decida onde fica antes de submeter, ou espere uma pergunta na revisão.

### 9. Subir o `MIN_MOBILE_VERSION` para 2.1.3 — só depois da adoção

Depende do passo 8. **Não faça antes:** isso tranca todo mundo que ainda está no 2.1.2.

É o que destrava a etapa 1 do TAT-187 (apagar o rail Pix legado da AbacatePay) e o que
torna verdadeiro o "só Pix" da landing page — o 2.1.2 ainda consegue pagar com cartão até
então.

### 10. Mais pra frente: ligar o `PAYOUT_ACCOUNT_REQUIRED`

Mude para `true` quando o build com o onboarding tiver sido adotado. O critério de aceite
do TAT-179 afirma que esse gate está ativo; não está, e nenhuma issue acompanha a virada.

Antes da etapa 2 do TAT-187, confirme que as duas tabelas drenaram:

```sql
select count(*) from pending_asaas_payments;
select count(*) from pending_pix_payments;
```

---

## Não é obrigatório, mas é bom saber

- **Rotacionar o `ASAAS_PAYMENT_WEBHOOK_TOKEN` depois não tem janela de sobreposição.** O
  `tokensFor` devolve só o token de pagamento para eventos `PAYMENT_*`, e o
  `PUT /v3/webhooks/{id}` no lado do Asaas e a mudança da env var não podem ser
  simultâneos — qualquer ordem dá 401 em entregas reais. Este release escapa porque o
  passo 6 cria um webhook novo em vez de editar um existente. A primeira rotação não
  escapa.
- **Um aluno que troca de plano no meio do mês depois de pagar pode ser cobrado duas
  vezes.** Está vivo em produção hoje e é anterior a este PR: o
  `existsForSubscriptionReferenceMonth` é chaveado por subscription enquanto o
  `replaceActiveSubscriptionForAcademy` sempre cria uma linha nova. Não é obra deste
  release e não é corrigido por ele.
- **Um manager que cancelar o Pro e assinar de novo vai ser cobrado por nada** depois
  deste merge — é o B7 no `handoff.md`. Funciona na `main` hoje; o guard do TAT-185 neste
  PR é o que quebra. Deixado aberto de propósito: o único cliente que cancelou não voltou.
