# Skill: site-multilang-update

## Propósito

Atualizar páginas do site (ex: site/index.html) de forma **coerente e abrangente em todas as línguas** suportadas, mantendo a consistência do conteúdo, branding e posicionamento comercial.

## Quando usar
- Sempre que houver mudança de copy, feature, fluxo, branding ou qualquer ajuste relevante em qualquer idioma do site.
- Sempre que atualizar a landing page, quickstart, pipeline, features, status, integrações, etc.
- Sempre que adicionar ou remover idiomas.

## Como aplicar
1. **Leia o conteúdo atual do site** (HTML e todos os blocos `<script type="application/json" id="i18n-xx">`).
2. **Defina o novo conteúdo/copy** em inglês (fonte primária) e português (prioridade BR).
3. **Atualize todos os blocos i18n**:
   - EN e PT: sempre completos e revisados.
   - ES, FR, DE, ZH, JA: traduza as novas/alteradas, mantendo o máximo de contexto e tom; se não for possível traduzir tudo, garanta que as strings novas/alteradas não fiquem em inglês puro (evite fallback visível).
   - Se não dominar o idioma, use tradução assistida e sinalize para revisão posterior.
4. **Garanta que todas as seções do HTML** (hero, pipeline, features, quickstart, status, integrações, nav, etc.) estejam sincronizadas com as traduções.
5. **Valide a sintaxe JSON** de todos os blocos i18n (parse em Node.js).
6. **Commit e push**.
7. **Documente a alteração** em `docs/implementations/YYYY-MM-DD-site-multilang-update.md`.
8. **Atualize SKILLHUB.md** para registrar a execução da skill.

## Dicas
- Nunca deixe strings novas só em inglês se o idioma principal do usuário for outro.
- Se a mudança for só visual/HTML, revise se há impacto em alguma string i18n.
- Se adicionar/remover idioma, atualize todos os lugares (nav, select, i18n blocks, etc.).
- Use sempre o tom e posicionamento definidos em CLAUDE.md e AGENTS.md.
- Se a mudança for comercial, garanta que o novo escopo/posicionamento esteja refletido em todas as línguas.

## Exemplo de commit

```
docs(site): atualiza landing e i18n para novo escopo comercial (EN, PT, ES, FR, DE, ZH, JA)
```
