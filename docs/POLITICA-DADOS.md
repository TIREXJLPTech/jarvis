# Política de separação de dados — pessoal vs. Irapuru

Regra central do projeto: **o Jarvis pessoal e qualquer integração com sistemas
da Irapuru nunca compartilham credenciais, banco de dados ou ambiente de
execução.**

## Por quê

O Jarvis é um projeto pessoal, hospedado em contas pessoais (GitHub, Railway,
Anthropic), sem relação com a infraestrutura ou políticas de TI da Irapuru.
Conectar credenciais corporativas (Protheus, efrete, e-mail corporativo,
sistemas fiscais) a esse ambiente pessoal expõe a empresa a um risco que não é
dela para aceitar, e pode conflitar com a política de segurança/compliance
interna.

## Regras práticas

1. **Ambientes separados.** O núcleo pessoal do Jarvis (Fases 0–5, 7–8) e o
   módulo de monitoramento de trabalho (Fase 6) rodam como processos/serviços
   distintos, cada um com seu próprio `.env` e, se necessário, seu próprio
   banco de dados.
2. **Sem credenciais corporativas no repositório pessoal.** Nenhum token,
   usuário ou senha de sistemas da Irapuru entra neste repositório
   (`jarvis`) ou no seu `.env`. Isso fica isolado no módulo da Fase 6.
3. **Aprovação antes de conectar.** Antes de a Fase 6 tocar em qualquer
   sistema corporativo real, validar com a política de segurança/TI da
   Irapuru se esse tipo de integração com um serviço de IA de terceiros é
   permitido — e em que condições (rede, dados que podem trafegar para a API
   da Anthropic, retenção de logs).
4. **Dado mínimo necessário.** Mesmo depois de aprovado, o módulo de trabalho
   deve enviar ao modelo apenas o que for necessário para o alerta/consulta em
   questão — nunca exportar bases inteiras ou dados de terceiros/clientes da
   Irapuru para fora do ambiente corporativo sem necessidade.
5. **Sem mistura de memória.** A memória de longo prazo do Jarvis pessoal
   (preferências, rotina, projetos pessoais) não deve conter dados de
   sistemas ou processos internos da Irapuru, e vice-versa.

Este arquivo deve ser revisado no início da Fase 6, antes de qualquer
integração com sistemas de trabalho ser codificada.
