export const crawlPageHtml = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>selfcure — crawl</title>
</head>
<body>

<main>
  <h1>selfcure crawl</h1>
  <p>Run the crawler and list detected pages/components, props, and interactive tags.</p>

  <form id="crawlForm">
    <fieldset>
      <legend>Run</legend>

      <p>
        <label for="configPath">Config path</label><br>
        <input id="configPath" name="configPath" type="text" value="selfcure.config.mjs" autocomplete="off">
      </p>

      <p>
        <button type="submit">Run crawler</button>
      </p>
    </fieldset>
  </form>

  <p id="status" role="status"></p>
  <p id="errorMsg" role="alert" hidden></p>

  <section id="filters" hidden>
    <h2>Filters</h2>

    <p>
      <label for="searchText">Search</label><br>
      <input id="searchText" type="search" placeholder="Component, file, prop, selector, label" autocomplete="off">
    </p>

    <p>
      <label for="frameworkFilter">Framework</label><br>
      <select id="frameworkFilter">
        <option value="">All</option>
      </select>
    </p>

    <p>
      <label for="complexityFilter">Complexity</label><br>
      <select id="complexityFilter">
        <option value="">All</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </p>

    <p>
      <label for="tagFilter">Tag / element type</label><br>
      <select id="tagFilter">
        <option value="">All</option>
      </select>
    </p>

    <p>
      <label for="minScore">Minimum score</label><br>
      <input id="minScore" type="number" min="0" max="100" value="0">
    </p>

    <p>
      <label>
        <input id="onlyWithTags" type="checkbox">
        Show only components with interactive tags
      </label>
    </p>

    <p>
      <label for="sortBy">Sort by</label><br>
      <select id="sortBy">
        <option value="filePath">File path</option>
        <option value="componentName">Component name</option>
        <option value="scoreDesc">Score, high to low</option>
        <option value="scoreAsc">Score, low to high</option>
        <option value="tagsDesc">Interactive tags, high to low</option>
      </select>
    </p>
  </section>

  <section id="summary" hidden>
    <h2>Summary</h2>
    <p id="summaryText"></p>
  </section>

  <section id="results" hidden>
    <h2>Pages / components</h2>
    <div id="componentList"></div>
  </section>
</main>

