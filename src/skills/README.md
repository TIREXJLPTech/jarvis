# Skills

Cada capacidade do Jarvis (agenda, casa, dev, trabalho, memoria, utilidades)
vira uma "skill": um modulo com uma funcao e um schema de parametros,
registrado no orquestrador como tool do Claude (tool use / function calling).

Esta pasta esta vazia de proposito na Fase 0 - as primeiras skills
(hora, clima, busca na web) entram na Fase 1, junto com o orquestrador
que le esta pasta e registra cada skill encontrada.

Convencao planejada para cada skill (a partir da Fase 1):

```
src/skills/<nome-da-skill>/
  index.ts       # export da funcao + schema (nome, descricao, parametros)
  <nome>.test.ts # testes, quando fizer sentido
```
