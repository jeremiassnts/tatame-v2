# Termos de Uso e Política de Privacidade — rascunho para revisão

**Escrito:** 2026-09-30, junto ao PR #27 (Asaas payment split).
**Estado:** rascunho. **Nada aqui está publicado.**

As páginas `apps/web/app/(site)/termos/page.tsx` e
`apps/web/app/(site)/privacidade/page.tsx` seguem intocadas nesta branch, de
propósito: `main` é deploy-on-merge, então escrever direto nelas publicaria
texto jurídico não revisado no momento em que o PR entrasse. Os textos abaixo
são para colar nos arrays `sections` depois da revisão — cada seção do rascunho
corresponde a um item `{ title, content }`.

**Por que existe:** o PR #27 muda por onde passa o dinheiro dos alunos. Os
termos atuais não têm uma linha sobre esse dinheiro, e agora ele transita pela
conta do Tatame no Asaas antes de chegar na academia. A política de privacidade
não menciona nenhum dos operadores nem o conjunto de dados de KYC que a abertura
da conta de recebimento exige.

**O que fazer com este arquivo:**

1. Ler a seção *Fatos que sustentam o texto* — é o que o advogado vai querer
   conferir, e cada afirmação aponta para o código.
2. Preencher os `[PLACEHOLDER]` — são 5, todos fatos que não estão no repositório.
3. Revisão jurídica do bloco de pagamentos dos Termos (seções 6, 7, 8 e 11).
4. Colar nas duas páginas e subir a data de "Última atualização" — hoje as duas
   dizem *06 de abril de 2026*.
5. Apagar este arquivo, ou movê-lo para `.specs/legal/` como registro.

---

## Placeholders a preencher

| # | Onde | O que falta |
| --- | --- | --- |
| 1 | Termos §7, Privacidade §4 | Razão social e CNPJ do Asaas, para nomear a instituição de pagamento com precisão contratual |
| 2 | Termos §13 | Comarca do foro — o WhatsApp do site é +55 79, então provavelmente SE |
| 3 | Privacidade §1 | Razão social e CNPJ do controlador (o Tatame) |
| 4 | Privacidade §5 | Onde ficam os nossos próprios servidores (Coolify). Se estiverem fora do Brasil, entram na lista de transferência internacional — não consegui determinar isso pelo repositório |
| 5 | Privacidade §7 | Prazos de retenção exatos. Escrevi "pelos prazos legais aplicáveis"; o advogado troca pelos números (fiscal, Marco Civil, exigência do Asaas) |

---

# Termos de Uso

Estrutura nova: 14 seções contra as 8 atuais. Marcadores por seção —
**NOVO**, **ALTERADO**, **IGUAL** (texto atual preservado).

### 1. Aceitação dos termos — ALTERADO

> Ao acessar e utilizar a plataforma Tatame, você concorda com estes Termos de
> Uso e com nossa Política de Privacidade. Estes termos se aplicam a todos os
> usuários da plataforma — gestores e donos de academia, instrutores, alunos e
> responsáveis por dependentes — na medida do que cada um utiliza. Se você não
> concordar com qualquer parte destes termos, não utilize o serviço.

*Mudança:* a frase sobre escopo. O texto atual é escrito só para donos de
academia, e hoje um aluno paga mensalidade dentro do app sob estes termos. A
frase final sobre "uso continuado constitui aceitação de alterações" saiu daqui
e virou a seção 12.

### 2. Descrição do serviço — ALTERADO

> O Tatame é uma plataforma de gestão para academias de artes marciais que
> oferece ferramentas de controle de alunos, agenda de aulas, check-in de
> presença, gestão financeira, graduações e recebimento de mensalidades. O
> serviço é oferecido através de aplicativo móvel e painel web, mediante
> assinatura mensal. O Tatame é uma plataforma de software: não é instituição
> financeira, não é instituição de pagamento e não presta serviços de ensino de
> artes marciais.

