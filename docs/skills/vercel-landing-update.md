# Skill: vercel-landing-update

## Propósito

Atualizar a landing page da Vercel (`connector/index.html`) em `selfcure.vercel.app` de forma
consistente com o posicionamento do produto definido em `CLAUDE.md`, `docs/SYSTEM.md` e
`docs/SELFCURE_BUILD.md`, sem divergir da mensagem do site GitHub Pages (`site/index.html`).

## Contexto arquitetural

O projeto tem **duas páginas públicas distintas** com propósitos diferentes:

| URL | Arquivo | Propósito |
|-----|---------|-----------|
| `selfcure.vercel.app` | `connector/index.html` | Landing page "enterprise/platform" hospedada na Vercel. Também serve como página de retorno para o connector OAuth. Deploy automático via Vercel a cada push em `connector/`. |
| `ricardofrancocustodio.github.io/selfcure/` | `site/index.html` | Landing page open-source com i18n multi-língua (EN/PT). Deploy via GitHub Pages a cada push em `site/`. |

A Vercel deploy é **diferente** do GitHub Pages deploy. Alterações em `site/` **não aparecem**
em `selfcure.vercel.app` e vice-versa.

## Quando usar esta skill

- Ao atualizar positioning, copy, hero, features ou mantra em qualquer um dos sites.
- Após atualizar `site/index.html` — verificar se `connector/index.html` precisa de sync.
- Ao adicionar funcionalidades que devem aparecer nas duas páginas (ex: SonarQube export).
- Ao corrigir referências a framing antigo (ex: "preventive layer", "Playwright Test Agents feeder").

## Framing proibido (não usar em nenhuma das páginas)

- ❌ `preventive layer` / `camada preventiva`
- ❌ `selfcure cura os tests, não os componentes`
- ❌ `feeds Playwright Test Agents` / `alimenta os Playwright Test Agents`
- ❌ `selfcure is pre-publish`
- ❌ `Enterprise` como brand name (a marca é só `selfcure`)

## Framing correto (usar em ambas as páginas)

- ✅ `correction is commodity — visibility over time is the product`
- ✅ `selfcure shows if your frontend is ready to be automated — and proves it's improving`
- ✅ tool-agnostic: Cypress, Playwright, Selenium, TestCafe, WebdriverIO
- ✅ dogfood: 500 issues, 477 ambiguous, avg score 43/100
- ✅ SonarQube export: feature ativa (não "próxima")

## Como aplicar

### 1. Leia os dois arquivos

```
read_file: connector/index.html   (linha 1 até o final)
read_file: site/index.html        (seções de i18n EN e PT)
```

### 2. Identifique divergências de framing

Buscar por strings proibidas:
```
grep_search: "preventive" em connector/index.html e site/index.html
grep_search: "Enterprise" em connector/index.html
grep_search: "Playwright Test Agents" em ambos
```

### 3. Faça as substituições em `connector/index.html`

Use `multi_replace_string_in_file` com 3–5 linhas de contexto antes/depois de cada target.

Áreas típicas a verificar em `connector/index.html`:
- `<title>` e `<meta name="description">`
- `.brand span` (nome do produto no header)
- `nav` CTAs e links
- `.hero` eyebrow e `<h1>`
- `.hero .lede`
- Seção `#integrations` description e `.integration-row`
- Seção "Proof points" / "case-grid"
- Seção `#contact` / `.final` — CTA e lede
- `<footer>` texto

### 4. Sincronize features e dogfood stats

Ambas as páginas devem mostrar:
- SonarQube export como feature **ativa**
- Selenium, TestCafe, WebdriverIO como runtimes suportados (além de Cypress e Playwright)
- Dogfood: 500 issues, 477 ambiguous, avg score 43/100

### 5. Commit e push

```bash
git add connector/index.html site/index.html
git commit -m "site: <descrição das mudanças>"
git push
```

Vercel faz deploy automático ao detectar push com mudanças em `connector/`.
GitHub Pages faz deploy automático ao detectar push com mudanças em `site/`.

### 6. Valide os dois deploys

- `selfcure.vercel.app` — aguardar ~1 min após push, depois Ctrl+Shift+F5
- `ricardofrancocustodio.github.io/selfcure/` — aguardar ~2 min após push

## Estrutura de `connector/index.html`

Arquivo único sem i18n — inglês somente. Estrutura:
```
<head> — title, meta, CSS inline
<header> — .topbar com .brand, nav, CTA
<main>
  .hero — eyebrow, h1, .lede, hero-actions, trust-strip, control-plane preview
  #platform — grid-3 de 6 cards (Governance, Scale, Automation, AI, TML, TestID)
  #security — compliance / dark-panel
  #integrations — integration-row (12 tiles)
  "Proof points" — case-grid com blockquotes
  #docs — code example + CTAs
  #contact .final — CTA final
<footer>
```

## Estrutura de `site/index.html`

Arquivo único com i18n embutido. Estrutura relevante:
```
<head> — title, meta
<body> — HTML com data-i18n attributes (fallback EN)
<script id="i18n-en"> — dict JSON inglês
<script id="i18n-pt"> — dict JSON português
<script> — applyLang(), LANGS array
```

Ao adicionar novo card de feature ao HTML, adicionar também as keys correspondentes
nos dois dicts (`i18n-en` e `i18n-pt`).
