# selfcure — Documentação-Mestre (estado do sistema)

> **Esta é a fonte única de verdade sobre o que o selfcure É hoje.** Snapshot vivo,
> não plano de obra. Sempre que um pacote, comando ou módulo nascer/morrer/mudar de
> papel, **atualize este arquivo primeiro**.
>
> _Última atualização: 2026-06-04._

---

## 1. O que o selfcure é

selfcure é a **plataforma de maturidade de testabilidade do frontend**. Mede, mostra
e acompanha o quão pronto um frontend está para ser automatizado — independente da
ferramenta de automação que o time usa (Cypress, Playwright, Selenium, TestCafe,
WebdriverIO, qualquer uma).

```
selfcure (visibilidade + maturidade)         Ferramentas de automação (execução)
─────────────────────────────────────         ──────────────────────────────────
crawl do source FE (AST)                      Cypress / Playwright / Selenium / ...
score de testabilidade por componente         executam testes
flag de selectors ambíguos / fracos      →    consomem o data-testid que selfcure
inventário de data-testid governado           garantiu que existe e é estável
suite de relatórios (TML, a11y, testids)
ship do fix como PR (FE é o dono)
mapa visual por tela com screenshot           ← Fase 23 (planejado)
gráfico de evolução temporal                  ← Fase 23 (planejado)
```

**Pitch:** "selfcure mostra se sua aplicação está pronta para ser automatizada — e
prova que está melhorando. Qualquer ferramenta de automação se beneficia, mas o
diferencial é a visibilidade que ninguém entrega hoje."

**O que selfcure NÃO é:** ferramenta de correção de código (qualquer IA com Cursor/Copilot
faz isso), nem competidor direto do Playwright Test Agents ou de healers reativos. A
correção é commodity; **o produto é a medição, o histórico e o argumento de maturidade**.

**Diferencial defensável (moat):** análise estática do source FE + detecção de
ambiguidade intra-componente + inventário governado de tags + score histórico
comparável + mapa visual por tela com screenshot. Nenhum healer reativo enxerga
isso, e nenhuma IA generalista de IDE mantém esse histórico ao longo do tempo.

**Entrada comercial:** `@selfcure/mcp` — servidor MCP gratuito e open-source que qualquer
cliente IA instala em uma linha. Pro features (auto-fix, abertura de PR, dashboards,
módulo de acessibilidade, integração SonarQube, motor próprio de screenshot) ficam
por cima.

---

## 2. Pacotes (10)

Monorepo npm workspaces (`packages/*`). ESM-only, TypeScript, build via `tsup`.

| Pacote | Papel | Status | O que faz |
|--------|-------|--------|-----------|
| `@selfcure/crawler` | ★ moat | ativo | Crawler estático via `@typescript-eslint/parser` — extrai AST + metadados de cada componente |
| `@selfcure/analyzer` | ★ moat | ativo | Score de testabilidade 0–100 + **detecção de ambiguidade** (selectors compartilhados entre siblings) |
| `@selfcure/web` | ★ moat | ativo | UI local: wizard de `init`, página `/lint` (checkboxes + fluxo de PR), `/crawl`, `/integrations` (OAuth SCM) · _`/map` e `/evolution`: Fase 23 (planejado)_ |
| `@selfcure/mcp` | ★ entrada comercial | ativo | Servidor Model Context Protocol (stdio) expondo crawl + analyze + lint a qualquer cliente IA |
| `@selfcure/screenshot` | ★ Fase 23 | planejado | Camada de captura de screenshot com providers (Playwright/Cypress/Selenium/TestCafe) + fallback próprio (pago) |
| `@selfcure/cli` | infra | ativo | Entry-point Commander que orquestra todos os comandos |
| `@selfcure/generator` | fallback BYOK legado | ativo | Análise do componente → LLM (Vercel AI SDK) → spec Playwright |
| `@selfcure/runner` | fallback BYOK legado | ativo | Wrapper de `playwright test` — captura status/erro/trace |
| `@selfcure/selfcure` | fallback BYOK legado | ativo | Loop de autocura — manda erro+trace ao LLM, aplica diff, revalida |
| `@selfcure/reporter` | fallback BYOK legado | ativo | Relatório HTML com evidências (screenshots, traces, diffs) |

> **Nunca delete** `generator` / `runner` / `selfcure` / `reporter` — são o fallback BYOK
> para quem ainda não migrou para os Playwright Test Agents. Funcionam hoje, mas não são
> o produto principal — o produto é visibilidade e maturidade via crawler + analyzer +
> módulos de governança + telas visuais.