*Mudanças:* (a) "mediante assinatura mensal **ou anual**" — não existe ciclo
anual; há um único `STRIPE_PRO_PRICE_ID` e a página de preços mostra um plano
mensal de R$ 49,90. (b) A última frase é nova e delimita o que o Tatame é, o que
importa agora que dinheiro de terceiro transita pela nossa conta no Asaas.

### 3. Quem usa o Tatame — NOVO

> A plataforma atende quatro perfis. A academia, representada pelo gestor que a
> cadastra, é a assinante do Tatame e a responsável pela relação com seus
> alunos. O instrutor é vinculado a uma academia e usa o aplicativo para
> ministrar e registrar aulas. O aluno é vinculado a uma academia, acompanha
> suas presenças e graduações e pode pagar sua mensalidade pelo aplicativo. O
> responsável cadastra e acompanha dependentes menores de idade e é quem
> responde pelas mensalidades deles. Cada academia é responsável pelos dados e
> pela conduta dos usuários que vincula a ela.

### 4. Cadastro e conta — IGUAL

> Para utilizar o Tatame, você deve criar uma conta fornecendo informações
> verdadeiras e completas. Você é responsável por manter a confidencialidade das
> suas credenciais de acesso e por todas as atividades realizadas sob sua conta.
> Notifique-nos imediatamente caso suspeite de uso não autorizado.

### 5. Assinatura do Tatame pela academia — ALTERADO

> O acesso ao Tatame é oferecido por assinatura mensal, nos preços divulgados em
> nosso site, que podem ser alterados com aviso prévio de 30 dias. A cobrança é
> recorrente no cartão de crédito informado e é processada pela Stripe. O
> período de teste é de 30 dias e não há cobrança durante ele. O cancelamento
> pode ser feito a qualquer momento, mantendo o acesso até o final do período já
> pago. Não realizamos reembolsos proporcionais. Esta seção trata apenas da
> assinatura que a academia paga ao Tatame; as mensalidades que os alunos pagam
> à academia estão na seção 6.

*Mudanças:* corrige o ciclo, nomeia a Stripe, formaliza os 30 dias de teste — que
hoje só aparecem no marketing — e separa explicitamente os dois fluxos de
dinheiro, que era a principal ambiguidade do texto antigo.

### 6. Pagamento de mensalidades pelos alunos — NOVO

> O Tatame oferece à academia a possibilidade de receber as mensalidades dos seus
> alunos pelo aplicativo. Nesse fluxo, a academia é a única credora da
> mensalidade: o contrato de prestação de aulas é entre a academia e o aluno, e o
> Tatame não é parte dele.
>
> O processamento financeiro é feito pelo Asaas, instituição de pagamento
> responsável pela emissão e liquidação das cobranças. A cobrança é emitida na
> conta do Tatame no Asaas e o valor é destinado automaticamente, na mesma
> operação, à conta de recebimento da academia. O Tatame não retém nenhum
> percentual da mensalidade e não mantém a guarda desses valores.
>
> Do valor pago pelo aluno é descontada a tarifa da transação cobrada pelo
> Asaas, de modo que a academia recebe o valor líquido. O Tatame não cobra nada,
> hoje, sobre as transações dos alunos; caso isso mude, a academia será avisada
> com no mínimo 30 dias de antecedência.
>
> Os meios de pagamento disponíveis podem mudar ao longo do tempo. Atualmente o
> pagamento de mensalidade pelo aplicativo é feito por Pix. A academia pode, a
> qualquer momento, registrar manualmente no aplicativo os pagamentos que
> receber por fora.

### 7. Conta de recebimento da academia — NOVO

> Para receber pelo aplicativo, a academia precisa de uma conta de recebimento
> própria no Asaas. O Tatame intermedeia a abertura dessa conta: os dados que a
> academia informa no aplicativo são enviados ao Asaas, que é quem analisa,
> aprova e mantém a conta.
>
> Ao solicitar a abertura, a academia declara que os dados informados são
> verdadeiros e aceita os termos de uso e a política de privacidade do próprio
> Asaas, com quem passa a ter uma relação direta. A conclusão do cadastro — envio
> de documentos, dados bancários e demais exigências regulatórias — é feita pela
> academia diretamente no Asaas.
>
> Enquanto a conta não estiver aprovada, os alunos não conseguem pagar pelo
> aplicativo. O Asaas pode, por exigência regulatória ou por decisão própria,
> recusar, suspender ou encerrar a conta; nessas situações os recebimentos ficam
> interrompidos até que a pendência seja resolvida junto ao Asaas, e o Tatame não
> tem poder para reverter essa decisão.
>
> O saque do saldo para a conta bancária da academia é feito pela própria
> academia, no Asaas.

