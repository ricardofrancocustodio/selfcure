# Selfcure — Build Roadmap

> **Para o agente IA:** Este documento é o plano de construção do Selfcure. As Fases 0–9 originais já foram entregues e o produto pivotou para uma camada preventiva sobre o Playwright. Leia "Reposicionamento" antes de continuar e respeite o que está marcado como "fallback legado" vs o que é "headline".

---

## 🎯 Reposicionamento (2026-05) — leia primeiro

O mercado de healing pós-falha está **saturado**: Playwright Test Agents (oficial Microsoft — Planner, Generator, Healer), Shiplight, BrowserStack Self-Heal, LambdaTest AutoHeal, ZeroStep, Octomind, etc. Reimplementar healing competindo com a Microsoft é guerra perdida.

**Selfcure pivotou para a camada PREVENTIVA** — o que ninguém mais faz a partir do source FE:

```
selfcure (preventive)                       Playwright Test Agents (reactive)
─────────────────────                       ────────────────────────────────
crawl FE source (AST)                       run app, observe DOM
score testability per component       →     Planner: explore + Markdown plan
flag ambiguous / weak selectors             Generator: plan → .spec.ts
suggest data-testid patches                 Healer: re-run + repair failures
ship the fix as a PR (FE owns)
```

**Pitch oficial:** "Playwright Healer cures tests that break. Selfcure prevents them from breaking — by analyzing the component before it becomes a test and shipping the fix back to the frontend team."

**Entrada comercial:** `@selfcure/mcp` — servidor Model Context Protocol gratuito que qualquer cliente IA (Claude Desktop, Cursor, VS Code, Claude Code, Windsurf) instala em uma linha. A partir daí o agente do usuário consome `selfcure_lint`, `selfcure_analyze_component`, etc. Pro features (auto-fix, PR opening, Figma plugin) ficam em cima.

**Validação real (qnexytest dogfood, 2026-05-28):**
- 82 componentes analisados, score médio 43/100.
- 500 issues totais: 477 `ambiguous` (95%) + 23 `low-score`.
- Ambiguidade é o problema dominante — exatamente o que healers reativos não previnem.

---

## 🎯 Visão do produto

**O que selfcure é hoje:** um *lint de testabilidade + pipeline de PR* para frontends. Lê código React/Vue/Angular/HTML, marca componentes que não estão prontos pra teste, e abre PR com a correção via `gh` CLI.

**O que selfcure NÃO é (e nunca mais será):** um competidor direto do Playwright Healer Agent. A geração/cura de testes vira commodity gerenciada por Playwright Test Agents quando o cliente migra; nosso `@selfcure/generator` + `@selfcure/selfcure` ficam como **fallback BYOK** para times que ainda não migraram.

**Público-alvo:**
1. **Frontend devs** que querem aplicações testáveis sem pedir favor pro time de QA.
2. **Tech leads** que querem score de testabilidade quantificável por componente.
3. **QA engineers** usando Playwright Test Agents que precisam de um pré-filtro de componentes prontos pra teste.

**Diferencial defensável:** análise estática do source FE + detecção de ambiguidade intra-componente. Nenhum healer reativo enxerga isso.

---

## 🏗️ Arquitetura atual

```
selfcure/
├── packages/
│   ├── cli/           # entry point (commander) — init / crawl / lint / mcp / web / [legacy: run/heal/report]
│   ├── crawler/       # AST estática via @typescript-eslint/parser           ★ moat
│   ├── analyzer/      # score 0-100 + detecção de ambiguidade                ★ moat
│   ├── web/           # /lint page com checkboxes + PR flow                  ★ moat
│   ├── mcp/           # Model Context Protocol stdio server                  ★ entrada comercial
│   │
│   ├── generator/     # (fallback BYOK) source → LLM → Playwright spec
│   ├── runner/        # (fallback BYOK) @playwright/test wrapper
│   ├── selfcure/      # (fallback BYOK) heal loop
│   └── reporter/      # (fallback BYOK) HTML report
├── docs/
├── selfcure.config.mjs # template
└── package.json
```

**Stack:**
- Node.js 20+
- TypeScript
- Playwright 1.60+ (apenas como runtime de teste — não como agent)
- `@modelcontextprotocol/sdk` (servidor MCP)
- Vercel AI SDK (apenas no fallback legado)
- Commander (CLI)
- Vitest (testes internos — ainda sem cobertura, dogfood é o teste atual)

**Dependências externas críticas:**
- `gh` CLI — usado pelo PR flow. Selfcure delega autenticação; nunca armazenamos token.
- `glab` CLI — análogo ao gh para GitLab (suporte previsto na próxima onda).

---

