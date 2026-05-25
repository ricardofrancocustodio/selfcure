# Selfcure — Build Roadmap

> **Para o agente IA:** Este documento é o plano de construção do Selfcure. Implemente módulo por módulo, na ordem definida. Não pule etapas. Cada módulo tem critério de pronto (Definition of Done) — só avance quando o atual estiver validado.

---

## 🎯 Visão do produto

Selfcure é uma CLI que automatiza testes de regressão em aplicações legadas (sem `data-testid`, sem padrão, sem documentação). Lê o código, mapeia elementos, gera testes Playwright, executa e se autocorrige quando locators falham.

**Público-alvo:** times com aplicações grandes e antigas que precisam implementar regressão automatizada.

**Diferencial:** sabe distinguir teste ruim de componente ruim — não tenta "curar" o que é responsabilidade do frontend corrigir.

---

## 🏗️ Arquitetura geral

```
selfcure/
├── packages/
│   ├── cli/           # entry point (commander)
│   ├── crawler/       # leitura estática + dinâmica
│   ├── analyzer/      # classificação + score
│   ├── generator/     # geração de testes Playwright
│   ├── runner/        # execução
│   ├── selfcure/      # loop de autocura
│   └── reporter/      # relatório HTML
├── examples/          # apps de teste para validação
├── docs/
├── selfcure.config.mjs # exemplo de config
└── package.json
```

**Stack:**
- Node.js 20+
- TypeScript
- Playwright 1.60+
- Anthropic SDK
- Commander (CLI)
- Vitest (testes internos)

---

## 📋 Ordem de implementação

### Fase 0 — Setup do monorepo
### Fase 1 — CLI esqueleto + `selfcure init`
### Fase 2 — Crawler estático
### Fase 3 — Crawler dinâmico + Codegen
### Fase 4 — Analyzer + score de testabilidade
### Fase 5 — Generator (testes Playwright)
### Fase 6 — Runner
### Fase 7 — Selfcure (loop de autocura)
### Fase 8 — Reporter HTML
### Fase 9 — Publicação npm

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
  baseUrl: 'http://localhost:3000',
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
