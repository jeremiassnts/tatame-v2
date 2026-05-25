# Check-in com dependentes — lista de registros + botão inteligente

## Problema

Após o aluno/responsável fazer check-in de um dependente (ou de si mesmo), o botão fica desabilitado com "Check-in realizado", impedindo check-in dos outros dependentes na mesma aula.

## Solução

Quando um aluno/guardian faz check-in na tela de detalhe da aula, uma lista compacta aparece mostrando os check-ins já realizados (dele + dependentes). O botão permanece ativo até que todos (self + dependentes) tenham feito check-in naquela sessão.

## Componentes afetados

### ClassDetailView.tsx

Componente compartilhado usado por student e guardian:

- Recebe nova prop `myCheckins` — check-ins filtrados do usuário + seus dependentes, com shape `{ name: string; checkedInAt: string }[]`
- Recebe nova prop `allCheckedIn` — boolean indicando se todos do grupo já fizeram check-in
- Renderiza lista compacta de "meus check-ins" abaixo das infos da aula, antes do botão
- `checkinDone` passa a usar `allCheckedIn` em vez do check simples por userId

### Student class detail — (student)/(classes)/[classId].tsx

- Cruza `checkins` (da aula) com `dependents` (do usuário) para calcular `myCheckins` e `allCheckedIn`
- Passa dados para ClassDetailView

### Guardian class detail — (guardian)/(classes)/[classId].tsx

- Mesmo cálculo usando dependentes do guardian
- Guardian nunca conta "self" (não pode fazer check-in de si mesmo)

### TodayClassCard.tsx

- Sem mudanças visuais na lista
- `checkinDone` precisa seguir a mesma lógica `allCheckedIn` para consistência do botão na home
- Recebe `dependentIds` e calcula `allCheckedIn` cruzando com os check-ins da aula

## Lista de "meus check-ins" — layout

Segue o mesmo padrão visual da lista de check-ins existente para instructors:

- Cada item: bolinha verde + nome ("Eu" ou nome do dependente) + horário + checkmark
- Aparece apenas quando há pelo menos 1 check-in do grupo
- Posicionada entre as infos da aula e o botão de check-in

## Lógica allCheckedIn

```
possibleCheckins = [self (se student)] + [dependentes do usuário]
doneCheckins = checkins da aula que pertencem ao grupo
allCheckedIn = possibleCheckins.every(id => doneCheckins.includes(id))
```

- Para guardian: `possibleCheckins` = apenas dependentes (sem self)
- Para student sem dependentes: comportamento idêntico ao atual (botão desabilita após check-in)
- Para student com dependentes: botão ativo até todos terem feito check-in

## Dados necessários

Os check-ins da aula (`/classes/{classId}/checkins?date={date}`) já retornam `userId` e `dependentId`. Precisamos cruzar com:

- `useDependents()` — retorna os dependentes do usuário logado
- `me.id` — ID do usuário logado

O cruzamento é feito no frontend, sem mudanças na API.

## Invalidação de queries

Após check-in bem-sucedido, `useCheckin` já invalida `["checkins", classId, date]`, o que faz a lista atualizar automaticamente.

## Tratamento de erros

Se o usuário selecionar alguém que já fez check-in (edge case — API processa antes do refetch), o Alert existente mostra a mensagem da API: "Você já fez check-in nesta aula hoje".