### 8. Estornos, contestações e disputas — NOVO

> Pedidos de estorno, devolução, contestação e qualquer divergência sobre a
> mensalidade são resolvidos entre o aluno e a academia, que é a credora. O
> Tatame registra e exibe o status dos pagamentos conforme informado pelo Asaas,
> mas não arbitra disputas, não autoriza estornos em nome da academia e não
> responde pela devolução de valores.
>
> Estornos e contestações processados pelo Asaas afetam o saldo da conta de
> recebimento da academia. O cancelamento de uma matrícula ou de um plano no
> aplicativo não gera, por si só, devolução de valores já pagos.

### 9. Uso aceitável — IGUAL

> Você concorda em utilizar o Tatame apenas para fins legítimos relacionados à
> gestão da sua academia. É proibido: utilizar o serviço para atividades
> ilegais, tentar acessar dados de outros usuários, realizar engenharia reversa
> da plataforma, transmitir vírus ou código malicioso, e revender ou
> sublicenciar o acesso ao serviço.

### 10. Propriedade intelectual — IGUAL

> Todo o conteúdo da plataforma Tatame, incluindo design, código, marcas e
> textos, é de propriedade exclusiva do Tatame ou de seus licenciadores. Os dados
> inseridos por você na plataforma permanecem de sua propriedade. Concedemos a
> você uma licença limitada, não exclusiva e revogável para uso da plataforma
> conforme estes termos.

### 11. Limitação de responsabilidade — ALTERADO

> O Tatame é fornecido "como está". Não garantimos que o serviço será
> ininterrupto ou livre de erros. Não respondemos por indisponibilidade, atraso,
> recusa, suspensão ou erro de terceiros dos quais o serviço depende, incluindo
> o Asaas, a Stripe e as lojas de aplicativos. Em nenhuma hipótese seremos
> responsáveis por danos indiretos, incidentais ou consequenciais decorrentes do
> uso da plataforma. Nossa responsabilidade total está limitada ao valor da
> assinatura pago por você ao Tatame nos últimos 12 meses.

*Mudanças:* a frase sobre terceiros é nova, e o teto ficou explícito quanto a
**qual** valor — "o valor pago por você" era ambíguo agora que mensalidades de
alunos transitam pela nossa conta.

**Ponto para o advogado:** o teto é de ~R$ 600 (12 × R$ 49,90). Antes cobria o
risco de um software de gestão. Agora o serviço toca a totalidade do faturamento
mensal da academia, e uma falha no roteamento do split é um dano de ordem
diferente. Não sei se o teto se sustenta assim — é decisão jurídica, não técnica.

### 12. Alterações destes termos — NOVO

> Podemos alterar estes termos a qualquer momento. Alterações relevantes serão
> comunicadas por e-mail ou pelo próprio aplicativo com antecedência mínima de
> 30 dias, e a data da última atualização no topo desta página é sempre
> atualizada. O uso continuado da plataforma após a entrada em vigor da nova
> versão constitui aceitação dela.

*Vinha solto no fim da seção 1, sem prazo nem forma de comunicação.*

### 13. Lei aplicável e foro — NOVO

> Estes termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca
> de **[PLACEHOLDER 2: comarca]** para dirimir qualquer controvérsia, salvo nos
> casos em que a legislação consumerista assegure ao usuário o foro do seu
> domicílio.

### 14. Contato — IGUAL

> Para dúvidas sobre estes termos, entre em contato pelo e-mail
> contato@tatame.app ou pelo nosso canal de suporte dentro da plataforma.

---

# Política de Privacidade

Estrutura nova: 12 seções contra as 7 atuais.

