# Selfcure — Build Roadmap

> ⚠️ **Este é o roadmap histórico (plano de obra), NÃO o estado atual do sistema.**
> Para a fonte única de verdade sobre o que o selfcure é hoje — pacotes, comandos,
> módulos e status — veja a **[documentação-mestre: `docs/SYSTEM.md`](SYSTEM.md)**.

> **Para o agente IA:** Este documento é o plano de construção do Selfcure. As Fases 0–9 originais já foram entregues e o produto pivotou para uma camada de visibilidade e maturidade de testabilidade. Leia "Reposicionamento" antes de continuar e respeite o que está marcado como "fallback legado" vs o que é "headline".

---

## 🎯 Reposicionamento (2026-06) — leia primeiro

O mercado tem duas commodities resolvidas que o selfcure **não tenta competir**:

1. **Healing pós-falha** — Playwright Test Agents (Microsoft, oficial), Shiplight,
   BrowserStack Self-Heal, LambdaTest AutoHeal, ZeroStep, Octomind. Reimplementar
   isso é guerra perdida.
2. **Correção de código por IA** — qualquer dev com Cursor, Claude Code ou Copilot
   pede "insere data-testid e abre PR" e pronto. É commodity de IDE em 2026.

**Selfcure é a plataforma de VISIBILIDADE E MATURIDADE** — o que ninguém entrega:

```
selfcure (medir, mostrar, acompanhar)         IA generalista de IDE (consertar)
─────────────────────────────────────         ─────────────────────────────────
crawl do source FE (AST)                      conserta arquivo a arquivo sob demanda
score histórico por componente            →   não mantém histórico
inventário governado de testids               não conhece contrato do projeto
detecção de ambiguidade intra-componente      não vê o todo do sistema
relatórios pra QA / tech lead / gestor        responde só ao dev no momento
```

**Pitch oficial:** "selfcure mostra se sua aplicação está pronta para ser
automatizada — e prova que está melhorando. A correção qualquer IA faz; a visibilidade
ao longo do tempo é o produto."

**Agnóstico de ferramenta de automação:** o produto principal não depende de
Playwright. Funciona com Cypress, Playwright, Selenium, TestCafe, WebdriverIO,
qualquer ferramenta. O fallback BYOK (Fases 5–8) usa Playwright internamente, mas
é legado e não é o foco comercial.

**Entrada comercial:** `@selfcure/mcp` — servidor Model Context Protocol gratuito que qualquer cliente IA (Claude Desktop, Cursor, VS Code, Claude Code, Windsurf) instala em uma linha. Pro features (auto-fix, PR opening, dashboards) ficam em cima.

**Validação real (qnexytest dogfood, 2026-05-28):**
- 82 componentes analisados, score médio 43/100.
- 500 issues totais: 477 `ambiguous` (95%) + 23 `low-score`.
- Ambiguidade é o problema dominante — exatamente o que healers reativos não previnem.

---

## 🎯 Visão do produto

**O que selfcure é hoje:** uma *plataforma de maturidade de testabilidade* para frontends. Lê código React/Vue/Angular/HTML, calcula score por componente, mantém inventário governado de data-testids, detecta ambiguidade que healers reativos não veem, e abre PR com correção quando solicitado via `gh` ou `glab` CLI.

**O que selfcure NÃO é (e nunca mais será):**
- Competidor direto do Playwright Healer Agent.
- Ferramenta de correção pontual de código (commodity de IDE).
- Amarrada a uma ferramenta de automação específica.

**Público-alvo:**
1. **Tech leads e arquitetos** — score quantificável para argumentar qualidade.
2. **QA engineers** — dados concretos pra mostrar que o problema é o componente.
3. **Frontend devs** — recebem o PR, veem o score subir, ciclo virtuoso.

**Diferencial defensável:** análise estática do source FE + detecção de ambiguidade intra-componente + inventário governado de tags + score histórico comparável. Nenhum healer reativo enxerga isso, e nenhuma IA generalista de IDE mantém esse histórico ao longo do tempo.