<script>
  let crawlData = [];

  const form = document.getElementById('crawlForm');
  const statusEl = document.getElementById('status');
  const errorMsg = document.getElementById('errorMsg');
  const filters = document.getElementById('filters');
  const summary = document.getElementById('summary');
  const results = document.getElementById('results');
  const componentList = document.getElementById('componentList');

  const filterControls = [
    'searchText',
    'frameworkFilter',
    'complexityFilter',
    'tagFilter',
    'minScore',
    'onlyWithTags',
    'sortBy',
  ].map(id => document.getElementById(id));

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function setOptions(select, values) {
    const current = select.value;
    select.innerHTML = '<option value="">All</option>' + values
      .map(value => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>')
      .join('');
    if (values.includes(current)) select.value = current;
  }

  function refreshFilterOptions() {
    setOptions(
      document.getElementById('frameworkFilter'),
      uniqueSorted(crawlData.map(item => item.framework))
    );

    setOptions(
      document.getElementById('tagFilter'),
      uniqueSorted(crawlData.flatMap(item => item.interactiveElements.map(el => el.type)))
    );
  }

  function matchesSearch(item, query) {
    if (!query) return true;
    const haystack = [
      item.componentName,
      item.filePath,
      item.framework,
      item.complexity,
      ...item.props.flatMap(prop => [prop.name, prop.type, prop.required ? 'required' : 'optional']),
      ...item.interactiveElements.flatMap(el => [el.type, el.selector, el.label, ...el.actions]),
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  }

  function getFilteredData() {
    const query = document.getElementById('searchText').value.trim().toLowerCase();
    const framework = document.getElementById('frameworkFilter').value;
    const complexity = document.getElementById('complexityFilter').value;
    const tag = document.getElementById('tagFilter').value;
    const minScore = Number(document.getElementById('minScore').value || 0);
    const onlyWithTags = document.getElementById('onlyWithTags').checked;
    const sortBy = document.getElementById('sortBy').value;

    const filtered = crawlData.filter(item => {
      if (!matchesSearch(item, query)) return false;
      if (framework && item.framework !== framework) return false;
      if (complexity && item.complexity !== complexity) return false;
      if (tag && !item.interactiveElements.some(el => el.type === tag)) return false;
      if (Number(item.score) < minScore) return false;
      if (onlyWithTags && item.interactiveElements.length === 0) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'componentName') return a.componentName.localeCompare(b.componentName);
      if (sortBy === 'scoreDesc') return b.score - a.score;
      if (sortBy === 'scoreAsc') return a.score - b.score;
      if (sortBy === 'tagsDesc') return b.interactiveElements.length - a.interactiveElements.length;
      return a.filePath.localeCompare(b.filePath);
    });

    return filtered;
  }

  function renderProps(props) {
    if (!props.length) return '<p>No props found.</p>';

    return '<table><thead><tr><th>Name</th><th>Type</th><th>Required</th></tr></thead><tbody>' +
      props.map(prop => '<tr>' +
        '<td><code>' + escapeHtml(prop.name) + '</code></td>' +
        '<td><code>' + escapeHtml(prop.type) + '</code></td>' +
        '<td>' + (prop.required ? 'yes' : 'no') + '</td>' +
      '</tr>').join('') +
      '</tbody></table>';
  }

  function renderElements(elements) {
    if (!elements.length) return '<p>No interactive tags found.</p>';

    return '<table><thead><tr><th>Type</th><th>Selector</th><th>Label</th><th>Actions</th></tr></thead><tbody>' +
      elements.map(el => '<tr>' +
        '<td>' + escapeHtml(el.type) + '</td>' +
        '<td><code>' + escapeHtml(el.selector) + '</code></td>' +
        '<td>' + escapeHtml(el.label || '') + '</td>' +
        '<td>' + escapeHtml((el.actions || []).join(', ')) + '</td>' +
      '</tr>').join('') +
      '</tbody></table>';
  }

  function render() {
    const filtered = getFilteredData();
    const totalTags = filtered.reduce((sum, item) => sum + item.interactiveElements.length, 0);
    const totalProps = filtered.reduce((sum, item) => sum + item.props.length, 0);

    document.getElementById('summaryText').textContent =
      filtered.length + ' of ' + crawlData.length + ' component(s), ' + totalProps + ' prop(s), ' + totalTags + ' interactive tag(s).';

    componentList.innerHTML = filtered.map(item => {
      const relPath = item.filePath;
      return '<article>' +
        '<details open>' +
          '<summary>' +
            '<strong>' + escapeHtml(item.componentName) + '</strong>' +
            ' — ' + escapeHtml(relPath) +
            ' — ' + escapeHtml(item.framework) +
            ' — score ' + escapeHtml(item.score) +
            ' — ' + escapeHtml(item.complexity) +
          '</summary>' +
          '<h3>Props</h3>' +
          renderProps(item.props) +
          '<h3>Interactive tags</h3>' +
          renderElements(item.interactiveElements) +
        '</details>' +
      '</article>';
    }).join('');
  }

  filterControls.forEach(control => {
    control.addEventListener('input', render);
    control.addEventListener('change', render);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMsg.hidden = true;
    errorMsg.textContent = '';
    statusEl.textContent = 'Running crawler...';

    try {
      const configPath = document.getElementById('configPath').value.trim();
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configPath }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Crawler failed');

      crawlData = data.components || [];
      refreshFilterOptions();
      render();

      filters.hidden = false;
      summary.hidden = false;
      results.hidden = false;
      statusEl.textContent = 'Crawler complete. Root: ' + (data.rootDir || '');
    } catch (err) {
      errorMsg.textContent = err.message || String(err);
      errorMsg.hidden = false;
      statusEl.textContent = '';
    }
  });
</script>

</body>
</html>
`;