### 1. Quem trata os seus dados — NOVO

> Esta política descreve como o Tatame trata dados pessoais. Para os dados de
> quem contrata e utiliza a plataforma, o controlador é **[PLACEHOLDER 3: razão
> social e CNPJ]**, com contato em contato@tatame.app.
>
> Para os dados que uma academia insere sobre seus alunos, instrutores e
> dependentes, a academia é a controladora e o Tatame atua como operador,
> tratando esses dados conforme as instruções da academia e o necessário para
> operar o serviço.

*Por que importa:* separa as duas posições. Sem isso, um pedido de exclusão de
aluno chega para nós e não temos como responder sem contrariar a academia, que é
quem decide sobre aqueles dados.

### 2. Informações que coletamos — ALTERADO (reescrita)

> **Dados de cadastro e uso.** Nome, e-mail, telefone, foto de perfil, data de
> nascimento, Instagram, dados da academia e o seu papel nela.
>
> **Dados de alunos e dependentes inseridos pela academia ou pelo responsável.**
> Nome, data de nascimento, contato, faixa, graus, histórico de graduações e
> registro de presenças.
>
> **Dados de pagamento da assinatura da academia.** Processados pela Stripe. Não
> recebemos nem armazenamos o número do seu cartão.
>
> **Dados para abertura da conta de recebimento.** Quando a academia solicita a
> abertura, coletamos e transmitimos ao Asaas: nome, e-mail, telefone, CPF ou
> CNPJ, data de nascimento, tipo de empresa, faturamento ou renda mensal e
> endereço completo. Esses dados são exigidos pela regulação aplicável às
> instituições de pagamento e não ficam armazenados no Tatame — guardamos apenas
> os identificadores da conta no Asaas e o seu status de aprovação. Documentos de
> identificação e dados bancários são enviados pela academia diretamente ao
> Asaas e não passam por nós.
>
> **CPF do aluno.** É solicitado uma única vez, na primeira cobrança, e
> transmitido ao Asaas para emissão da cobrança. Guardamos apenas o
> identificador de cliente gerado pelo Asaas, não o CPF.
>
> **Dados de pagamentos de mensalidade.** Valor, mês de referência, meio de
> pagamento, data e status.
>
> **Dados técnicos.** Informações de uso — telas acessadas, horários de acesso,
> tipo de dispositivo — e o token de notificação push do aparelho.

*A versão atual resumia tudo isso como "dados de pagamento".*

### 3. Como usamos suas informações — ALTERADO

> Utilizamos suas informações para operar e manter a plataforma, viabilizar o
> pagamento das mensalidades, processar a assinatura da academia, enviar
> notificações relacionadas ao serviço, fornecer suporte, garantir a segurança da
> plataforma e melhorar a experiência com base em padrões de uso.
>
> As bases legais são: execução de contrato, para tudo que é necessário à
> prestação do serviço e ao processamento dos pagamentos; cumprimento de
> obrigação legal ou regulatória, para os dados de identificação exigidos na
> abertura da conta de recebimento e para a guarda de registros financeiros e
> fiscais; legítimo interesse, para segurança, prevenção a fraude e melhoria do
> produto; e consentimento, para o que dele depender, como cookies analíticos e
> notificações push, revogável a qualquer momento.

### 4. Com quem compartilhamos — ALTERADO

> Não vendemos nem alugamos suas informações pessoais. Compartilhamos o
> necessário com os prestadores que operam partes do serviço:
>
> - **Asaas** — emissão e liquidação das cobranças dos alunos e abertura da conta
>   de recebimento da academia **[PLACEHOLDER 1: razão social e CNPJ]**
> - **Stripe** — cobrança da assinatura que a academia paga ao Tatame
> - **Clerk** — autenticação e gestão de contas de acesso
> - **Expo** — entrega de notificações push
> - **Google Analytics** — métricas de uso do site
>
> Também compartilhamos quando exigido por lei ou ordem judicial, e em caso de
> fusão, aquisição ou venda de ativos, com aviso prévio. Cada prestador trata os
> dados conforme a própria política de privacidade, cuja leitura recomendamos.