---

## 🏗️ Arquitetura atual

```
selfcure/
├── packages/
│   ├── cli/           # entry point (commander) — init / crawl / lint / mcp / web / discover / a11y / tml / testids / [legacy: run/heal/report]
│   │   └── src/       #   git-providers.ts (GitHub gh + GitLab glab) · discover.ts · a11y.ts · tml.ts · testids.ts
│   ├── crawler/       # AST estática via @typescript-eslint/parser           ★ moat
│   ├── analyzer/      # score 0-100 + detecção de ambiguidade                ★ moat
│   ├── web/           # /lint + /crawl + /integrations (OAuth) + PR flow     ★ moat
│   ├── mcp/           # Model Context Protocol stdio server                  ★ entrada comercial
│   │
│   ├── generator/     # (fallback BYOK) source → LLM → Playwright spec
│   ├── runner/        # (fallback BYOK) @playwright/test wrapper
│   ├── selfcure/      # (fallback BYOK) heal loop
│   └── reporter/      # (fallback BYOK) HTML report
├── docs/
│   ├── SYSTEM.md      # ★ documentação-mestre (estado atual do sistema)
│   └── *-plan.md      # planos dos módulos de governança (discovery/a11y/tml/testids)
├── selfcure.config.mjs # template
└── package.json
```

**Stack:**
- Node.js 20+
- TypeScript
- Playwright 1.60+ (apenas como runtime de teste no fallback legado — produto principal é agnóstico)
- `@modelcontextprotocol/sdk` (servidor MCP)
- Vercel AI SDK (apenas no fallback legado)
- Commander (CLI)
- Vitest (testes internos)

**Dependências externas críticas:**
- `gh` CLI — usado pelo PR flow no GitHub. Selfcure delega autenticação; nunca armazenamos token.
- `glab` CLI — análogo ao gh para GitLab (implementado na Fase 13).

---

## 📋 Ordem de implementação

### Fases 0–9 (CONCLUÍDAS — pipeline BYOK original, rebaixado a fallback legado)
- Fase 0 — Setup do monorepo ✅
- Fase 1 — CLI esqueleto + `selfcure init` ✅
- Fase 2 — Crawler estático ✅
- Fase 3 — ~Crawler dinâmico + Codegen~ (despriorizado após reposicionamento)
- Fase 4 — Analyzer + score de testabilidade ✅
- Fase 5 — Generator (BYOK Playwright) ✅ — fallback legado
- Fase 6 — Runner ✅ — fallback legado
- Fase 7 — Selfcure heal loop ✅ — fallback legado
- Fase 8 — Reporter HTML ✅
- Fase 9 — Publicação npm (parcial — pacotes prontos, ainda não publicados)

### Fases 10+ (PÓS-REPOSICIONAMENTO)

