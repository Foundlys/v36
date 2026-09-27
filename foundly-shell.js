'use strict';

(() => {
  if (document.body?.hasAttribute('data-foundly-workspace')) return;
  const i18n=globalThis.FoundlyI18n;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const normalizedPath = location.pathname.replace(/\.html$/, '') || '/';
  const launcher = make('button', 'FoundlyOsLauncher', 'Foundly OS');
  launcher.type = 'button'; launcher.setAttribute('aria-haspopup', 'dialog'); i18n.bind(launcher,'nav.open','aria-label'); launcher.setAttribute('aria-keyshortcuts', 'Control+Shift+K Meta+Shift+K');
  const dialog = make('dialog', 'FoundlyOsMenu');
  const header = make('div', 'FoundlyOsMenuHeader'), title = make('div'), close = make('button', '', '×');
  title.append(i18n.bind(make('p'),'nav.heading'), make('h2', '', 'Foundly Operating System'));
  close.type = 'button'; i18n.bind(close,'common.close','aria-label'); close.addEventListener('click', () => dialog.close());
  header.append(title, close);
  const searchLabel = make('label', 'FoundlyOsMenuSearch'), search = make('input');searchLabel.append(i18n.bind(make('span'),'nav.search'));
  search.type = 'search'; i18n.bind(search,'nav.search_hint','placeholder'); search.autocomplete = 'off'; searchLabel.append(search);
  const localeLabel=make('label','FoundlyOsMenuSearch'),localeSelect=make('select');localeLabel.append(i18n.bind(make('span'),'common.language'),localeSelect);localeSelect.setAttribute('data-ui-locale','');i18n.installLocaleControl(localeSelect);
  const grid = make('nav', 'FoundlyOsMenuGrid'); i18n.bind(grid,'nav.workspaces','aria-label');
  dialog.append(header, localeLabel, searchLabel, grid);
  const commandBar = document.querySelector('.topActions, .top-actions, .topbar');
  if (commandBar) { launcher.classList.add('FoundlyOsLauncher--inline'); commandBar.append(launcher); }
  else document.body.append(launcher);
  document.body.append(dialog);

  let workspaces = [];
  const label=item=>i18n.t('module.'+(item.id==='home'?'core':item.id));
  function render(query = '') {
    const value = query.trim().toLocaleLowerCase(i18n.locale), rows = workspaces.filter(item => !value || `${label(item)} ${item.id}`.toLocaleLowerCase(i18n.locale).includes(value));
    const links = rows.map(item => {
      const link = make('a', '', label(item)); link.href = item.route; link.append(make('span', '', i18n.t('nav.eyebrow.'+(['procurement','sales','calendar'].includes(item.id)?'business':item.id))));
      if (normalizedPath === item.route) link.setAttribute('aria-current', 'page');
      return link;
    });
    grid.replaceChildren(...(links.length ? links : [i18n.bind(make('div', 'FoundlyOsMenuEmpty'),'nav.empty')]));
  }

  async function load() {
    try {
      const response = await fetch('/api/workspaces', { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(); workspaces = Array.isArray(data.workspaces) ? data.workspaces : []; render();
    } catch {
      grid.replaceChildren(i18n.bind(make('div', 'FoundlyOsMenuEmpty'),'nav.unavailable'));
    }
  }

  launcher.addEventListener('click', () => { dialog.showModal(); search.focus(); if (!workspaces.length) load(); });
  search.addEventListener('input', event => render(event.target.value));
  document.addEventListener('foundly:locale',()=>{if(workspaces.length)render(search.value);});
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') { event.preventDefault(); launcher.click(); }
  });
})();