## 📋 Ordem de implementação

### Fases 0–9 (CONCLUÍDAS — pipeline BYOK original)
- Fase 0 — Setup do monorepo ✅
- Fase 1 — CLI esqueleto + `selfcure init` ✅
- Fase 2 — Crawler estático ✅
- Fase 3 — ~Crawler dinâmico + Codegen~ (despriorizado após reposicionamento — Playwright Test Agents cobre isso)
- Fase 4 — Analyzer + score de testabilidade ✅
- Fase 5 — Generator (BYOK Playwright) ✅ — agora classificado como fallback legado
- Fase 6 — Runner ✅ — agora classificado como fallback legado
- Fase 7 — Selfcure heal loop ✅ — agora classificado como fallback legado
- Fase 8 — Reporter HTML ✅
- Fase 9 — Publicação npm (parcial — pacotes prontos, ainda não publicados)

### Fases 10+ (PÓS-REPOSICIONAMENTO — em curso)

- **Fase 10 — Ambiguidade ✅** (2026-05) — analyzer detecta selectors compartilhados entre siblings na mesma component; penalidade ×0.4 no score; replace mode no patcher.
- **Fase 11 — Lint web + PR flow ✅** (2026-05) — `/lint` page com checkboxes por issue, botão "Open pull request" único, branch + push + `gh pr create` em um clique, redirect pra GitHub. Base branch via `lint.prBaseBranch` ou auto-detect via `gh repo view`.
- **Fase 12 — MCP server ✅** (2026-05-28) — `@selfcure/mcp` stdio server com 4 tools (lint/list/analyze/suggest), 3 resources (config/lint-summary/reports-placeholder), 2 prompts (prepare/handoff). Licença MIT. Smoke test em qnexytest passou.
- **Fase 13 — Provider abstraction (em curso)** — refatorar PR flow atrás de uma interface `GitProvider`. Implementações: GitHub via `gh` (já existe, vai ser movida); GitLab via `glab`. Auto-detecção via `git remote get-url origin`. Linguagem dinâmica "pull/merge request" na UI.
- **Fase 14 — Dogfood pago** — primeiro repo real (não-qnexytest) abrindo um PR mergeado via selfcure. Critério: 1 FE dev fora do ricardo aplicando um patch que selfcure abriu.
- **Fase 15 — Figma plugin** — plugin que roda lint conceitual sobre o design antes de virar código. Mover trabalho de testabilidade pra esquerda do pipeline. Spike de prazo: começa quando Fases 13+14 estiverem fechadas.
- **Fase 16 — Integração profunda com Playwright Test Agents** — consumir `@playwright/mcp` server pra healing dinâmico atrás de feature flag. Spike só quando alguém pedir.

---

## Fase 0 — Setup do monorepo

**Objetivo:** estrutura base funcionando, lint, build, tipos.

**Tarefas:**
1. Inicializar monorepo com workspaces npm (ou pnpm)
2. Configurar TypeScript com `tsconfig.base.json`
3. Configurar ESLint + Prettier
4. Adicionar Vitest na raiz
5. Configurar `tsup` para build dos pacotes
6. Criar README inicial do repo

**Definition of Done:**
- `npm install` na raiz instala todos os workspaces
- `npm run build` compila todos os pacotes
- `npm run test` roda Vitest

---

## Fase 1 — CLI esqueleto + `selfcure init`

**Objetivo:** comando instalável globalmente, com `init` funcional.

**Tarefas:**
1. Criar `packages/cli` com bin apontando para `dist/index.js`
2. Implementar `selfcure init`:
   - Perguntas interativas (inquirer ou prompts)
   - Gera `selfcure.config.mjs` na raiz do projeto alvo
   - Cria pasta `.selfcure/` para cache e estado
3. Implementar comandos placeholder:
   - `selfcure crawl`
   - `selfcure record`
   - `selfcure run`
   - `selfcure report`
4. Adicionar `--help`, `--version`, `--verbose`

**Estrutura do `selfcure.config.mjs` gerado:**
```js
module.exports = {
  source: './src',
  framework: 'react',
  extensions: ['.tsx', '.jsx'],
  testsOutput: './selfcure-tests',
   baseUrl: 'http://localhost:5000',
  criticalFlows: [],
  selfcure: {
    maxRetries: 3,
    strategies: ['data-testid', 'id', 'name', 'aria-label', 'css', 'xpath']
  }
};
```

**Definition of Done:**
- `npm link` no `packages/cli` permite usar `selfcure` global
- `selfcure init` em pasta vazia gera config válido
- `selfcure --help` lista todos os comandos placeholder

---

## Fase 2 — Crawler estático