- **Fase 10 — Ambiguidade ✅** (2026-05) — analyzer detecta selectors compartilhados entre siblings na mesma component; penalidade ×0.4 no score; replace mode no patcher.
- **Fase 11 — Lint web + PR flow ✅** (2026-05) — `/lint` page com checkboxes por issue, botão "Open pull request" único, branch + push + `gh pr create` em um clique, redirect pra GitHub.
- **Fase 12 — MCP server ✅** (2026-05-28) — `@selfcure/mcp` stdio server com 4 tools (lint/list/analyze/suggest), 3 resources, 2 prompts. Licença MIT. Smoke test em qnexytest passou.
- **Fase 13 — Provider abstraction ✅** (2026-06) — PR flow atrás da interface `GitProvider`. Implementações: GitHub via `gh` e GitLab via `glab`. Auto-detecção via URL do remote.
- **Fase 17 — Agentic Discovery ✅** (2026-06-01) — `selfcure discover`. Plano: `docs/agentic-discovery-init-plan.md`.
- **Fase 18 — Accessibility WCAG ✅** (2026-06-01) — `selfcure a11y scan|audit`. **Feature paga.** Plano: `docs/accessibility-wcag-module-plan.md`.
- **Fase 19 — Tag Maturity Level (TML) ✅** (2026-06-01) — `selfcure tml report|scan|audit`. Plano: `docs/tag-maturity-level-plan.md`.
- **Fase 20 — Test ID Inventory ✅** (2026-06-01) — `selfcure testids scan|audit`. Plano: `docs/testid-inventory-plan.md`.
- **Fase 14 — Dogfood pago** (pendente) — primeiro repo real (não-qnexytest) abrindo um PR mergeado via selfcure.
- **Fase 21 — Integração SonarQube via Generic Issue Format ✅ (código)** (2026-06-04) — exporter `@selfcure/reporter` (`sonarqube.ts`), comando `selfcure export --format sonarqube`, doc `docs/integrations/sonarqube.md`, testes Vitest. Pendente apenas o item externo: publicar entrada em sonarplugins.com.
- **Fase 22 — Silos de landing page por ferramenta de automação ✅ (código)** (2026-06-04) — 5 landings (`site/{cypress,playwright,selenium,testcafe,webdriverio}/index.html`) + `site/silo.css` + interlink no `site/index.html`. Cada uma com meta tags, schema.org (SoftwareApplication + FAQPage) e exemplos na ferramenta da audiência. Pendente apenas o resultado externo: SEO/ranqueamento e conteúdo de blog.
- **Fase 15 — Figma plugin** (somente se demanda orgânica aparecer de clientes — ver justificativa abaixo).
- **Fase 16 — Integração profunda com Playwright Test Agents** (futuro) — consumir `@playwright/mcp` server pra healing dinâmico atrás de feature flag. Spike só quando alguém pedir.

---

## Fase 21 — Integração SonarQube via Generic Issue Format

**Objetivo:** chegar no público enterprise Java (arquitetos e tech leads) que já usa SonarQube, sem precisar manter plugin nativo em Java.

**Motivação estratégica:** o público que mais decide compra em enterprise — arquiteto e tech lead — já tem o SonarQube no painel deles. Aparecer ali com score de testabilidade ao lado de debt técnico e cobertura é argumento de reunião de diretoria, não só de QA. Plugin Java teria custo de manter artefato em outra linguagem; Generic Issue Format resolve sem isso.

**Tarefas:**
1. Exporter no `@selfcure/reporter` que gera arquivo no formato Generic Issue Import Format do SonarQube.
2. Mapear issues do selfcure para o schema do SonarQube:
   - `ambiguous` → `BUG` severidade `MAJOR`
   - `low-score` → `CODE_SMELL` severidade `MAJOR`
   - `missing-testid` → `CODE_SMELL` severidade `MINOR`
   - `a11y-violation` → `BUG` severidade conforme nível WCAG
3. Comando `selfcure export --format sonarqube --out .selfcure/sonar-issues.json`.
4. Documentação `docs/integrations/sonarqube.md` com exemplo de configuração no `sonar-project.properties`.
5. Publicar no sonarplugins.com como entrada de documentação (PR no repo do site).

**Definition of Done:**
- Arquivo gerado é validado pelo SonarQube sem erros.
- Issues aparecem no painel do SonarQube com link de volta pro arquivo/linha.
- Documentação testada em SonarQube Server 10+ e SonarQube Cloud.
- Página em sonarplugins.com aprovada.

---

## Fase 22 — Silos de landing page por ferramenta de automação

**Objetivo:** chegar em cada tribo de QA na linguagem dela, sem mudar o produto. Mesma análise, posicionamento diferente por ferramenta.

**Motivação estratégica:** o problema que o selfcure resolve existe igual em Cypress, Playwright, Selenium, TestCafe e WebdriverIO. Mas cada comunidade pesquisa no Google com a linguagem dela. Uma landing genérica perde SEO e conversão; landings específicas ganham tráfego qualificado e convertem melhor porque falam a dor exata da tribo.

