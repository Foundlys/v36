'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/workspace-page-fixture'),{locales}=require('../foundly-i18n'),catalog=require('../foundly-locales'),{WORKSPACE_DEFINITIONS}=require('../workspace-system');
const shared=['procurement','sales','calendar','data','knowledge','learning','automation','connectors','communication','marketing','settings'];
const sections=[...new Set(shared.flatMap(id=>WORKSPACE_DEFINITIONS[id].sections))];
const key=section=>'workspace.page.section.'+section.toLowerCase().replaceAll(' ','_');
test('every registered shared workspace tab has explicit eight-locale labels while preserving IDs and selection',()=>{
 const f=fixture();f.ui.state.workspace={sections};f.ui.renderTabs();const tabs=[...f.nodes.workspaceTabs.children],before=f.calls.length;tabs[0].setAttribute('aria-selected','false');tabs[2].setAttribute('aria-selected','true');tabs[2].tabIndex=0;
 for(const locale of locales){f.i.setLocale(locale);for(const [i,section]of sections.entries()){assert.equal(f.nodes.workspaceTabs.children[i],tabs[i]);assert.equal(tabs[i].textContent,f.i.t(key(section)));assert.equal(tabs[i].id,'workspace-tab-'+i);}assert.equal(tabs[2].getAttribute('aria-selected'),'true');assert.equal(tabs[2].tabIndex,0);assert.equal(f.calls.length,before);assert.equal(f.i.missingKeys().length,0);}
});
test('registered section descriptions and literal workspace parameters follow all locales without additional reads',async()=>{
 const f=fixture(),literal='Workspace <img> {count}';f.ui.state.workspace={short_label:literal,label:literal};
 for(const section of sections){
  f.ui.state.activeSection=section;f.ui.renderContext(section);await Promise.resolve();const before=f.calls.length,title=f.nodes.contextTitle,description=f.nodes.contextDescription;
  const descriptionKey='workspace.page.section_description.'+section.toLowerCase().replaceAll(' ','_');
  for(const locale of locales){f.i.setLocale(locale);const expected=Object.hasOwn(catalog.messages[locale],descriptionKey)?f.i.t(descriptionKey):f.i.t('workspace.page.section_description_fallback',{workspace:literal});assert.equal(description.textContent,expected);assert.equal(f.nodes.contextDescription,description);assert.equal(f.nodes.contextTitle,title);assert.equal(f.calls.length,before);assert.equal(description.querySelector('img'),null);assert.equal(f.i.missingKeys().length,0);}
 }
});
test('owned context headings update in place while unknown section and workspace names remain literal',async()=>{
 const f=fixture();f.ui.state.workspace={short_label:'Literal workspace <img>'};f.ui.state.activeSection='SCHEMAS';f.ui.renderContext('SCHEMAS');await Promise.resolve();const before=f.calls.length;
 for(const locale of locales){f.i.setLocale(locale);assert.equal(f.nodes.contextTitle.textContent,f.i.t(key('SCHEMAS')));assert.ok(f.nodes.contextEyebrow.textContent.includes('Literal workspace <img>'));assert.ok(f.nodes.contextEyebrow.textContent.includes(f.i.t(key('SCHEMAS'))));assert.equal(f.nodes.contextEyebrow.querySelector('img'),null);assert.equal(f.calls.length,before);}
 for(const literal of ['PRIVATE_SOURCE_TITLE_<img>','constructor','__proto__']){
  f.ui.state.workspace.sections=[literal];f.ui.renderTabs();f.ui.state.activeSection=literal;f.ui.renderContext(literal);await Promise.resolve();const calls=f.calls.length;
  for(const locale of locales){f.i.setLocale(locale);assert.equal(f.nodes.workspaceTabs.children[0].textContent,literal);assert.equal(f.nodes.contextTitle.textContent,literal);assert.equal(f.nodes.workspaceTabs.querySelector('img'),null);assert.equal(f.calls.length,calls);assert.equal(f.i.missingKeys().length,0);}
 }
});