**Objetivo:** ler fonte React/Vue, extrair elementos interativos, classificar locators.

**Tarefas:**
1. Implementar leitor de AST (usar `@typescript-eslint/parser` para TSX, `@vue/compiler-sfc` para Vue)
2. Identificar elementos interativos:
   - `input`, `select`, `textarea`, `button`, `a`
   - Elementos com `role=button|dialog|combobox|menuitem|tab|...`
   - Componentes customizados (heurística: começa com maiúscula)
3. Extrair atributos relevantes: `id`, `data-testid`, `name`, `aria-label`, `class`, `type`
4. Detectar renderização condicional (`&&`, ternários, `v-if`)
5. Output: JSON estruturado em `.selfcure/static-map.json`

**Formato do output:**
```json
{
  "files": [
    {
      "path": "src/pages/Checkout.tsx",
      "components": [
        {
          "name": "PaymentModal",
          "isConditional": true,
          "elements": [
            {
              "type": "select",
              "line": 42,
              "attributes": {
                "data-testid": null,
                "id": null,
                "name": "card-brand",
                "class": "css-x7k2m"
              },
              "locatorCandidates": ["name=card-brand", ".css-x7k2m"],
              "reliability": "low"
            }
          ]
        }
      ]
    }
  ]
}
```

**Comando:**
```bash
selfcure crawl --static ./src/pages/Checkout.tsx
selfcure crawl --static ./src/pages/
```

**Definition of Done:**
- Detecta corretamente elementos em arquivos `.tsx` e `.vue`
- Identifica ausência de `data-testid`
- Diferencia elementos sempre renderizados vs condicionais
- Output válido em `.selfcure/static-map.json`
- Tem testes Vitest cobrindo 5+ casos (componente simples, com modal, com select customizado, com condicional, com componente externo)

---

## Fase 3 — Crawler dinâmico + integração com Codegen

**Objetivo:** capturar DOM em runtime através de receitas de navegação gravadas pelo Codegen.

**Tarefas:**
1. Implementar `selfcure record`:
   - Inicia o Playwright Codegen
   - Captura o script gerado
   - Salva como "flow" no `selfcure.config.mjs`
2. Implementar execução de flow:
   - Lê o flow do config
   - Executa via Playwright (launch browser, navegar, interagir)
   - Em cada parada, captura DOM completo
3. Extrair elementos do DOM capturado (mesma lógica de classificação do estático)
4. Output: `.selfcure/dynamic-map.json`

**Comando:**
```bash
selfcure record --name "checkout-payment-modal"
selfcure crawl --dynamic --flow "checkout-payment-modal"
```

**Definition of Done:**
- `selfcure record` abre o Codegen e salva o flow no config
- `selfcure crawl --dynamic` executa o flow e captura DOM
- DOM capturado é classificado igual ao estático
- Funciona com modais, drawers, steps de wizard

---

## Fase 4 — Analyzer + score de testabilidade

**Objetivo:** cruzar mapas estático e dinâmico, gerar score e relatório de problemas.

**Tarefas:**
1. Carregar `static-map.json` + `dynamic-map.json`
2. Detectar discrepâncias:
   - Elementos no fonte que não aparecem no DOM
   - Elementos no DOM que não aparecem no fonte (HTML gerado por libs)
   - `data-testid` no fonte que some no DOM
3. Calcular score de testabilidade por componente/página (0-100)
4. Classificar problemas:
   - 🔴 Crítico: elemento sem nenhum identificador estável
   - 🟡 Atenção: elemento com locator frágil
   - 🟢 OK: elemento com `data-testid` ou `id` estável
5. Gerar output `.selfcure/analysis.json`

**Comando:**
```bash
selfcure analyze
selfcure analyze --threshold 70   # falha se score < 70
```

**Definition of Done:**
- Score calculado corretamente para casos de teste
- Cruzamento estático/dinâmico funciona
- Output em JSON + texto colorido no terminal
- Suporta `--threshold` para usar em CI

---

## Fase 5 — Generator (testes Playwright)

**Objetivo:** gerar arquivos `.spec.ts` Playwright baseado nos mapas + flow.

**Tarefas:**
1. Carregar análise da Fase 4
2. Usar Claude API para gerar testes:
   - Prompt inclui mapa de elementos + flow do Codegen
   - Pede output em formato Playwright Test
   - Usa estratégia de locator mais confiável disponível
3. Escrever arquivos em `./selfcure-tests/`
4. Suportar regeneração incremental (não regerar testes já existentes a menos que `--force`)

**Comando:**
```bash
selfcure generate --flow "checkout-payment-modal"
selfcure generate --all
```