**Tarefas:**
1. Estrutura no site `selfcure.dev`:
   - `/cypress` — "Seus testes Cypress ficam flaky? O problema pode não ser o teste."
   - `/playwright` — "Locators frágeis no Playwright? Veja o score de testabilidade do seu frontend."
   - `/selenium` — "Migrando de Selenium? Descubra se seu frontend está pronto antes de reescrever os testes."
   - `/testcafe` — "Testes TestCafe travando em selectors? Mapeie a maturidade do seu frontend primeiro."
   - `/webdriverio` — "WebdriverIO + frontend bagunçado? Veja a saúde dos seus selectors."
2. Cada landing tem exemplos de código na ferramenta da audiência (não em Playwright).
3. Mesmo CTA: instalação via npx, MCP server, e tier Team.
4. SEO técnico: meta tags, schema.org, conteúdo de 1500+ palavras por landing.
5. Conteúdo de blog interlinkado: 2-3 artigos técnicos por silo nos primeiros 60 dias.

**Definition of Done:**
- 5 landings publicadas.
- Cada landing ranqueia top 20 no Google para sua keyword principal em 90 dias.
- Tráfego orgânico medido por landing, conversão medida (instalação npm).

---

## Fase 15 — Figma plugin (DESPRIORIZADO)

**Status:** somente se demanda orgânica aparecer de clientes enterprise pedindo especificamente.

**Justificativa do desprioritizar:** o agente IA já consegue raciocinar sobre o repositório inteiro renderizando telas reais, então o momento de intervenção mais valioso é no código, não no design. O PR automático com data-testid no código já atinge o FE no ambiente dele sem precisar do Figma. Manter plugin Figma tem custo de lidar com a API deles que muda, criar UX de plugin de qualidade, e atingir público que pode não adotar. Não justifica como v2 ou v3.

Reabrir essa fase apenas se:
- Cliente enterprise pagar explicitamente pelo plugin.
- Demanda repetida de design systems aparecer no funil de vendas.
- Estratégia de produto pivotar para "shift-left total" no design.

---

## 🚨 Regras para o agente

1. **Não pule fases.** Cada uma depende da anterior.
2. **Teste cada módulo isoladamente** com Vitest antes de avançar.
3. **Commits pequenos e frequentes.** Um commit por tarefa concluída.
4. **Use exemplos reais.** Crie `examples/legacy-app/` — app legada em React sem `data-testid` — para validar cada fase.
5. **Não invente abstrações prematuras.** Cada módulo expõe uma função pura: `crawl(config) → map.json`.
6. **Logs estruturados.** Use `pino` ou similar.
7. **Mensagens de erro úteis.** "Element with name=card-brand not found in PaymentModal — try recording flow again" em vez de "Element not found".
8. **Quando travado, documente a dúvida** em `docs/decisions/` (ADR pattern) antes de prosseguir.
9. **Nunca trate o fallback BYOK como produto principal.** O produto é visibilidade e maturidade via crawler + analyzer + módulos de governança.
10. **Nunca acople o produto principal ao Playwright.** Agnóstico de ferramenta de automação é decisão arquitetural inegociável.

---

## 📦 Próximos passos concretos

Em ordem de prioridade:

1. **Fase 14 — Dogfood pago** (1º PR mergeado fora do qnexytest).
2. **Fase 21 — Integração SonarQube** (chega no público enterprise Java).
3. **Fase 22 — Landing pages por silo** (SEO e conversão por tribo).
4. **Publicação npm definitiva** (Fase 9 finalizada).
5. **Fase 16 — Integração Playwright Test Agents** (quando alguém pedir).

---

**Mantra do projeto:** _selfcure mede a maturidade de testabilidade do seu frontend e prova que está melhorando. A correção é commodity — a visibilidade ao longo do tempo é o produto._