*A versão atual diz "provedores de serviço" e não nomeia nenhum.*

### 5. Transferência internacional — NOVO

> Parte dos nossos prestadores está fora do Brasil, com infraestrutura nos
> Estados Unidos: Stripe, Clerk, Expo e Google Analytics. Nesses casos os dados
> transitam para o exterior. Selecionamos prestadores que ofereçam garantias
> contratuais de proteção compatíveis com a LGPD. O Asaas, que trata os dados de
> pagamento dos alunos e da conta de recebimento da academia, opera no Brasil.
> **[PLACEHOLDER 4: onde ficam os nossos próprios servidores]**

### 6. Dados de crianças e adolescentes — NOVO

> O Tatame permite que um responsável cadastre dependentes menores de idade para
> acompanhar presenças, graduações e mensalidades. Tratamos esses dados no melhor
> interesse da criança e do adolescente, limitados ao mínimo necessário para o
> serviço: nome, data de nascimento, faixa, registro de presenças e os pagamentos
> vinculados.
>
> O cadastro é feito pelo responsável, que é quem consente em nome do dependente.
> O acesso a esses dados é restrito ao responsável de registro e à academia em
> que o dependente treina. Não utilizamos dados de dependentes para publicidade e
> não os compartilhamos além dos prestadores listados na seção 4.
>
> O responsável pode corrigir ou solicitar a exclusão dos dados do dependente a
> qualquer momento, pelo aplicativo ou pelo contato desta política.

*A política atual é silenciosa sobre menores, e a funcionalidade de dependentes
existe desde antes deste PR.*

### 7. Por quanto tempo guardamos — NOVO

> Guardamos os dados enquanto a conta estiver ativa, e depois disso apenas pelo
> tempo necessário: registros financeiros e fiscais pelos prazos legais
> aplicáveis; os dados de identificação exigidos na abertura da conta de
> recebimento pelo prazo que a regulação impõe ao Asaas; registros de acesso pelo
> prazo previsto no Marco Civil da Internet. Encerrada a conta, o restante é
> excluído ou anonimizado. **[PLACEHOLDER 5: prazos exatos]**

### 8. Armazenamento e segurança — IGUAL

> Seus dados são armazenados em servidores seguros com criptografia em trânsito e
> em repouso. Implementamos medidas técnicas e organizacionais para proteger suas
> informações contra acesso não autorizado, alteração, divulgação ou destruição.
> Realizamos backups regulares e monitoramento contínuo da infraestrutura.

### 9. Seus direitos — ALTERADO

> De acordo com a LGPD, você tem direito a confirmar a existência de tratamento,
> acessar seus dados, corrigir dados incompletos ou desatualizados, solicitar
> anonimização ou exclusão, pedir a portabilidade, saber com quem compartilhamos,
> revogar o consentimento e se opor a tratamentos feitos com base em legítimo
> interesse. Para exercer esses direitos, entre em contato pelo e-mail
> contato@tatame.app; respondemos em até 15 dias.
>
> Um limite importante: a exclusão não alcança dados que somos obrigados a
> guardar. Registros de pagamento e os dados de identificação exigidos na
> abertura da conta de recebimento permanecem pelos prazos legais, mesmo após o
> encerramento da conta.
>
> Se os dados forem de um aluno ou dependente inseridos por uma academia,
> encaminhamos o pedido à academia, que é a controladora desses dados.

*A versão atual promete exclusão sem nenhuma ressalva, o que não é cumprível
para registro financeiro nem para dado de KYC.*

### 10. Cookies e rastreamento — IGUAL

> Utilizamos cookies essenciais para o funcionamento da plataforma e cookies
> analíticos para entender como você utiliza o serviço. Você pode gerenciar suas
> preferências de cookies a qualquer momento nas configurações do navegador. Não
> utilizamos cookies para publicidade direcionada.

### 11. Alterações desta política — NOVO

> Podemos atualizar esta política. Alterações relevantes serão comunicadas por
> e-mail ou pelo aplicativo, e a data da última atualização no topo desta página
> é sempre atualizada.

