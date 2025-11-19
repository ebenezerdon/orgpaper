(function(){
  'use strict';
  window.App = window.App || {};

  // Storage and utilities for OrgPaper
  const NAMESPACE = 'orgpaper_';

  const AppStorage = {
    keys: {
      people: NAMESPACE + 'people',
      teams: NAMESPACE + 'teams',
      snapshots: NAMESPACE + 'snapshots',
      collapsed: NAMESPACE + 'collapsed'
    },
    load: function(key, fallback){
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        console.error('Storage load failed', key, e);
        return fallback;
      }
    },
    save: function(key, value){
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.error('Storage save failed', key, e);
        return false;
      }
    },
    seedIfEmpty: function(){
      const existingPeople = AppStorage.load(AppStorage.keys.people, null);
      if (existingPeople && existingPeople.length) return;
      const now = Date.now();
      const tExec = AppUtils.uid('t_');
      const tEng = AppUtils.uid('t_');
      const tDesign = AppUtils.uid('t_');
      const pCEO = AppUtils.uid('p_');
      const pCTO = AppUtils.uid('p_');
      const pCPO = AppUtils.uid('p_');
      const pLeadFE = AppUtils.uid('p_');
      const pLeadBE = AppUtils.uid('p_');
      const pDesignLead = AppUtils.uid('p_');

      const teams = [
        { id: tExec, name: 'Executive', createdAt: now },
        { id: tEng, name: 'Engineering', createdAt: now },
        { id: tDesign, name: 'Design', createdAt: now }
      ];

      const people = [
        { id: pCEO, name: 'Avery Chen', title: 'Chief Executive Officer', teamId: tExec, managerId: null, email: 'avery@example.com', phone: '', bio: 'Leads company vision and strategy. Loves hiking on weekends.', avatarUrl: '', createdAt: now },
        { id: pCTO, name: 'Maya Patel', title: 'Chief Technology Officer', teamId: tExec, managerId: pCEO, email: 'maya@example.com', phone: '', bio: 'Guides technology and architecture.', avatarUrl: '', createdAt: now },
        { id: pCPO, name: 'Leo Garcia', title: 'Chief Product Officer', teamId: tExec, managerId: pCEO, email: 'leo@example.com', phone: '', bio: 'Owns product direction and outcomes.', avatarUrl: '', createdAt: now },
        { id: pLeadFE, name: 'Jules Kim', title: 'Lead Frontend Engineer', teamId: tEng, managerId: pCTO, email: 'jules@example.com', phone: '', bio: 'Designs delightful UIs and frontend systems.', avatarUrl: '', createdAt: now },
        { id: pLeadBE, name: 'Owen Wright', title: 'Lead Backend Engineer', teamId: tEng, managerId: pCTO, email: 'owen@example.com', phone: '', bio: 'Owns backend services and performance.', avatarUrl: '', createdAt: now },
        { id: pDesignLead, name: 'Sofia Nguyen', title: 'Design Lead', teamId: tDesign, managerId: pCPO, email: 'sofia@example.com', phone: '', bio: 'Champions product design and research.', avatarUrl: '', createdAt: now }
      ];

      AppStorage.save(AppStorage.keys.teams, teams);
      AppStorage.save(AppStorage.keys.people, people);
      AppStorage.save(AppStorage.keys.snapshots, []);
      AppStorage.save(AppStorage.keys.collapsed, {});
    }
  };

  const AppUtils = {
    uid: function(prefix){
      const r = Math.random().toString(36).slice(2, 8);
      const t = Date.now().toString(36).slice(-4);
      return (prefix || '') + r + t;
    },
    deepClone: function(obj){
      return JSON.parse(JSON.stringify(obj));
    },
    escapeHtml: function(str){
      if (str == null) return '';
      return String(str).replace(/[&<>"]/g, function(s){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[s];
      });
    },
    nowIso: function(){ return new Date().toISOString(); },
    formatDateTime: function(ts){
      try {
        const d = new Date(ts);
        return d.toLocaleString([], { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      } catch(e) { return '' + ts; }
    },
    debounce: function(fn, delay){
      let t; return function(){
        clearTimeout(t); const ctx=this, args=arguments; t = setTimeout(function(){ fn.apply(ctx,args); }, delay || 200);
      };
    },
    // Compute diff between two snapshots
    diffSnapshots: function(a, b){
      const aPeople = {}; (a.org.people || []).forEach(p=>aPeople[p.id]=p);
      const bPeople = {}; (b.org.people || []).forEach(p=>bPeople[p.id]=p);
      const aTeams = {}; (a.org.teams || []).forEach(t=>aTeams[t.id]=t);
      const bTeams = {}; (b.org.teams || []).forEach(t=>bTeams[t.id]=t);

      const addedPeople = []; const removedPeople = []; const managerChanges = []; const teamChanges = [];

      Object.keys(bPeople).forEach(id=>{ if(!aPeople[id]) addedPeople.push(bPeople[id]); });
      Object.keys(aPeople).forEach(id=>{ if(!bPeople[id]) removedPeople.push(aPeople[id]); });

      Object.keys(aPeople).forEach(id=>{
        if (bPeople[id]){
          const from = aPeople[id]; const to = bPeople[id];
          if ((from.managerId || null) !== (to.managerId || null)){
            managerChanges.push({ person: to, from: from.managerId || null, to: to.managerId || null });
          }
          if ((from.teamId || null) !== (to.teamId || null)){
            teamChanges.push({ person: to, from: aTeams[from.teamId]?.name || 'Unknown', to: bTeams[to.teamId]?.name || 'Unknown' });
          }
        }
      });

      return { addedPeople, removedPeople, managerChanges, teamChanges };
    }
  };

  window.App.AppStorage = AppStorage;
  window.App.AppUtils = AppUtils;
})();