**Grafo de dependências (headline):**

```
crawler ──► analyzer ──► lint pipeline ──► PR
                │              │
                ▼              │
               mcp ◄───────────┘
```

---

## 3. Comandos CLI

```bash
# Headline — UI local
selfcure web         # abre a UI: wizard de init, /lint, /crawl, /integrations
                     # zero-config orquestrado (Fase 23 — planejado)
selfcure stop        # mata o web server numa porta

# Comandos individuais
selfcure init        # gera selfcure.config.mjs
selfcure crawl       # crawl do source → metadados de componentes
selfcure lint        # [Pro] lint de selectors instáveis + patches data-testid + PR
selfcure lint --prompt  # gera prompt pronto p/ agent do IDE (Copilot/Cursor) — sem API key
selfcure export      # exporta findings p/ ferramenta externa (SonarQube Generic Issue Format)
selfcure mcp         # sobe o servidor MCP em stdio

# Módulos de governança (ver §4)
selfcure discover            # descobre estrutura, framework e rotas (estático)
selfcure a11y scan|audit     # WCAG: escaneia, mantém inventário, gate de CI
selfcure tml report|scan|audit   # Tag Maturity Level
selfcure testids scan|audit  # inventário governado de data-testid

# Snapshot e histórico (Fase 23)
selfcure snapshot    # captura screenshots e grava ponto no histórico

# Fallback BYOK legado (somente para quem não migrou ainda)
selfcure run         # gera testes, roda e auto-cura falhas
selfcure heal        # cura testes que falharam sem regerar a suíte
selfcure report      # relatório HTML do último run
```

---

## 4. Módulos de governança (entregues 2026-06-01)

Quatro módulos que compõem o coração do produto, junto com crawler + analyzer.
**Estes módulos são o foco comercial.** O fallback BYOK
(generator/runner/selfcure/reporter) é mantido por compatibilidade.

| Módulo | Comando | O que faz |
|--------|---------|----------|
| **Agentic Discovery** | `discover` | Descobre estrutura do projeto, framework e candidatos a rota via análise estática; simplifica o `init` |
| **Accessibility (WCAG)** | `a11y scan/audit` | Escaneia o source por issues WCAG, mantém inventário de findings, gate de CI. **Feature paga.** |
| **Tag Maturity Level (TML)** | `tml report/scan/audit` | Modelo de maturidade por tag que explica testabilidade e mudanças necessárias; report HTML+JSON |
| **Test ID Inventory** | `testids scan/audit` | Contrato governado de `data-testid`: escaneia uso real e audita contra o contrato |

---

## 5. Telas web _(Fase 23 — planejado, não entregue ainda)_

> As telas abaixo fazem parte do roadmap Fase 23 e **ainda não estão implementadas**.
> Hoje `selfcure web` abre o wizard de init, `/lint`, `/crawl` e `/integrations`.

Três telas planejadas para materializar o conceito de plataforma de maturidade:

| Tela | Rota | Audiência | O que mostrará |
|------|------|-----------|----------------|
| **Dashboard** | `/` | Todos | Resumo: score geral, top issues, atalhos para as outras telas |
| **Mapa Visual** | `/map` | QA, FE, tech lead | Screenshot de cada página com elementos destacados por score, código referente, acessibilidade e mudanças sugeridas |
| **Evolução Temporal** | `/evolution` | Tech lead, arquiteto, gestor | Gráfico de maturidade ao longo do tempo, tags governadas vs nativas, comparação entre componentes |

**Screenshots** (planejado) via `@selfcure/screenshot`:
- **Free:** usa motor da ferramenta já instalada (Playwright, Cypress, Selenium, TestCafe).
- **Pago:** Chromium headless on-demand para projetos sem ferramenta de automação.

**Cache planejado:** `.selfcure/cache/screenshots/` · **Histórico planejado:** `.selfcure/history/` via `selfcure snapshot`.

---

## 6. Stack & ambiente

- **Node.js 20+**, TypeScript, ESM-only, build via `tsup`, testes via Vitest.
- **Playwright 1.60+** — opcional. Usado apenas se o cliente já tem instalado, como
  um dos providers de screenshot. O produto principal **não depende de Playwright**.
- **`@modelcontextprotocol/sdk`** — servidor MCP.
- **Vercel AI SDK** — só no fallback legado (provider-agnóstico: Anthropic, OpenAI,
  Google, Groq, DeepSeek, Ollama). Defaults em `PROVIDERS` (`packages/generator/src/ai.ts`).