### 12. Contato e encarregado — ALTERADO

> Para dúvidas sobre esta política ou sobre o tratamento dos seus dados, fale com
> o nosso encarregado de proteção de dados (DPO) pelo e-mail contato@tatame.app,
> ou pelo nosso canal de suporte dentro da plataforma.

*A LGPD exige indicar o encarregado. A versão atual dá o e-mail sem dizer que é
esse o canal.*

---

## Fatos que sustentam o texto

Cada afirmação nova conferida contra o código, para que a revisão não dependa de
acreditar no rascunho.

| Afirmação no texto | Onde se verifica |
| --- | --- |
| A cobrança é emitida na conta do Tatame e destinada à academia na mesma operação | `payment.service.ts:256-262` — a cobrança é criada na conta raiz e o split leva o valor ao wallet da academia |
| O Tatame não retém percentual algum | `percentualValue: 100` no split; o comentário em `payment.service.ts:259-261` registra que a plataforma fica exatamente com zero (D1/D3) |
| A academia recebe o valor líquido da tarifa | `lib/asaas.ts:163` — o Asaas divide sobre `netValue`, não sobre o valor bruto |
| O Tatame não mantém a guarda dos valores | `ab07930` removeu o repasse manual: "Tatame never holds the money and there is nothing left to repassar" |
| Sem conta aprovada o aluno não consegue pagar | `payment.service.ts:326` recusa a cobrança com `PAYOUT_ACCOUNT_REQUIRED` em qualquer status diferente de `approved` |
| Hoje o pagamento no app é por Pix | `apps/mobile/constants/payment.ts` — `CARD_PAYMENT_ENABLED = false`; volta na TAT-189 |
| A academia pode registrar pagamento manual | `payment.service.ts:152` — `method: "manual"` |
| Suspensão pelo Asaas interrompe recebimentos | o próprio app já diz isso ao gestor em `payout-account/documents.tsx` |
| Documentos e dados bancários vão direto ao Asaas | `documents.tsx:317-318` — "The app does not take documents"; o gestor é enviado ao Asaas |
| Os dados de KYC não ficam no Tatame | `CreatePayoutAccountInput` em `payout-account.service.ts:28-43` lista o que é coletado; `academyPayoutAccounts` (`schema/index.ts:400-441`) guarda só ids, chave selada e status |
| O CPF do aluno não é armazenado | `asaas-customer.service.ts:76-88` envia ao Asaas e persiste apenas `asaasCustomerId` (`schema/index.ts:163`) |
| Não há ciclo anual | um único `STRIPE_PRO_PRICE_ID` (`packages/config/src/env.ts:27`); a página de preços mostra só o mensal |
| Dados de dependente são nome e data de nascimento | `schema/index.ts:241-259` |
| Só o responsável de registro acessa o dependente | `dependents.guardianId` é uma FK única por dependente (`schema/index.ts:243-245`), e `findByGuardian` filtra por ela (`dependent.repository.postgres.ts:35-39`). `4989c10` fechou o check-in pela mesma regra |
| Token de push é coletado | módulo `push-token` |
| Stripe cobra a assinatura da academia | módulo `manager-subscription` |
| Clerk autentica | `users.clerkUserId` (`schema/index.ts:141`), `packages/config/src/clerk.ts` |

---

## O que este rascunho não resolve

- **O app não tem link para os Termos nem para a Política em nenhuma tela.** O
  site tem, em `/cadastro`. Na loja isso é cobrado, e a build 2.1.3 ainda não foi
  submetida. Onde colocar o link é decisão de design.
- **Nenhum aceite é registrado.** Não há evidência de quando um usuário aceitou
  qual versão dos termos. Com pagamento no fluxo, isso passa a ter valor
  probatório. Fora do escopo deste PR; vale uma issue.
- **A academia de plano free vê o card "Conta de recebimento"** na tela de
  finanças, embora `payment.service.ts:281` recuse cobrança automática para o
  plano free. Comportamento anterior a este PR — o card nunca foi gated por
  plano. Inconsistência de produto, não de texto.
