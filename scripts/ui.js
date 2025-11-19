(function(){
  'use strict';
  window.App = window.App || {};

  // UI and state management for OrgPaper
  const AppStorage = window.App.AppStorage;
  const AppUtils = window.App.AppUtils;

  const App = window.App;

  App.state = {
    teams: [],
    people: [],
    snapshots: [],
    filterTeamId: 'all',
    searchQuery: '',
    collapsed: {},
    compareA: null,
    compareB: null
  };

  App.init = function(){
    try {
      AppStorage.seedIfEmpty();
      App.state.teams = AppStorage.load(AppStorage.keys.teams, []);
      App.state.people = AppStorage.load(AppStorage.keys.people, []);
      App.state.snapshots = AppStorage.load(AppStorage.keys.snapshots, []);
      App.state.collapsed = AppStorage.load(AppStorage.keys.collapsed, {});

      bindCoreEvents();
      hydrateCompareSelectors();
      renderSnapshotsMini();
    } catch (e) {
      console.error('App.init error', e);
    }
  };

  App.render = function(){
    try {
      renderTeamsPanel();
      renderOrgChart();
      renderDiffPanel();
    } catch (e) {
      console.error('App.render error', e);
    }
  };

  // Event bindings
  function bindCoreEvents(){
    // Search
    $('#search').on('input', AppUtils.debounce(function(){
      App.state.searchQuery = $(this).val().trim().toLowerCase();
      renderOrgChart();
    }, 200));

    // Teams filter clicks (delegated)
    $('#teamsPanel').on('click', 'button[data-team]', function(){
      const id = $(this).attr('data-team');
      App.state.filterTeamId = id;
      $('#teamsPanel button').removeClass('bg-[#FAFAF9]').removeClass('ring-1').removeClass('ring-[#E7E5E4]');
      $(this).addClass('bg-[#FAFAF9] ring-1 ring-[#E7E5E4]');
      renderOrgChart();
    });

    // Add team
    $('#btnAddTeam').on('click', function(){ openTeamModal(); });

    // Add person
    $('#btnAddPerson').on('click', function(){ openPersonModal(); });

    // Expand/Collapse all
    $('#btnExpandAll').on('click', function(){ App.state.collapsed = {}; persistCollapsed(); renderOrgChart(); });
    $('#btnCollapseAll').on('click', function(){
      // Collapse everyone who has children
      const parents = new Set(App.state.people.filter(p=>childrenOf(p.id).length>0).map(p=>p.id));
      const collapsed = {}; parents.forEach(id=>collapsed[id]=true);
      App.state.collapsed = collapsed; persistCollapsed(); renderOrgChart();
    });

    // Chart interactions
    $('#chartPanel')
      .on('click', '.btn-collapse', function(){
        const id = $(this).closest('[data-id]').attr('data-id');
        App.state.collapsed[id] = !App.state.collapsed[id];
        persistCollapsed();
        renderOrgChart();
      })
      .on('click', '.btn-edit', function(){
        const id = $(this).closest('[data-id]').attr('data-id');
        const person = App.state.people.find(p=>p.id===id);
        openPersonModal(person);
      })
      .on('click', '.btn-add-report', function(){
        const id = $(this).closest('[data-id]').attr('data-id');
        openPersonModal({ managerId: id });
      });

    // Snapshot
    $('#btnSnapshot').on('click', function(){ openSnapshotModal(); });

    // Export
    $('#btnExport').on('click', function(){ exportData(); });

    // Import
    $('#fileImport').on('change', function(){
      const file = this.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = function(evt){
        try {
          const data = JSON.parse(evt.target.result);
          if (!data || !Array.isArray(data.people) || !Array.isArray(data.teams)) throw new Error('Invalid file');
          App.state.people = data.people; App.state.teams = data.teams; App.state.snapshots = data.snapshots || [];
          AppStorage.save(AppStorage.keys.people, App.state.people);
          AppStorage.save(AppStorage.keys.teams, App.state.teams);
          AppStorage.save(AppStorage.keys.snapshots, App.state.snapshots);
          toast('Imported successfully');
          hydrateCompareSelectors();
          renderSnapshotsMini();
          App.render();
        } catch(e){ toast('Import failed'); console.error('Import error', e); }
        $('#fileImport').val('');
      };
      reader.readAsText(file);
    });

    // Print
    $('#btnPrint').on('click', function(e){ e.preventDefault(); window.print(); });

    // Compare actions
    $('#btnCompare').on('click', function(){ renderDiffPanel(); });
    $('#compareA, #compareB').on('change', function(){ renderDiffPanel(); });

    // Scroll drag for horizontal panning
    (function(){
      const $s = $('#chartScroll');
      let isDown=false, startX, scrollLeft;
      $s.on('mousedown', function(e){ isDown=true; startX=e.pageX - $s.offset().left; scrollLeft=$s.scrollLeft(); });
      $(document).on('mouseup', function(){ isDown=false; });
      $s.on('mouseleave', function(){ isDown=false; });
      $s.on('mousemove', function(e){ if(!isDown) return; e.preventDefault(); const x=e.pageX - $s.offset().left; const walk=(x - startX)*1; $s.scrollLeft(scrollLeft - walk); });
    })();
  }

  function persistCollapsed(){ AppStorage.save(AppStorage.keys.collapsed, App.state.collapsed); }

  function hydrateCompareSelectors(){
    const snaps = App.state.snapshots.slice().sort((a,b)=>b.timestamp - a.timestamp);
    const $a = $('#compareA'); const $b = $('#compareB');
    $a.empty(); $b.empty();
    snaps.forEach(s=>{
      const label = `${AppUtils.escapeHtml(s.name)} (${AppUtils.formatDateTime(s.timestamp)})`;
      $a.append(`<option value="${s.id}">${label}</option>`);
      $b.append(`<option value="${s.id}">${label}</option>`);
    });
    if (snaps.length>=2){ $a.val(snaps[1].id); $b.val(snaps[0].id); }
  }

  function renderSnapshotsMini(){
    const $box = $('#snapshotsMini');
    $box.empty();
    if (!App.state.snapshots.length){
      $box.append(`<p class="text-sm text-[#78716C]">No snapshots yet</p>`);
      return;
    }
    App.state.snapshots.slice().sort((a,b)=>b.timestamp - a.timestamp).forEach(s=>{
      const item = $(`
        <button class="w-full text-left border border-[#E7E5E4] hover:bg-[#FAFAF9] rounded-lg p-2 transition" aria-label="Snapshot ${AppUtils.escapeHtml(s.name)}">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium" style="font-family: 'Inter Tight', sans-serif;">${AppUtils.escapeHtml(s.name)}</span>
            <span class="text-xs text-[#78716C]">${AppUtils.formatDateTime(s.timestamp)}</span>
          </div>
        </button>
      `);
      item.on('click', function(){ $('#compareB').val(s.id); renderDiffPanel(); });
      $box.append(item);
    });
  }

  function renderTeamsPanel(){
    const $list = $('#teamsPanel');
    $list.empty();
    const allBtn = $(`<li><button data-team="all" class="w-full text-left px-3 py-2 rounded-md flex items-center justify-between hover:bg-[#FAFAF9] transition ${App.state.filterTeamId==='all' ? 'bg-[#FAFAF9] ring-1 ring-[#E7E5E4]' : ''}"><span>All teams</span><span class="pill">${App.state.people.length}</span></button></li>`);
    $list.append(allBtn);

    App.state.teams.forEach(t=>{
      const count = App.state.people.filter(p=>p.teamId===t.id).length;
      const li = $(`
        <li>
          <button data-team="${t.id}" class="w-full text-left px-3 py-2 rounded-md flex items-center justify-between hover:bg-[#FAFAF9] transition ${App.state.filterTeamId===t.id ? 'bg-[#FAFAF9] ring-1 ring-[#E7E5E4]' : ''}">
            <span>${AppUtils.escapeHtml(t.name)}</span>
            <span class="pill">${count}</span>
          </button>
        </li>
      `);
      $list.append(li);
    });
  }

  function childrenOf(managerId){ return App.state.people.filter(p => (p.managerId || null) === managerId); }

  function getRoots(){ return App.state.people.filter(p => !p.managerId); }

  function personTeamName(p){ return App.state.teams.find(t=>t.id===p.teamId)?.name || 'No team'; }

  function renderOrgChart(){
    const $panel = $('#chartPanel');
    $panel.empty();

    const search = App.state.searchQuery;
    const filterTeam = App.state.filterTeamId;

    function matchPerson(p){
      const matchesSearch = !search || (`${p.name} ${p.title} ${personTeamName(p)}`.toLowerCase().indexOf(search) !== -1);
      const matchesTeam = filterTeam==='all' || p.teamId === filterTeam;
      return matchesSearch && matchesTeam;
    }

    const roots = getRoots();
    if (!roots.length){
      $panel.append('<p class="text-[#78716C]">No people yet. Add your first person.</p>');
      return;
    }

    const $tree = $('<ul class="list-none p-0 m-0"></ul>');

    function renderNode(person){
      const id = person.id;
      const kids = childrenOf(id);
      const collapsed = !!App.state.collapsed[id];
      const showNode = matchPerson(person);
      // If node itself does not match, but a descendant matches, we still show the branch
      let descendantMatches = false;
      (function checkDesc(p){
        childrenOf(p.id).forEach(c=>{ if(matchPerson(c)) descendantMatches = true; checkDesc(c); });
      })(person);
      const visible = showNode || descendantMatches;
      if (!visible) return null;

      const initials = person.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
      const teamName = AppUtils.escapeHtml(personTeamName(person));

      const $li = $(`<li class="text-center" data-id="${id}"></li>`);
      const $node = $(`
        <div class="org-node ${collapsed?'node-collapsed':''}">
          <div class="node-card inline-flex flex-col items-center gap-2">
            <div class="flex items-center gap-3">
              <div class="avatar">${initials}</div>
              <div class="text-left">
                <div class="font-semibold" style="font-family: 'Inter Tight', sans-serif;">${AppUtils.escapeHtml(person.name)}</div>
                <div class="text-xs text-[#78716C]">${AppUtils.escapeHtml(person.title || '')}</div>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="pill" title="Team">${teamName}</span>
            </div>
            <div class="node-actions flex items-center gap-2 mt-2">
              <button class="btn-secondary btn-edit text-xs">Edit</button>
              <button class="btn-secondary btn-add-report text-xs">Add report</button>
              <button class="btn-secondary btn-collapse text-xs">${collapsed?'Expand':'Collapse'}</button>
            </div>
          </div>
        </div>
      `);
      $li.append($node);

      if (kids.length){
        const $children = $('<ul class="org-children"></ul>');
        kids.forEach(c=>{ const child = renderNode(c); if(child) $children.append(child); });
        if ($children.children().length){ $li.append($children); }
      }
      return $li;
    }

    getRoots().forEach(r=>{ const node = renderNode(r); if(node) $tree.append(node); });
    $panel.append($tree);
  }

  function openTeamModal(team){
    const isEdit = !!team;
    const modalId = AppUtils.uid('m_');
    const $modal = $(`
      <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="${modalId}_title">
        <div class="modal p-5">
          <div class="flex items-center justify-between">
            <h3 id="${modalId}_title" class="text-lg font-semibold" style="font-family: 'Inter Tight', sans-serif;">${isEdit?'Edit team':'Add team'}</h3>
            <button class="btn-ghost" aria-label="Close">Close</button>
          </div>
          <div class="mt-4 space-y-3">
            <div>
              <label class="label" for="teamName">Team name</label>
              <input id="teamName" class="input" value="${AppUtils.escapeHtml(team?.name||'')}"/>
            </div>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            ${isEdit?'<button class="btn-secondary btn-delete">Delete</button>':''}
            <button class="btn-secondary btn-cancel">Cancel</button>
            <button class="btn-primary btn-save">Save</button>
          </div>
        </div>
      </div>
    `);
    $modal.find('.btn-ghost, .btn-cancel').on('click', function(){ $modal.remove(); });
    $modal.on('click', function(e){ if(e.target===this) $modal.remove(); });
    $modal.find('.btn-save').on('click', function(){
      const name = String($('#teamName').val()||'').trim();
      if (!name){ toast('Please enter a team name'); return; }
      if (isEdit){ team.name = name; }
      else { App.state.teams.push({ id: AppUtils.uid('t_'), name, createdAt: Date.now() }); }
      AppStorage.save(AppStorage.keys.teams, App.state.teams);
      renderTeamsPanel(); renderOrgChart();
      $modal.remove(); toast('Saved');
    });
    if (isEdit){
      $modal.find('.btn-delete').on('click', function(){
        if (!confirm('Delete this team? People will be left without a team.')) return;
        App.state.teams = App.state.teams.filter(t=>t.id!==team.id);
        AppStorage.save(AppStorage.keys.teams, App.state.teams);
        App.state.people.forEach(p=>{ if(p.teamId===team.id) p.teamId = null; });
        AppStorage.save(AppStorage.keys.people, App.state.people);
        renderTeamsPanel(); renderOrgChart();
        $modal.remove(); toast('Team deleted');
      });
    }
    $('#modals-root').append($modal);
  }

  function openPersonModal(person){
    const isEdit = person && person.id;
    const data = isEdit ? AppUtils.deepClone(person) : {
      id: AppUtils.uid('p_'), name: '', title: '', teamId: App.state.teams[0]?.id || null, managerId: person?.managerId || null, email: '', phone: '', bio: '', avatarUrl: '', createdAt: Date.now()
    };
    const modalId = AppUtils.uid('m_');

    function teamOptions(){
      return App.state.teams.map(t=>`<option value="${t.id}" ${data.teamId===t.id?'selected':''}>${AppUtils.escapeHtml(t.name)}</option>`).join('');
    }
    function managerOptions(){
      const opts = ['<option value="">No manager</option>'];
      App.state.people.filter(p=>!isEdit || p.id!==data.id).forEach(p=>{
        opts.push(`<option value="${p.id}" ${data.managerId===p.id?'selected':''}>${AppUtils.escapeHtml(p.name)} (${AppUtils.escapeHtml(p.title||'')})</option>`);
      });
      return opts.join('');
    }

    const $modal = $(`
      <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="${modalId}_title">
        <div class="modal p-5">
          <div class="flex items-center justify-between">
            <h3 id="${modalId}_title" class="text-lg font-semibold" style="font-family: 'Inter Tight', sans-serif;">${isEdit?'Edit person':'Add person'}</h3>
            <button class="btn-ghost" aria-label="Close">Close</button>
          </div>
          <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label" for="pName">Name</label>
              <input id="pName" class="input" value="${AppUtils.escapeHtml(data.name)}"/>
            </div>
            <div>
              <label class="label" for="pTitle">Title</label>
              <input id="pTitle" class="input" value="${AppUtils.escapeHtml(data.title)}"/>
            </div>
            <div>
              <label class="label" for="pTeam">Team</label>
              <select id="pTeam" class="input">${teamOptions()}</select>
            </div>
            <div>
              <label class="label" for="pManager">Manager</label>
              <select id="pManager" class="input">${managerOptions()}</select>
            </div>
            <div class="sm:col-span-2">
              <label class="label" for="pEmail">Email</label>
              <input id="pEmail" class="input" value="${AppUtils.escapeHtml(data.email)}" placeholder="name@company.com"/>
            </div>
            <div class="sm:col-span-2">
              <label class="label" for="pPhone">Phone</label>
              <input id="pPhone" class="input" value="${AppUtils.escapeHtml(data.phone)}" placeholder="Optional"/>
            </div>
            <div class="sm:col-span-2">
              <label class="label" for="pAvatar">Avatar URL</label>
              <input id="pAvatar" class="input" value="${AppUtils.escapeHtml(data.avatarUrl || '')}" placeholder="https://..."/>
            </div>
            <div class="sm:col-span-2">
              <label class="label" for="pBio">Bio</label>
              <textarea id="pBio" class="input" rows="3">${AppUtils.escapeHtml(data.bio)}</textarea>
            </div>
          </div>
          <div class="mt-4 flex justify-between items-center">
            ${isEdit?'<button class="btn-secondary btn-delete">Delete</button>':'<span class="text-xs text-[#78716C]">Tip: set Manager to define reporting line.</span>'}
            <div class="flex gap-2">
              <button class="btn-secondary btn-cancel">Cancel</button>
              <button class="btn-primary btn-save">Save</button>
            </div>
          </div>
        </div>
      </div>
    `);
    $modal.find('.btn-ghost, .btn-cancel').on('click', function(){ $modal.remove(); });
    $modal.on('click', function(e){ if(e.target===this) $modal.remove(); });

    $modal.find('.btn-save').on('click', function(){
      const name = String($('#pName').val()||'').trim();
      const title = String($('#pTitle').val()||'').trim();
      const teamId = $('#pTeam').val() || null;
      const managerId = $('#pManager').val() || null;
      const email = String($('#pEmail').val()||'').trim();
      const phone = String($('#pPhone').val()||'').trim();
      const avatarUrl = String($('#pAvatar').val()||'').trim();
      const bio = String($('#pBio').val()||'').trim();

      if (!name){ toast('Please enter a name'); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('Enter a valid email'); return; }
      if (isEdit){
        Object.assign(person, { name, title, teamId, managerId: managerId||null, email, phone, avatarUrl, bio });
      } else {
        Object.assign(data, { name, title, teamId, managerId: managerId||null, email, phone, avatarUrl, bio });
        App.state.people.push(data);
      }
      AppStorage.save(AppStorage.keys.people, App.state.people);
      renderTeamsPanel(); renderOrgChart();
      $modal.remove(); toast('Saved');
    });

    if (isEdit){
      $modal.find('.btn-delete').on('click', function(){
        if (!confirm('Delete this person? Their direct reports will move to this person\'s manager.')) return;
        const reports = App.state.people.filter(p=>p.managerId===person.id);
        reports.forEach(r=>{ r.managerId = person.managerId || null; });
        App.state.people = App.state.people.filter(p=>p.id!==person.id);
        AppStorage.save(AppStorage.keys.people, App.state.people);
        renderTeamsPanel(); renderOrgChart();
        $modal.remove(); toast('Person deleted');
      });
    }

    $('#modals-root').append($modal);
  }

  function openSnapshotModal(){
    const modalId = AppUtils.uid('m_');
    const $modal = $(`
      <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="${modalId}_title">
        <div class="modal p-5">
          <div class="flex items-center justify-between">
            <h3 id="${modalId}_title" class="text-lg font-semibold" style="font-family: 'Inter Tight', sans-serif;">Take snapshot</h3>
            <button class="btn-ghost" aria-label="Close">Close</button>
          </div>
          <div class="mt-4">
            <label class="label" for="snapName">Name</label>
            <input id="snapName" class="input" placeholder="e.g. Q2 2025 Restructure"/>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button class="btn-secondary btn-cancel">Cancel</button>
            <button class="btn-primary btn-save">Save</button>
          </div>
        </div>
      </div>
    `);
    $modal.find('.btn-ghost, .btn-cancel').on('click', function(){ $modal.remove(); });
    $modal.on('click', function(e){ if(e.target===this) $modal.remove(); });

    $modal.find('.btn-save').on('click', function(){
      const name = String($('#snapName').val()||'').trim() || 'Snapshot';
      const snap = {
        id: AppUtils.uid('s_'),
        name,
        timestamp: Date.now(),
        org: {
          teams: AppUtils.deepClone(App.state.teams),
          people: AppUtils.deepClone(App.state.people)
        }
      };
      App.state.snapshots.push(snap);
      AppStorage.save(AppStorage.keys.snapshots, App.state.snapshots);
      hydrateCompareSelectors();
      renderSnapshotsMini();
      $modal.remove(); toast('Snapshot saved');
    });

    $('#modals-root').append($modal);
  }

  function renderDiffPanel(){
    const $panel = $('#diffPanel');
    $panel.empty();
    const aId = $('#compareA').val();
    const bId = $('#compareB').val();
    const snaps = App.state.snapshots;
    const a = snaps.find(s=>s.id===aId); const b = snaps.find(s=>s.id===bId);
    if (!a || !b){ $panel.append('<p class="text-[#78716C]">Choose two snapshots to compare.</p>'); return; }

    const diff = AppUtils.diffSnapshots(a,b);

    function list(items, renderFn){
      if (!items.length) return '<p class="text-[#78716C]">None</p>';
      return `<ul class="list-disc pl-5 space-y-1">${items.map(renderFn).join('')}</ul>`;
    }

    const added = list(diff.addedPeople, p=>`<li><span class="font-medium">${AppUtils.escapeHtml(p.name)}</span> joined ${AppUtils.escapeHtml(App.state.teams.find(t=>t.id===p.teamId)?.name||'team')}</li>`);
    const removed = list(diff.removedPeople, p=>`<li><span class="font-medium">${AppUtils.escapeHtml(p.name)}</span> left</li>`);
    const mgr = list(diff.managerChanges, ch=>{
      const from = nameOf(ch.from) || 'No manager';
      const to = nameOf(ch.to) || 'No manager';
      return `<li>${AppUtils.escapeHtml(ch.person.name)} manager changed: ${AppUtils.escapeHtml(from)} → ${AppUtils.escapeHtml(to)}</li>`;
    });
    const team = list(diff.teamChanges, ch=>`<li>${AppUtils.escapeHtml(ch.person.name)} moved: ${AppUtils.escapeHtml(ch.from)} → ${AppUtils.escapeHtml(ch.to)}</li>`);

    $panel.append(`
      <div class="space-y-3">
        <div>
          <div class="text-xs text-[#78716C]">Added</div>
          ${added}
        </div>
        <div>
          <div class="text-xs text-[#78716C]">Removed</div>
          ${removed}
        </div>
        <div>
          <div class="text-xs text-[#78716C]">Manager changes</div>
          ${mgr}
        </div>
        <div>
          <div class="text-xs text-[#78716C]">Team moves</div>
          ${team}
        </div>
      </div>
    `);

    function nameOf(id){ if(!id) return null; const p = App.state.people.find(x=>x.id===id) || a.org.people.find(x=>x.id===id) || b.org.people.find(x=>x.id===id); return p? p.name : null; }
  }

  function exportData(){
    const data = { people: App.state.people, teams: App.state.teams, snapshots: App.state.snapshots };
    const blob = new Blob([JSON.stringify(data,null,2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'orgpaper.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }

  function toast(msg){
    const id = AppUtils.uid('t_');
    const $t = $(`<div class="toast">${AppUtils.escapeHtml(msg)}</div>`);
    $('#toasts-root').append($t);
    setTimeout(()=>{ $t.fadeOut(200, function(){ $(this).remove(); }); }, 1800);
  }

})();