'use strict';

(() => {
  if (document.body?.hasAttribute('data-foundly-workspace')) return;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const normalizedPath = location.pathname.replace(/\.html$/, '') || '/';
  const launcher = make('button', 'FoundlyOsLauncher', 'Foundly OS');
  launcher.type = 'button'; launcher.setAttribute('aria-haspopup', 'dialog'); launcher.setAttribute('aria-label', 'Open globale Foundly-navigatie'); launcher.setAttribute('aria-keyshortcuts', 'Control+Shift+K Meta+Shift+K');
  const dialog = make('dialog', 'FoundlyOsMenu');
  const header = make('div', 'FoundlyOsMenuHeader'), title = make('div'), close = make('button', '', '×');
  title.append(make('p', '', 'GLOBAL COMMAND NAVIGATION'), make('h2', '', 'Foundly Operating System'));
  close.type = 'button'; close.setAttribute('aria-label', 'Sluiten'); close.addEventListener('click', () => dialog.close());
  header.append(title, close);
  const searchLabel = make('label', 'FoundlyOsMenuSearch', 'Zoek workspace'), search = make('input');
  search.type = 'search'; search.placeholder = 'CRM, Finance, Connectors…'; search.autocomplete = 'off'; searchLabel.append(search);
  const grid = make('nav', 'FoundlyOsMenuGrid'); grid.setAttribute('aria-label', 'Foundly workspaces');
  dialog.append(header, searchLabel, grid);
  const commandBar = document.querySelector('.topActions, .top-actions, .topbar');
  if (commandBar) { launcher.classList.add('FoundlyOsLauncher--inline'); commandBar.append(launcher); }
  else document.body.append(launcher);
  document.body.append(dialog);

  let workspaces = [];
  function render(query = '') {
    const value = query.trim().toLowerCase(), rows = workspaces.filter(item => !value || `${item.label} ${item.short_label} ${item.description}`.toLowerCase().includes(value));
    const links = rows.map(item => {
      const link = make('a', '', item.label); link.href = item.route; link.append(make('span', '', item.eyebrow || item.short_label));
      if (normalizedPath === item.route) link.setAttribute('aria-current', 'page');
      return link;
    });
    grid.replaceChildren(...(links.length ? links : [make('div', 'FoundlyOsMenuEmpty', 'Geen toegankelijke workspace gevonden.') ]));
  }

  async function load() {
    try {
      const response = await fetch('/api/workspaces', { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(); workspaces = Array.isArray(data.workspaces) ? data.workspaces : []; render();
    } catch {
      grid.replaceChildren(make('div', 'FoundlyOsMenuEmpty', 'Globale navigatie kon niet worden geladen.'));
    }
  }

  launcher.addEventListener('click', () => { dialog.showModal(); search.focus(); if (!workspaces.length) load(); });
  search.addEventListener('input', event => render(event.target.value));
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') { event.preventDefault(); launcher.click(); }
  });
})();