**Definition of Done:**
- Testes gerados rodam sem erro de sintaxe
- Usam `data-testid` quando disponível, fallback hierárquico quando não
- Cada teste tem comentário no topo: "Generated by Selfcure — review locator strategy"

---

## Fase 6 — Runner

**Objetivo:** executar os testes gerados e capturar resultados estruturados.

**Tarefas:**
1. Executar `playwright test` programaticamente
2. Capturar para cada teste:
   - Status (pass/fail)
   - Erro específico (locator não encontrado, timeout, asserção, etc)
   - Screenshot
   - Trace
3. Classificar tipo de falha:
   - Locator (elemento não encontrado)
   - Timing (timeout esperando elemento)
   - Assertion (lógica do teste)
   - Setup (erro antes de chegar no teste)
4. Output: `.selfcure/run-results.json`

**Comando:**
```bash
selfcure run
selfcure run --flow "checkout-payment-modal"
```

**Definition of Done:**
- Executa todos os testes em `./selfcure-tests/`
- Classifica corretamente os tipos de falha
- Salva trace + screenshot por teste falho

---

## Fase 7 — Selfcure (loop de autocura)

**Objetivo:** o coração do produto — corrigir testes que falharam por motivos curáveis.

**Tarefas:**
1. Ler resultados da Fase 6
2. Para cada falha tipo "locator":
   - Re-ler mapa dinâmico atual
   - Pedir ao Claude para sugerir locator alternativo
   - Reescrever o step no teste
   - Re-executar
3. Para falha tipo "timing":
   - Adicionar wait estratégico
   - Re-executar
4. Para falha tipo "assertion" ou "setup":
   - **Não tenta curar** — marca como "needs human review"
5. Limite de 3 tentativas por teste
6. Se esgotar tentativas e ainda for locator: marca como "componente sem identificador estável — devolver ao FE"

**Comando:**
```bash
selfcure heal
selfcure heal --max-retries 5
```

**Definition of Done:**
- Corrige automaticamente locators trocados (ex: `#btn-1` → `[data-testid="submit"]`)
- Não tenta curar lógica de teste
- Para no limite de retries
- Distingue "teste ruim" de "componente ruim" no output

---

## Fase 8 — Reporter HTML

**Objetivo:** relatório final visual com evidências.

**Tarefas:**
1. Gerar HTML estático em `.selfcure/report/`
2. Conteúdo:
   - Score geral de testabilidade
   - Lista de páginas/componentes com scores
   - Testes executados (pass/fail/healed)
   - Para cada falha: screenshot, trace, motivo, sugestão
   - Seção "Componentes que precisam de intervenção FE" (destaque)
3. Servir local com `selfcure report --serve`

**Comando:**
```bash
selfcure report
selfcure report --serve --port 4000
```

**Definition of Done:**
- HTML responsivo, sem dependências externas
- Mostra evidências visuais (screenshots inline)
- Tem CTA claro: "X componentes precisam de data-testid"

---

## Fase 9 — Publicação npm

**Objetivo:** disponibilizar como `npm install -g selfcure`.

**Tarefas:**
1. Verificar nome `selfcure` disponível no npm
2. Configurar `package.json` da CLI com bin, files, keywords
3. Build limpo (`npm run build`)
4. Publicar com `npm publish --access public`
5. Atualizar README com badge npm + instruções de instalação

**Definition of Done:**
- `npm install -g selfcure` funciona em máquina limpa
- `selfcure --version` retorna versão correta
- README do GitHub com exemplo end-to-end

---

## 🚨 Regras para o agente

1. **Não pule fases.** Cada uma depende da anterior.
2. **Teste cada módulo isoladamente** com Vitest antes de avançar.
3. **Commits pequenos e frequentes.** Um commit por tarefa concluída.
4. **Use exemplos reais.** Crie `examples/legacy-app/` — app legada em React sem `data-testid` — para validar cada fase.
5. **Não invente abstrações prematuras.** Cada módulo expõe uma função pura: `crawl(config) → map.json`. Sem classes desnecessárias.
6. **Logs estruturados.** Use `pino` ou similar — facilita debug e captura no CI.
7. **Mensagens de erro úteis.** "Element not found" é ruim. "Element with name=card-brand not found in PaymentModal — try recording flow again" é bom.
8. **Quando travado, documente a dúvida** em `docs/decisions/` (ADR pattern) antes de prosseguir.

---

## 📦 Próximo passo concreto

Começar pela **Fase 0**: criar estrutura de monorepo e validar build.

Depois, **Fase 1**: CLI com `init` funcionando.

Só então **Fase 2**: o Crawler de verdade.

---

**Mantra do projeto:** *Selfcure cures tests, not components. When the component is broken, it tells you.*