- **BYOK** — nunca embarca credenciais. `.env` no projeto-alvo. Providers: `anthropic → ANTHROPIC_API_KEY` · `openai → OPENAI_API_KEY` · `google → GOOGLE_GENERATIVE_AI_API_KEY` · `groq → GROQ_API_KEY` · `deepseek → DEEPSEEK_API_KEY` · `ollama → (sem chave)`.
- **`gh` CLI** — fluxo de PR (GitHub). `glab` (GitLab) implementado na Fase 13.

```bash
npm install
npm run build   # tsup → dist/
npm test        # vitest
npm run lint    # tsc --noEmit
```

---

## 7. Status atual

| Bloco | Estado |
|-------|--------|
| Fases 0–9 (pipeline BYOK original) | ✅ entregue → rebaixado a fallback legado |
| Fase 10 — Detecção de ambiguidade | ✅ |
| Fase 11 — Lint web + fluxo de PR | ✅ |
| Fase 12 — Servidor MCP | ✅ |
| Fase 13 — Abstração de GitProvider (GitHub/GitLab) | ✅ |
| Fases 17–20 — discovery / a11y / TML / testids | ✅ entregues 2026-06-01 |
| Fase 14 — Dogfood pago (1º PR mergeado fora do qnexytest) | ⏳ pendente |
| Fase 21 — Integração SonarQube via Generic Issue Format | ✅ código (2026-06-04) — falta só publicar em sonarplugins.com |
| Fase 22 — Silos de landing page por ferramenta de automação | ✅ código (2026-06-04) — falta só SEO/ranqueamento |
| **Fase 23 — Onboarding zero-config + 3 telas + screenshot agnóstico** | 🔄 **em curso** — slice "Copy prompt to IDE" (sem API key) entregue 2026-06-04 |
| Fase 15 — Plugin Figma | ⏳ somente se demanda orgânica aparecer de clientes |
| Fase 16 — Integração Playwright Test Agents | ⏳ futuro, atrás de feature flag |
| Publicação npm | parcial — pacotes prontos, não publicados |

Histórico completo das fases: ver git log.

---

## 8. Posicionamento de mercado

**Público-alvo (na ordem de prioridade comercial):**

1. **Tech leads e arquitetos** de aplicações em evolução constante (legado, híbrido ou
   moderno) que precisam de score quantificável de testabilidade para argumentar
   qualidade com gestores.
2. **QA engineers** que sentem a dor de testes flaky e precisam de dados concretos
   para mostrar ao time que o problema é o componente, não o teste.
3. **Frontend devs** que recebem o PR de cura e veem o score subir, criando ciclo
   virtuoso de melhoria contínua.

**Estratégia de distribuição:**

- **CLI via npm** — canal técnico principal (`npx selfcure`).
- **MCP server** — entrada via qualquer cliente IA (Cursor, Claude Code, Copilot,
  Windsurf), sem barreira de instalação.
- **Landing pages por ferramenta de automação** — SEO por silos (`/cypress`,
  `/playwright`, `/selenium`, `/testcafe`, `/webdriverio`), mesmo produto contado
    com a linguagem de cada tribo.
  - **Integração SonarQube via Generic Issue Format** — sem plugin Java, sem manter
    artefato em outra linguagem. Chega no arquiteto e tech lead no painel que ele já usa.
- **Comunidades-alvo:** Discord do Playwright, Friends of Figma, dev.to, LinkedIn
  por persona (QA, FE, tech lead).

**Modelo de monetização:**

- **Community (grátis):**
  - CLI completa, crawl, analyze, score local
  - MCP server, BYOM/BYOK
  - Copy prompt to IDE (para quem não tem API key)
  - _Mapa visual, evolução temporal e screenshot agnóstico: planejado para Fase 23_
- **Team (~USD 199/mês):**
  - Dashboard web com histórico compartilhado entre membros do time
  - PR comments automáticos, comparação entre branches
  - Módulo a11y
- **Business (~USD 599/mês):**
  - SSO, multi-repo, alertas Slack/Teams
  - Relatórios executivos
  - **Motor próprio de screenshot** (Chromium headless on-demand para projetos
    que não têm ferramenta de automação instalada)
- **Enterprise (~USD 2-5k/mês):**
  - On-premise, custom prompts, SLA
  - Prioridade no roadmap
  - Integração SonarQube com suporte

---

**Mantra:** _selfcure mede a maturidade de testabilidade do seu frontend e prova que
está melhorando. A correção é commodity — a visibilidade ao longo do tempo é o produto._
