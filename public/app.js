(function(){
  "use strict";

  // ---- tiny fetch helper ----
  function api(method, url, body, opts){
    opts = opts || {};
    var init = { method: method, headers: {}, credentials: "include" };
    if(body !== undefined){ init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    return fetch(url, init).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        if(res.status === 401 && !opts.suppressAuthRedirect){
          currentUser = null;
          syncAvatarUI(); syncRailVisibility();
          showLoginStep1(null, "Sua sessão expirou. Entre novamente.");
          throw new Error("unauthorized");
        }
        if(!res.ok){ throw new Error((data && data.error) || ("Erro (" + res.status + ")")); }
        return data;
      });
    });
  }

  // Categories used to be a fixed list here; now they live in the database
  // and are admin-manageable ("Gerenciar categorias"). The 5 original
  // categories (ferias/chat/h22/homeoffice/plantao) keep using the exact
  // same theme-aware CSS variables they always had, so nothing changes
  // visually for them. Any *new* category an admin creates gets its own
  // fixed hex color instead (chosen with a color picker) - the same color
  // in light and dark mode, which is a deliberate simplification.
  var BUILTIN_CSS_KEYS = { ferias:"ferias", chat:"chat", h22:"h22", homeoffice:"home", plantao:"plantao" };
  var WEEKDAYS = ["DOMINGO","SEGUNDA","TERÇA","QUARTA","QUINTA","SEXTA","SÁBADO"];
  var WEEKDAYS_SHORT = ["SEG","TER","QUA","QUI","SEX","SÁB","DOM"];
  var MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  var ROLE_LABEL = {admin:"Admin", usuario:"Usuário", implantacao:"Implantação"};

  function catInfo(key){
    var c = state.categories.find(function(x){ return x.key === key; });
    return c || { key:key, label:key, color:"#5b6478", presencial:false, order:99, active:true };
  }
  function hexToRgb(hex){
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return m ? { r:parseInt(m[1],16), g:parseInt(m[2],16), b:parseInt(m[3],16) } : { r:91, g:100, b:120 };
  }
  function catColor(key, part){
    if(BUILTIN_CSS_KEYS[key]){
      return "var(--cat-" + BUILTIN_CSS_KEYS[key] + (part==='bg'?'-bg':'') + ")";
    }
    var hex = catInfo(key).color || "#5b6478";
    if(part === 'bg'){ var rgb = hexToRgb(hex); return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",.16)"; }
    return hex;
  }

  // ---- date helpers (local time, no UTC surprises) ----
  function pad(n){ return n<10 ? "0"+n : ""+n; }
  function toISO(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function parseISO(s){ var p=s.split("-").map(Number); return new Date(p[0], p[1]-1, p[2]); }
  function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function addDays(d,n){ var r=new Date(d); r.setDate(r.getDate()+n); return r; }
  function startOfWeek(d){ var r=new Date(d); var wd=r.getDay(); var diff=(wd===0?-6:1-wd); return addDays(r,diff); }
  function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  function titleCase(s){ return s.replace(/\S+/g,function(w){return w.charAt(0).toUpperCase()+w.slice(1);}); }
  function todayDate(){ var n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate()); }
  function endOfMonthISO(d){ return toISO(new Date(d.getFullYear(), d.getMonth()+1, 0)); }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; });
  }

  var TODAY = todayDate();

  // ---- state ----
  var state = {
    shifts: [],
    people: [],
    users: [],
    categories: [],
    view: "semana",
    presencialOnly: false,
    activeCats: new Set(),
    current: TODAY,
    editingId: null
  };
  var currentUser = null; // {email, displayName, role, active, viewOnly, hasPassword}
  var seenCatKeys = {}; // tracks which categories we've already defaulted into activeCats

  // ---- permission helpers (mirror the server's rules for UI purposes only -
  // every mutation is re-checked authoritatively by the API itself) ----
  function personByName(name){ return state.people.find(function(p){ return p.name===name; }); }
  function personGroup(name){ var p = personByName(name); return p ? p.group : "geral"; }
  function isAdmin(){ return !!currentUser && currentUser.role === "admin"; }
  function canCreate(){
    if(!currentUser) return false;
    if(currentUser.role !== "admin" && currentUser.viewOnly) return false;
    return true;
  }
  function canManageShift(shift){
    if(!currentUser) return false;
    if(currentUser.role === "admin") return true;
    if(currentUser.viewOnly) return false;
    if(currentUser.role === "implantacao") return personGroup(shift.personName) === "implantacao";
    if(currentUser.role === "usuario") return !!shift.createdBy && shift.createdBy === currentUser.email;
    return false;
  }
  function selectablePeople(){
    var list = state.people.filter(function(p){ return p.active !== false; });
    if(currentUser && currentUser.role === "implantacao") list = list.filter(function(p){ return p.group === "implantacao"; });
    return list.slice().sort(function(a,b){ return a.name.localeCompare(b.name); });
  }

  // ---- rendering refs ----
  var elRoot = document.getElementById("calendarRoot");
  var elPeriod = document.getElementById("periodLabel");
  var elCount = document.getElementById("shiftCount");
  var elLegend = document.getElementById("legend");
  var elSeg = document.getElementById("viewSeg");
  var modalRoot = document.getElementById("modalRoot");

  function visibleShifts(list){
    return list.filter(function(s){
      if(!state.activeCats.has(s.category)) return false;
      if(state.presencialOnly && !catInfo(s.category).presencial) return false;
      return true;
    });
  }
  function shiftsFor(iso, all){
    var list = all.filter(function(s){ return s.date === iso; });
    list.sort(function(a,b){
      var oa = catInfo(a.category).order;
      var ob = catInfo(b.category).order;
      if(oa !== ob) return oa-ob;
      return a.personName.localeCompare(b.personName);
    });
    return list;
  }

  function renderLegend(){
    var visible = state.categories.filter(function(c){ return c.active !== false; });
    elLegend.innerHTML = visible.map(function(c){
      var off = state.activeCats.has(c.key) ? "" : "off";
      return '<button class="'+off+'" data-cat="'+c.key+'"><span class="sw" style="background:'+catColor(c.key)+'"></span>'+escapeHtml(c.label)+'</button>';
    }).join("");
  }

  function dayCardHTML(dateObj, all, extraClass){
    var iso = toISO(dateObj);
    var isToday = sameDay(dateObj, TODAY);
    var dayShifts = shiftsFor(iso, all);
    var visible = visibleShifts(dayShifts);
    var body = "";
    if(visible.length === 0){
      body = '<div class="empty-hint">Nenhum turno'+(dayShifts.length? ' visível' : '')+'.</div>';
    } else {
      body = visible.map(function(s){
        var c = catInfo(s.category);
        var mine = canManageShift(s);
        var titleBits = [];
        if(s.note) titleBits.push(s.note);
        if(s.groupId) titleBits.push(s.groupType==='recurring' ? "recorrente" : "período de vários dias");
        var titleAttr = titleBits.length ? ' title="'+escapeHtml(titleBits.join(" · "))+'"' : '';
        return '<button class="chip '+(mine?'':'ro')+'" data-id="'+s.id+'"'+titleAttr+' style="color:'+catColor(s.category)+';background:'+catColor(s.category,'bg')+'">'+
          '<span class="bar" style="background:'+catColor(s.category)+'"></span>'+
          '<span class="txt"><span class="name">'+escapeHtml(s.personName)+'</span><span class="cat">'+escapeHtml(c.label)+'</span></span>'+
          (s.groupId ? '<span class="grpmark"></span>' : '')+
        '</button>';
      }).join("");
    }
    var footer = canCreate()
      ? '<div class="daycard-foot"><button class="add-row" data-add="'+iso+'"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Adicionar</button></div>'
      : '<div class="daycard-foot"><div class="locked-row">Somente visualização</div></div>';
    return '<div class="daycard '+(isToday?'today':'')+' '+(extraClass||'')+'" data-date="'+iso+'">'+
      '<div class="daycard-head"><div><div class="wd">'+WEEKDAYS[dateObj.getDay()]+'</div>'+
        '<div class="num-wrap"><div class="num">'+dateObj.getDate()+'</div></div></div>'+
        '<div class="cnt">'+visible.length+(dayShifts.length!==visible.length? ' de '+dayShifts.length : '')+'</div></div>'+
      '<div class="daycard-body">'+body+'</div>'+
      footer+
    '</div>';
  }

  function renderWeek(){
    var mon = startOfWeek(state.current);
    var days = [];
    for(var i=0;i<7;i++) days.push(addDays(mon,i));
    var total = 0;
    var html = days.map(function(dt){
      total += visibleShifts(shiftsFor(toISO(dt), state.shifts)).length;
      return dayCardHTML(dt, state.shifts);
    }).join("");
    elRoot.innerHTML = '<div class="grid semana">'+html+'</div>';
    var last = days[6];
    var label = mon.getMonth()===last.getMonth()
      ? titleCase(MONTHS[mon.getMonth()])+" de "+mon.getFullYear()
      : titleCase(MONTHS[mon.getMonth()]).slice(0,3)+" – "+titleCase(MONTHS[last.getMonth()]).slice(0,3)+" "+last.getFullYear();
    elPeriod.textContent = label;
    elCount.textContent = total + (total===1 ? " turno nesta semana" : " turnos nesta semana");
  }

  function renderDay(){
    var dt = state.current;
    var total = visibleShifts(shiftsFor(toISO(dt), state.shifts)).length;
    elRoot.innerHTML = '<div class="grid dia">'+dayCardHTML(dt, state.shifts, "wide")+'</div>';
    elPeriod.textContent = titleCase(WEEKDAYS[dt.getDay()].toLowerCase())+", "+dt.getDate()+" de "+MONTHS[dt.getMonth()];
    elCount.textContent = total + (total===1 ? " turno neste dia" : " turnos neste dia");
  }

  function renderMonth(){
    var first = startOfMonth(state.current);
    var gridStart = startOfWeek(first);
    var cells = [];
    for(var i=0;i<42;i++) cells.push(addDays(gridStart,i));
    var total = 0;
    var dow = '<div class="month-dow">'+WEEKDAYS_SHORT.map(function(w){return '<span>'+w+'</span>';}).join("")+'</div>';
    var body = cells.map(function(dt){
      var iso = toISO(dt);
      var dayShifts = shiftsFor(iso, state.shifts);
      var visible = visibleShifts(dayShifts);
      if(dt.getMonth()===state.current.getMonth()) total += visible.length;
      var other = dt.getMonth()!==state.current.getMonth() ? "other" : "";
      var isToday = sameDay(dt, TODAY) ? "today" : "";
      var maxShow = 3;
      var chips = visible.slice(0,maxShow).map(function(s){
        return '<div class="mc-chip" style="color:'+catColor(s.category)+';background:'+catColor(s.category,'bg')+'">'+escapeHtml(s.personName)+'</div>';
      }).join("");
      var more = visible.length>maxShow ? '<div class="mc-more">+'+(visible.length-maxShow)+' mais</div>' : "";
      return '<div class="month-cell '+other+' '+isToday+'" data-date="'+iso+'"><div class="mc-num">'+dt.getDate()+'</div>'+chips+more+'</div>';
    }).join("");
    elRoot.innerHTML = '<div class="month-wrap">'+dow+'<div class="month-grid">'+body+'</div></div>';
    elPeriod.textContent = titleCase(MONTHS[state.current.getMonth()])+" de "+state.current.getFullYear();
    elCount.textContent = total + (total===1 ? " turno neste mês" : " turnos neste mês");
  }

  function renderCalendar(){
    renderLegend();
    if(state.view === "semana") renderWeek();
    else if(state.view === "dia") renderDay();
    else renderMonth();
    Array.prototype.forEach.call(elSeg.querySelectorAll("button[data-view]"), function(b){
      b.classList.toggle("on", b.dataset.view === state.view);
    });
    document.getElementById("btnPresencial").classList.toggle("filter-on", state.presencialOnly);
    document.getElementById("btnNew").disabled = !canCreate();
    document.getElementById("btnClear").hidden = !isAdmin();
  }

  // ---- toast ----
  function showToast(msg){
    var wrap = document.getElementById("toastWrap");
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function(){ t.remove(); }, 2800);
  }

  // ---- data loading ----
  function loadShifts(){
    return api("GET", "/api/shifts").then(function(data){
      state.shifts = data.shifts;
      renderCalendar();
    }).catch(function(e){ if(e.message !== "unauthorized") console.error(e); });
  }
  function loadPeople(){
    return api("GET", "/api/people").then(function(data){
      state.people = data.people;
      renderCalendar();
      if(document.getElementById("peopleList")) renderPeopleManager();
    }).catch(function(e){ if(e.message !== "unauthorized") console.error(e); });
  }
  function loadUsers(){
    if(!isAdmin()) return Promise.resolve();
    return api("GET", "/api/users").then(function(data){
      state.users = data.users;
      if(document.getElementById("usersList")) renderUsersManager();
    }).catch(function(e){ if(e.message !== "unauthorized") console.error(e); });
  }
  function loadCategories(){
    return api("GET", "/api/categories").then(function(data){
      state.categories = data.categories;
      // Any category we haven't seen yet (first load, or a new one an admin
      // just created) starts checked "on" in the legend, same as the old
      // fixed list always being fully visible by default.
      state.categories.forEach(function(c){
        if(!seenCatKeys[c.key]){
          seenCatKeys[c.key] = true;
          if(c.active !== false) state.activeCats.add(c.key);
        }
      });
      renderCalendar();
      if(document.getElementById("categoriesList")) renderCategoriesManager();
    }).catch(function(e){ if(e.message !== "unauthorized") console.error(e); });
  }

  // ---- shift modal ----
  function openModal(opts){
    opts = opts || {};
    var editing = opts.shift || null;
    var readOnly = !!opts.readOnly;
    var activeCategories = state.categories.filter(function(c){ return c.active !== false; });
    state.editingId = editing ? editing.id : null;
    var defaultCat = activeCategories.some(function(c){ return c.key==="chat"; }) ? "chat" : (activeCategories[0] ? activeCategories[0].key : "");
    var initialCat = editing ? editing.category : defaultCat;
    var initialDate = editing ? editing.date : (opts.date || toISO(state.current));
    var initialName = editing ? editing.personName : "";
    var initialNote = editing ? (editing.note || "") : "";
    var people = selectablePeople();
    var showSeriesFields = !editing && !readOnly;

    var nameOptions = '<option value="" disabled '+(initialName?'':'selected')+'>Selecione a pessoa</option>' +
      people.map(function(p){
        var sel = p.name===initialName ? "selected" : "";
        return '<option value="'+escapeHtml(p.name)+'" '+sel+'>'+escapeHtml(p.name)+(p.group==='implantacao'?' (Implantação)':'')+'</option>';
      }).join("");
    if(initialName && !people.some(function(p){return p.name===initialName;})){
      nameOptions += '<option value="'+escapeHtml(initialName)+'" selected>'+escapeHtml(initialName)+'</option>';
    }

    var groupNote = (editing && editing.groupId) ? '<p class="sub" style="margin-top:-10px">Faz parte de um grupo de vários registros ('+(editing.groupType==='recurring'?'recorrência semanal':'período de vários dias')+').</p>' : '';
    var createdNote = (editing && editing.createdBy) ? '<p class="sub" style="margin-top:-10px">Criado por '+escapeHtml(editing.createdBy)+'</p>' : '';

    modalRoot.innerHTML =
      '<div class="overlay" id="overlay">'+
        '<div class="modal" role="dialog" aria-modal="true">'+
          '<h2>'+(readOnly ? "Detalhes do turno" : (editing?"Editar turno":"Novo turno"))+'</h2>'+
          '<p class="sub">'+(readOnly ? "Você não pode editar este turno." : (editing?"Atualize as informações deste turno.":"Preencha os dados do turno da equipe."))+'</p>'+
          groupNote + createdNote +
          '<div class="field"><label for="fName">Nome</label><select id="fName" '+(readOnly?'disabled':'')+'>'+nameOptions+'</select></div>'+
          '<div class="field"><label>Categoria</label><div class="cat-picker '+(readOnly?'ro':'')+'" id="catPicker">'+
            (activeCategories.some(function(c){return c.key===initialCat;}) ? activeCategories : activeCategories.concat([catInfo(initialCat)])).map(function(c){
              var sel = c.key===initialCat ? "sel" : "";
              return '<button type="button" class="cat-pick '+sel+'" data-cat="'+c.key+'" style="color:'+catColor(c.key)+'"><span class="sw" style="background:'+catColor(c.key)+'"></span>'+escapeHtml(c.label)+'</button>';
            }).join("")+
          '</div></div>'+
          '<div class="field"><label for="fDate">Data'+(showSeriesFields?' inicial':'')+'</label><input type="date" id="fDate" value="'+initialDate+'" '+(readOnly?'disabled':'')+'></div>'+
          (showSeriesFields ?
            '<div class="check-row"><input type="checkbox" id="fPeriod"><label for="fPeriod" style="margin:0">Vários dias seguidos (período, ex: férias)</label></div>'+
            '<div class="field" id="fieldPeriodEnd" hidden><label for="fPeriodEnd">Data final</label><input type="date" id="fPeriodEnd"></div>'+
            '<div class="check-row"><input type="checkbox" id="fRecur"><label for="fRecur" style="margin:0">Repetir toda semana</label></div>'+
            '<div class="field" id="fieldRecurUntil" hidden><label for="fRecurUntil">Repetir até</label><input type="date" id="fRecurUntil" value="'+endOfMonthISO(state.current)+'"></div>'
            : '')+
          '<div class="field"><label for="fNote">Observação (opcional)</label><input type="text" id="fNote" placeholder="Ex: cobre horário extra" value="'+escapeHtml(initialNote)+'" '+(readOnly?'disabled':'')+'></div>'+
          '<div class="modal-actions">'+
            (!readOnly && editing ? '<button class="btn btn-danger-outline" id="btnDelete">Excluir</button>' : '<span></span>')+
            '<div class="right">'+
              (readOnly ? '<button class="btn" id="btnCancel">Fechar</button>' : '<button class="btn" id="btnCancel">Cancelar</button><button class="btn btn-primary" id="btnSave">Salvar</button>')+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';

    var selectedCat = initialCat;
    if(!readOnly){
      document.getElementById("catPicker").addEventListener("click", function(e){
        var b = e.target.closest(".cat-pick");
        if(!b) return;
        selectedCat = b.dataset.cat;
        Array.prototype.forEach.call(document.querySelectorAll(".cat-pick"), function(x){ x.classList.toggle("sel", x===b); });
      });
    }
    document.getElementById("overlay").addEventListener("mousedown", function(e){ if(e.target.id === "overlay") closeModal(); });
    document.getElementById("btnCancel").addEventListener("click", closeModal);

    if(showSeriesFields){
      var chkPeriod = document.getElementById("fPeriod");
      var chkRecur = document.getElementById("fRecur");
      var fieldPeriodEnd = document.getElementById("fieldPeriodEnd");
      var fieldRecurUntil = document.getElementById("fieldRecurUntil");
      chkPeriod.addEventListener("change", function(){
        if(chkPeriod.checked){ chkRecur.checked = false; fieldRecurUntil.hidden = true; }
        fieldPeriodEnd.hidden = !chkPeriod.checked;
      });
      chkRecur.addEventListener("change", function(){
        if(chkRecur.checked){ chkPeriod.checked = false; fieldPeriodEnd.hidden = true; }
        fieldRecurUntil.hidden = !chkRecur.checked;
      });
    }

    if(!readOnly && editing){
      document.getElementById("btnDelete").addEventListener("click", function(){ requestDelete(editing); });
    }
    if(!readOnly){
      document.getElementById("btnSave").addEventListener("click", function(){
        var nameSel = document.getElementById("fName").value;
        var date = document.getElementById("fDate").value;
        var note = document.getElementById("fNote").value.trim();
        if(!nameSel){ showToast("Selecione a pessoa."); return; }
        if(!date){ showToast("Informe a data."); return; }
        var base = { personName:nameSel, category:selectedCat, note:note };

        if(editing){
          updateExistingShift(editing.id, Object.assign({}, base, {date:date}));
          closeModal();
          return;
        }

        var mode = null, endVal = null;
        if(document.getElementById("fPeriod") && document.getElementById("fPeriod").checked){
          mode = "range"; endVal = document.getElementById("fPeriodEnd").value;
          if(!endVal){ showToast("Informe a data final do período."); return; }
        } else if(document.getElementById("fRecur") && document.getElementById("fRecur").checked){
          mode = "recurring"; endVal = document.getElementById("fRecurUntil").value;
          if(!endVal){ showToast("Informe até quando repetir."); return; }
        }
        commitNewShift(Object.assign({}, base, {date:date, mode:mode, endDate:endVal}));
        closeModal();
      });
    }

    document.addEventListener("keydown", escHandler);
    setTimeout(function(){ document.getElementById("fName").focus(); }, 30);
  }
  function escHandler(e){ if(e.key === "Escape") closeModal(); }
  function closeModal(){
    modalRoot.innerHTML = "";
    state.editingId = null;
    document.removeEventListener("keydown", escHandler);
  }

  // ---- shift data ops (server is authoritative; we just reflect the result) ----
  function commitNewShift(payload){
    api("POST", "/api/shifts", payload).then(function(data){
      state.shifts = state.shifts.concat(data.shifts);
      renderCalendar();
      showToast(data.shifts.length>1 ? data.shifts.length+" turnos criados" : "Turno salvo");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível salvar."); } });
  }
  function updateExistingShift(id, data){
    api("PATCH", "/api/shifts/"+encodeURIComponent(id), data).then(function(res){
      var idx = state.shifts.findIndex(function(s){ return s.id===id; });
      if(idx>-1) state.shifts[idx] = res.shift;
      renderCalendar();
      showToast("Turno salvo");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível salvar."); } });
  }
  function deleteShiftById(id){
    api("DELETE", "/api/shifts/"+encodeURIComponent(id)).then(function(){
      state.shifts = state.shifts.filter(function(s){ return s.id!==id; });
      renderCalendar();
      showToast("Turno excluído");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível excluir."); } });
  }
  function deleteGroup(groupId){
    api("DELETE", "/api/shifts/group/"+encodeURIComponent(groupId)+"/all").then(function(data){
      state.shifts = state.shifts.filter(function(s){ return s.groupId!==groupId; });
      renderCalendar();
      showToast(data.count+" turnos excluídos");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível excluir."); } });
  }
  function bulkDelete(ids){
    api("POST", "/api/shifts/bulk-delete", {ids:ids}).then(function(data){
      var set = {}; ids.forEach(function(i){ set[i]=true; });
      state.shifts = state.shifts.filter(function(s){ return !set[s.id]; });
      renderCalendar();
      showToast(data.count+" turnos excluídos");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível excluir."); } });
  }

  function requestDelete(shift){
    if(shift.groupId){
      var total = state.shifts.filter(function(s){ return s.groupId===shift.groupId; }).length;
      openGroupDeleteChoice(shift, total);
    } else {
      deleteShiftById(shift.id);
      closeModal();
    }
  }

  function openGroupDeleteChoice(shift, total){
    modalRoot.innerHTML =
      '<div class="overlay" id="overlay2">'+
        '<div class="modal" style="max-width:380px">'+
          '<h2>Excluir turno vinculado</h2>'+
          '<p class="sub">Este turno faz parte de um grupo com '+total+' registro(s) ('+(shift.groupType==='recurring'?'recorrência semanal':'período de vários dias')+'). O que deseja excluir?</p>'+
          '<div class="modal-actions" style="flex-direction:column;gap:8px;align-items:stretch;">'+
            '<button class="btn" id="gdOnly">Excluir somente este dia</button>'+
            '<button class="btn btn-danger-outline" id="gdAll">Excluir todos os '+total+'</button>'+
            '<button class="btn" id="gdCancel">Cancelar</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.getElementById("gdCancel").addEventListener("click", closeModal);
    document.getElementById("overlay2").addEventListener("mousedown", function(e){ if(e.target.id==="overlay2") closeModal(); });
    document.getElementById("gdOnly").addEventListener("click", function(){ deleteShiftById(shift.id); closeModal(); });
    document.getElementById("gdAll").addEventListener("click", function(){ deleteGroup(shift.groupId); closeModal(); });
  }

  function clearVisible(){
    var idsInRange = [];
    if(state.view === "dia"){
      var only = toISO(state.current);
      idsInRange = state.shifts.filter(function(s){ return s.date===only; }).map(function(s){return s.id;});
    } else if(state.view === "semana"){
      var mon = startOfWeek(state.current);
      var isoSet = {};
      for(var i=0;i<7;i++) isoSet[toISO(addDays(mon,i))] = true;
      idsInRange = state.shifts.filter(function(s){ return isoSet[s.date]; }).map(function(s){return s.id;});
    } else {
      var ym = state.current.getFullYear()+"-"+pad(state.current.getMonth()+1);
      idsInRange = state.shifts.filter(function(s){ return s.date.indexOf(ym)===0; }).map(function(s){return s.id;});
    }
    idsInRange = idsInRange.filter(function(id){
      var s = state.shifts.find(function(x){return x.id===id;});
      return s && state.activeCats.has(s.category) && (!state.presencialOnly || catInfo(s.category).presencial);
    });
    if(idsInRange.length === 0){ showToast("Nada para limpar aqui."); return; }
    if(!confirm("Remover "+idsInRange.length+" turno(s) visíveis neste período? Esta ação não pode ser desfeita.")) return;
    bulkDelete(idsInRange);
  }

  // ---- people management (admin only) ----
  function openPeopleManager(){
    renderPeopleManager();
  }
  function renderPeopleManager(){
    var list = state.people.slice().sort(function(a,b){ return a.name.localeCompare(b.name); });
    modalRoot.innerHTML =
      '<div class="overlay" id="ovPeople">'+
        '<div class="modal wide">'+
          '<button class="modal-close" id="closePeople"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
          '<h2>Gerenciar pessoas</h2>'+
          '<p class="sub">Nomes disponíveis para seleção ao lançar um turno.</p>'+
          '<div class="add-person-row">'+
            '<input type="text" id="npName" placeholder="Nome da pessoa">'+
            '<select id="npGroup"><option value="geral">Geral</option><option value="implantacao">Implantação</option></select>'+
            '<button class="btn btn-primary" id="npAdd">Adicionar</button>'+
          '</div>'+
          '<div class="manage-list" id="peopleList">'+
            list.map(personCardHTML).join("")+
          '</div>'+
        '</div>'+
      '</div>';
    document.getElementById("closePeople").addEventListener("click", closeModal);
    document.getElementById("ovPeople").addEventListener("mousedown", function(e){ if(e.target.id==="ovPeople") closeModal(); });
    document.getElementById("npAdd").addEventListener("click", function(){
      var name = document.getElementById("npName").value.trim();
      var grp = document.getElementById("npGroup").value;
      if(!name){ showToast("Informe um nome."); return; }
      addPerson(name, grp);
    });
    wirePeopleListEvents();
  }
  function personCardHTML(p){
    return '<div class="manage-card" data-pid="'+p.id+'">'+
      '<div class="top-row">'+
        '<input type="text" class="p-name" value="'+escapeHtml(p.name)+'" style="font-weight:700;font-size:13.5px;border:none;background:transparent;color:var(--text);width:60%;padding:2px 0;">'+
        '<button class="icon-btn-sm p-del" title="Remover"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>'+
      '</div>'+
      '<div class="toggle-row">'+
        '<select class="p-group" style="width:auto;font-size:12px;padding:5px 8px;border-radius:7px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);">'+
          '<option value="geral" '+(p.group==="geral"?"selected":"")+'>Geral</option>'+
          '<option value="implantacao" '+(p.group==="implantacao"?"selected":"")+'>Implantação</option>'+
        '</select>'+
        '<label class="toggle"><input type="checkbox" class="p-active" '+(p.active!==false?"checked":"")+'><span class="track"></span>'+(p.active!==false?"Ativo":"Inativo")+'</label>'+
      '</div>'+
    '</div>';
  }
  function wirePeopleListEvents(){
    var listEl = document.getElementById("peopleList");
    if(!listEl) return;
    listEl.addEventListener("change", function(e){
      var card = e.target.closest(".manage-card");
      if(!card) return;
      var id = card.dataset.pid;
      if(e.target.classList.contains("p-group")){ updatePerson(id, {group:e.target.value}); }
      else if(e.target.classList.contains("p-active")){
        e.target.closest("label").lastChild.textContent = e.target.checked ? "Ativo" : "Inativo";
        updatePerson(id, {active:e.target.checked});
      }
    });
    listEl.addEventListener("blur", function(e){
      if(!e.target.classList.contains("p-name")) return;
      var card = e.target.closest(".manage-card");
      var val = e.target.value.trim();
      if(val) updatePerson(card.dataset.pid, {name:val});
    }, true);
    listEl.addEventListener("click", function(e){
      var btn = e.target.closest(".p-del");
      if(!btn) return;
      var card = btn.closest(".manage-card");
      if(confirm("Remover esta pessoa da lista? Turnos já lançados com este nome não serão afetados.")) deletePerson(card.dataset.pid);
    });
  }
  function addPerson(name, group){
    api("POST", "/api/people", {name:name, group:group}).then(function(data){
      state.people.push(data.person);
      renderPeopleManager();
      showToast("Pessoa adicionada");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível adicionar."); } });
  }
  function updatePerson(id, data){
    api("PATCH", "/api/people/"+encodeURIComponent(id), data).then(function(res){
      var idx = state.people.findIndex(function(p){return p.id===id;});
      if(idx>-1) state.people[idx] = res.person;
      renderCalendar();
      if(document.getElementById("peopleList")) renderPeopleManager();
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível salvar a alteração."); } });
  }
  function deletePerson(id){
    api("DELETE", "/api/people/"+encodeURIComponent(id)).then(function(){
      state.people = state.people.filter(function(p){return p.id!==id;});
      renderPeopleManager();
      showToast("Pessoa removida");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível remover."); } });
  }

  // ---- categories management (admin only) ----
  function openCategoriesManager(){ renderCategoriesManager(); }
  function renderCategoriesManager(){
    var list = state.categories.slice().sort(function(a,b){ return (a.order-b.order) || a.label.localeCompare(b.label); });
    modalRoot.innerHTML =
      '<div class="overlay" id="ovCategories">'+
        '<div class="modal wide">'+
          '<button class="modal-close" id="closeCategories"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
          '<h2>Gerenciar categorias</h2>'+
          '<p class="sub">Tipos de turno disponíveis (Férias, Chat, 22h...). "Presencial" controla se a categoria entra no filtro do mesmo nome.</p>'+
          '<div class="add-person-row">'+
            '<input type="text" id="ncName" placeholder="Nome da categoria">'+
            '<input type="color" id="ncColor" value="#2563eb" title="Cor da categoria">'+
            '<label class="check-row-inline"><input type="checkbox" id="ncPresencial">Presencial</label>'+
            '<button class="btn btn-primary" id="ncAdd">Adicionar</button>'+
          '</div>'+
          '<div class="manage-list" id="categoriesList">'+list.map(categoryCardHTML).join("")+'</div>'+
        '</div>'+
      '</div>';
    document.getElementById("closeCategories").addEventListener("click", closeModal);
    document.getElementById("ovCategories").addEventListener("mousedown", function(e){ if(e.target.id==="ovCategories") closeModal(); });
    document.getElementById("ncAdd").addEventListener("click", function(){
      var name = document.getElementById("ncName").value.trim();
      var color = document.getElementById("ncColor").value;
      var presencial = document.getElementById("ncPresencial").checked;
      if(!name){ showToast("Informe um nome para a categoria."); return; }
      addCategory(name, color, presencial);
    });
    wireCategoriesListEvents();
  }
  function categoryCardHTML(c){
    return '<div class="manage-card" data-key="'+escapeHtml(c.key)+'">'+
      '<div class="top-row">'+
        '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">'+
          '<input type="color" class="c-color" value="'+escapeHtml(c.color)+'" title="Cor">'+
          '<input type="text" class="c-name" value="'+escapeHtml(c.label)+'" style="font-weight:700;font-size:13.5px;border:none;background:transparent;color:var(--text);flex:1;min-width:0;padding:2px 0;">'+
        '</div>'+
        '<button class="icon-btn-sm c-del" title="Remover"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>'+
      '</div>'+
      '<div class="toggle-row">'+
        '<label class="toggle"><input type="checkbox" class="c-presencial" '+(c.presencial?"checked":"")+'><span class="track"></span>'+(c.presencial?"Presencial":"Não presencial")+'</label>'+
        '<label class="toggle"><input type="checkbox" class="c-active" '+(c.active!==false?"checked":"")+'><span class="track"></span>'+(c.active!==false?"Ativa":"Inativa")+'</label>'+
      '</div>'+
    '</div>';
  }
  function wireCategoriesListEvents(){
    var listEl = document.getElementById("categoriesList");
    if(!listEl) return;
    listEl.addEventListener("change", function(e){
      var card = e.target.closest(".manage-card");
      if(!card) return;
      var key = card.dataset.key;
      if(e.target.classList.contains("c-color")){ updateCategory(key, {color:e.target.value}); }
      else if(e.target.classList.contains("c-presencial")){
        e.target.closest("label").lastChild.textContent = e.target.checked ? "Presencial" : "Não presencial";
        updateCategory(key, {presencial:e.target.checked});
      } else if(e.target.classList.contains("c-active")){
        e.target.closest("label").lastChild.textContent = e.target.checked ? "Ativa" : "Inativa";
        updateCategory(key, {active:e.target.checked});
      }
    });
    listEl.addEventListener("blur", function(e){
      if(!e.target.classList.contains("c-name")) return;
      var card = e.target.closest(".manage-card");
      var val = e.target.value.trim();
      if(val) updateCategory(card.dataset.key, {label:val});
    }, true);
    listEl.addEventListener("click", function(e){
      var btn = e.target.closest(".c-del");
      if(!btn) return;
      var card = btn.closest(".manage-card");
      if(confirm("Remover esta categoria? Só é possível se nenhum turno estiver usando ela.")) deleteCategory(card.dataset.key);
    });
  }
  function addCategory(label, color, presencial){
    api("POST", "/api/categories", {label:label, color:color, presencial:presencial}).then(function(data){
      state.categories.push(data.category);
      seenCatKeys[data.category.key] = true;
      state.activeCats.add(data.category.key);
      renderCategoriesManager();
      renderCalendar();
      showToast("Categoria adicionada");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível adicionar."); } });
  }
  function updateCategory(key, data){
    api("PATCH", "/api/categories/"+encodeURIComponent(key), data).then(function(res){
      var idx = state.categories.findIndex(function(c){return c.key===key;});
      if(idx>-1) state.categories[idx] = res.category;
      renderCalendar();
      if(document.getElementById("categoriesList")) renderCategoriesManager();
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível salvar a alteração."); } });
  }
  function deleteCategory(key){
    api("DELETE", "/api/categories/"+encodeURIComponent(key)).then(function(){
      state.categories = state.categories.filter(function(c){return c.key!==key;});
      state.activeCats.delete(key);
      renderCategoriesManager();
      renderCalendar();
      showToast("Categoria removida");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível remover."); } });
  }

  // ---- users management (admin only) ----
  var usersFilter = "active";
  function openUsersManager(){ loadUsers().then(renderUsersManager); }
  function renderUsersManager(){
    var list = state.users.slice().sort(function(a,b){ return (a.displayName||"").localeCompare(b.displayName||""); });
    if(usersFilter==="active") list = list.filter(function(u){ return u.active!==false; });
    else if(usersFilter==="inactive") list = list.filter(function(u){ return u.active===false; });
    modalRoot.innerHTML =
      '<div class="overlay" id="ovUsers">'+
        '<div class="modal wide">'+
          '<button class="modal-close" id="closeUsers"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
          '<h2>Gerenciar usuários</h2>'+
          '<p class="sub">Controle quem acessa a escala, seu papel e se pode editar.</p>'+
          '<div class="mng-tabs">'+
            '<div class="segmented">'+
              '<button data-uf="active" class="'+(usersFilter==="active"?"on":"")+'">Ativos</button>'+
              '<button data-uf="inactive" class="'+(usersFilter==="inactive"?"on":"")+'">Inativos</button>'+
              '<button data-uf="all" class="'+(usersFilter==="all"?"on":"")+'">Todos</button>'+
            '</div>'+
          '</div>'+
          '<div class="bulk-row">'+
            '<button class="btn" id="lockAll">Bloquear todos não-admin</button>'+
            '<button class="btn" id="unlockAll">Desbloquear todos não-admin</button>'+
          '</div>'+
          '<div class="add-person-row">'+
            '<input type="text" id="nuName" placeholder="Nome" style="flex:1;">'+
            '<input type="email" id="nuEmail" placeholder="email@empresa.com" style="flex:1.4;">'+
            '<select id="nuRole"><option value="usuario">Usuário</option><option value="implantacao">Implantação</option><option value="admin">Admin</option></select>'+
            '<button class="btn btn-primary" id="nuAdd">Adicionar</button>'+
          '</div>'+
          '<div class="manage-list" id="usersList">'+list.map(userCardHTML).join("")+'</div>'+
        '</div>'+
      '</div>';
    document.getElementById("closeUsers").addEventListener("click", closeModal);
    document.getElementById("ovUsers").addEventListener("mousedown", function(e){ if(e.target.id==="ovUsers") closeModal(); });
    document.querySelectorAll("[data-uf]").forEach(function(b){
      b.addEventListener("click", function(){ usersFilter = b.dataset.uf; renderUsersManager(); });
    });
    document.getElementById("lockAll").addEventListener("click", function(){ bulkSetViewOnly(true); });
    document.getElementById("unlockAll").addEventListener("click", function(){ bulkSetViewOnly(false); });
    document.getElementById("nuAdd").addEventListener("click", function(){
      var name = document.getElementById("nuName").value.trim();
      var email = document.getElementById("nuEmail").value.trim().toLowerCase();
      var role = document.getElementById("nuRole").value;
      if(!email || email.indexOf("@")<0){ showToast("Informe um e-mail válido."); return; }
      if(state.users.some(function(u){return u.email===email;})){ showToast("Este e-mail já está cadastrado."); return; }
      addUser(email, name||email.split("@")[0], role);
    });
    wireUsersListEvents();
  }
  function userCardHTML(u){
    var isU_admin = u.role === "admin";
    return '<div class="manage-card" data-email="'+escapeHtml(u.email)+'">'+
      '<div class="top-row">'+
        '<span class="badge role-'+u.role+'">'+ROLE_LABEL[u.role]+'</span>'+
        '<button class="icon-btn-sm u-del" title="Remover"'+(isU_admin?' style="visibility:hidden"':'')+'><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>'+
      '</div>'+
      '<input type="text" class="u-name" value="'+escapeHtml(u.displayName||"")+'" style="font-weight:700;font-size:13.5px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);width:100%;padding:7px 9px;border-radius:8px;margin-bottom:6px;">'+
      '<div class="email">'+escapeHtml(u.email)+'</div>'+
      '<div class="toggle-row">'+
        '<label class="toggle"><input type="checkbox" class="u-active" '+(u.active!==false?"checked":"")+'><span class="track"></span>'+(u.active!==false?"Ativo":"Inativo")+'</label>'+
        (isU_admin ? '' : '<label class="toggle"><input type="checkbox" class="u-viewonly" '+(u.viewOnly?"checked":"")+'><span class="track"></span>'+(u.viewOnly?"Somente visualização":"Pode editar")+'</label>')+
      '</div>'+
      '<div style="margin-top:10px;display:flex;align-items:center;gap:8px;">'+
        '<span style="font-size:11px;color:var(--muted-2);">'+(u.hasPassword?"Senha definida":"Ainda sem senha (1º acesso pendente)")+'</span>'+
        (u.hasPassword ? '<button class="btn u-resetpw" style="padding:4px 10px;font-size:11px;">Redefinir senha</button>' : '')+
      '</div>'+
    '</div>';
  }
  function wireUsersListEvents(){
    var listEl = document.getElementById("usersList");
    if(!listEl) return;
    listEl.addEventListener("change", function(e){
      var card = e.target.closest(".manage-card");
      if(!card) return;
      var email = card.dataset.email;
      if(e.target.classList.contains("u-active")){
        e.target.closest("label").lastChild.textContent = e.target.checked ? "Ativo" : "Inativo";
        updateUser(email, {active:e.target.checked});
      } else if(e.target.classList.contains("u-viewonly")){
        e.target.closest("label").lastChild.textContent = e.target.checked ? "Somente visualização" : "Pode editar";
        updateUser(email, {viewOnly:e.target.checked});
      }
    });
    listEl.addEventListener("blur", function(e){
      if(!e.target.classList.contains("u-name")) return;
      var card = e.target.closest(".manage-card");
      var val = e.target.value.trim();
      if(val) updateUser(card.dataset.email, {displayName:val});
    }, true);
    listEl.addEventListener("click", function(e){
      var delBtn = e.target.closest(".u-del");
      if(delBtn){
        var card1 = delBtn.closest(".manage-card");
        if(confirm("Remover o acesso deste usuário?")) deleteUser(card1.dataset.email);
        return;
      }
      var pwBtn = e.target.closest(".u-resetpw");
      if(pwBtn){
        var card2 = pwBtn.closest(".manage-card");
        if(confirm("Redefinir a senha deste usuário? No próximo acesso ele criará uma nova senha.")) resetPassword(card2.dataset.email);
      }
    });
  }
  function resetPassword(email){
    api("PATCH", "/api/users/"+encodeURIComponent(email), {resetPassword:true}).then(function(res){
      var idx = state.users.findIndex(function(u){return u.email===email;});
      if(idx>-1) state.users[idx] = res.user;
      renderUsersManager();
      showToast("Senha redefinida. O usuário criará uma nova no próximo acesso.");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível redefinir."); } });
  }
  function addUser(email, displayName, role){
    api("POST", "/api/users", {email:email, displayName:displayName, role:role}).then(function(data){
      state.users.push(data.user);
      renderUsersManager();
      showToast("Usuário adicionado");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível adicionar."); } });
  }
  function updateUser(email, data){
    api("PATCH", "/api/users/"+encodeURIComponent(email), data).then(function(res){
      var idx = state.users.findIndex(function(u){return u.email===email;});
      if(idx>-1) state.users[idx] = res.user;
      if(currentUser && currentUser.email===email){
        currentUser = Object.assign({}, currentUser, {
          displayName: res.user.displayName, role: res.user.role, active: res.user.active, viewOnly: res.user.viewOnly
        });
        syncAvatarUI(); syncRailVisibility(); renderCalendar();
      }
      if(document.getElementById("usersList")) renderUsersManager();
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível salvar a alteração."); } });
  }
  function deleteUser(email){
    api("DELETE", "/api/users/"+encodeURIComponent(email)).then(function(){
      state.users = state.users.filter(function(u){return u.email!==email;});
      renderUsersManager();
      showToast("Usuário removido");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível remover."); } });
  }
  function bulkSetViewOnly(flag){
    api("POST", "/api/users/bulk-viewonly", {viewOnly:flag}).then(function(data){
      loadUsers();
      if(currentUser && currentUser.role!=="admin"){ currentUser.viewOnly = flag; renderCalendar(); }
      showToast((flag?"Bloqueados":"Desbloqueados")+" "+data.count+" usuário(s)");
    }).catch(function(e){ if(e.message !== "unauthorized"){ console.error(e); showToast(e.message || "Não foi possível atualizar."); } });
  }

  // ---- identity gate (typed e-mail + password, persisted server-side session) ----
  function showLoginStep1(prefillEmail, errorMsg){
    modalRoot.innerHTML =
      '<div class="overlay" id="ovId">'+
        '<div class="modal" style="max-width:400px">'+
          '<h2>Quem é você?</h2>'+
          '<p class="sub">Informe seu e-mail cadastrado para acessar a escala com as permissões corretas.</p>'+
          '<div class="field"><label for="idEmail">E-mail</label><input type="email" id="idEmail" placeholder="voce@empresa.com" value="'+escapeHtml(prefillEmail||"")+'"></div>'+
          (errorMsg ? '<p class="sub" style="color:var(--cat-plantao);margin-top:-8px;">'+escapeHtml(errorMsg)+'</p>' : '')+
          '<div class="modal-actions"><span></span><div class="right"><button class="btn btn-primary" id="idContinue">Continuar</button></div></div>'+
        '</div>'+
      '</div>';
    var emailInput = document.getElementById("idEmail");
    function go(){
      var email = emailInput.value.trim().toLowerCase();
      if(!email){ showToast("Informe seu e-mail."); return; }
      api("POST", "/api/auth/check-email", {email:email}, {suppressAuthRedirect:true})
        .then(function(data){ showLoginStep2(data); })
        .catch(function(e){ showLoginStep1(email, e.message); });
    }
    document.getElementById("idContinue").addEventListener("click", go);
    emailInput.addEventListener("keydown", function(e){ if(e.key==="Enter") go(); });
    setTimeout(function(){ emailInput.focus(); }, 30);
  }
  function showLoginStep2(u, errorMsg){
    var firstAccess = !!u.firstAccess;
    modalRoot.innerHTML =
      '<div class="overlay" id="ovId">'+
        '<div class="modal" style="max-width:400px">'+
          '<h2>'+(firstAccess ? "Criar sua senha" : "Digite sua senha")+'</h2>'+
          '<p class="sub">'+escapeHtml(u.displayName||u.email)+' · '+escapeHtml(u.email)+
            (firstAccess ? '<br>Primeiro acesso — crie uma senha para esta conta. Você continuará logado neste navegador até clicar em "Sair".' : '')+
          '</p>'+
          (errorMsg ? '<p class="sub" style="color:var(--cat-plantao);margin-top:-8px;">'+escapeHtml(errorMsg)+'</p>' : '')+
          (firstAccess
            ? '<div class="field"><label for="idPw1">Nova senha</label><input type="password" id="idPw1" placeholder="Mínimo 4 caracteres"></div>'+
              '<div class="field"><label for="idPw2">Confirme a senha</label><input type="password" id="idPw2"></div>'
            : '<div class="field"><label for="idPw1">Senha</label><input type="password" id="idPw1"></div>')+
          '<div class="modal-actions"><button class="btn" id="idBack">Voltar</button><div class="right"><button class="btn btn-primary" id="idGo">'+(firstAccess?"Criar senha e entrar":"Entrar")+'</button></div></div>'+
        '</div>'+
      '</div>';
    document.getElementById("idBack").addEventListener("click", function(){ showLoginStep1(u.email); });
    var pw1 = document.getElementById("idPw1");
    function go(){
      var p1 = pw1.value;
      if(firstAccess){
        var p2 = document.getElementById("idPw2").value;
        if(p1.length<4){ showLoginStep2(u, "A senha precisa ter ao menos 4 caracteres."); return; }
        if(p1!==p2){ showLoginStep2(u, "As senhas não coincidem."); return; }
        api("POST", "/api/auth/signup", {email:u.email, password:p1}, {suppressAuthRedirect:true})
          .then(function(data){
            setCurrentUser(data.user);
            modalRoot.innerHTML = "";
            afterLogin();
            showToast("Senha criada. Você ficará logado neste navegador.");
          })
          .catch(function(e){ showLoginStep2(u, e.message); });
      } else {
        if(!p1){ showToast("Digite sua senha."); return; }
        api("POST", "/api/auth/login", {email:u.email, password:p1}, {suppressAuthRedirect:true})
          .then(function(data){
            setCurrentUser(data.user);
            modalRoot.innerHTML = "";
            afterLogin();
          })
          .catch(function(e){ showLoginStep2(u, e.message); });
      }
    }
    document.getElementById("idGo").addEventListener("click", go);
    pw1.addEventListener("keydown", function(e){ if(e.key==="Enter" && !firstAccess) go(); });
    setTimeout(function(){ pw1.focus(); }, 30);
  }
  function setCurrentUser(u){ currentUser = u; }
  function tryAutoLogin(){
    api("GET", "/api/auth/me", undefined, {suppressAuthRedirect:true}).then(function(data){
      if(data.user){ setCurrentUser(data.user); afterLogin(); }
      else { showLoginStep1(); }
    }).catch(function(){ showLoginStep1(); });
  }
  function afterLogin(){
    syncAvatarUI();
    syncRailVisibility();
    Promise.all([loadCategories(), loadPeople(), loadShifts()]).then(function(){
      if(isAdmin()) loadUsers();
    });
    renderCalendar();
    startPolling();
  }
  function syncAvatarUI(){
    var initials = currentUser ? (currentUser.displayName||currentUser.email||"?").trim().charAt(0).toUpperCase() : "?";
    document.getElementById("userDot").textContent = initials;
    document.getElementById("userDotName").textContent = currentUser ? (currentUser.displayName||currentUser.email) : "—";
    document.getElementById("avatarDot").textContent = initials;
    document.getElementById("avatarName").textContent = currentUser ? (currentUser.displayName||currentUser.email) : "Entrar";
    document.getElementById("avatarEmail").textContent = currentUser ? currentUser.email : "";
  }
  function syncRailVisibility(){
    document.getElementById("railPeople").hidden = !isAdmin();
    document.getElementById("railUsers").hidden = !isAdmin();
    document.getElementById("railCategories").hidden = !isAdmin();
  }
  function logout(){
    if(!confirm("Sair da sua conta nesta escala?")) return;
    api("POST", "/api/auth/logout", undefined, {suppressAuthRedirect:true}).finally(function(){
      stopPolling();
      currentUser = null;
      state.shifts = []; state.people = []; state.users = []; state.categories = []; state.activeCats = new Set(); seenCatKeys = {};
      syncAvatarUI(); syncRailVisibility(); renderCalendar();
      showLoginStep1();
    });
  }

  // ---- background refresh (no websockets - simple polling keeps everyone
  // reasonably in sync with what teammates are doing) ----
  var pollHandle = null;
  function startPolling(){
    stopPolling();
    pollHandle = setInterval(function(){
      if(!currentUser) return;
      loadShifts();
      loadPeople();
      loadCategories();
      if(isAdmin() && document.getElementById("usersList")) loadUsers();
    }, 20000);
  }
  function stopPolling(){ if(pollHandle){ clearInterval(pollHandle); pollHandle = null; } }

  // ---- theme ----
  function effectiveTheme(){
    var stored = document.documentElement.getAttribute("data-theme");
    if(stored) return stored;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function renderThemeIcon(){
    var isDark = effectiveTheme() === "dark";
    var svg = isDark
      ? '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>'
      : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
    document.getElementById("railTheme").innerHTML = '<svg viewBox="0 0 24 24">'+svg+'</svg>';
  }
  function toggleTheme(){
    var next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try{ localStorage.setItem("escala-theme", next); }catch(e){}
    renderThemeIcon();
  }
  (function initTheme(){
    var stored = null;
    try{ stored = localStorage.getItem("escala-theme"); }catch(e){}
    if(stored) document.documentElement.setAttribute("data-theme", stored);
  })();

  // ---- events ----
  elRoot.addEventListener("click", function(e){
    var chip = e.target.closest(".chip");
    if(chip){
      var s = state.shifts.find(function(x){ return x.id === chip.dataset.id; });
      if(s) openModal({shift:s, readOnly:!canManageShift(s)});
      return;
    }
    var addBtn = e.target.closest("[data-add]");
    if(addBtn){ if(canCreate()) openModal({date: addBtn.dataset.add}); return; }
    var cell = e.target.closest(".month-cell");
    if(cell){ state.current = parseISO(cell.dataset.date); state.view = "dia"; renderCalendar(); return; }
  });

  elLegend.addEventListener("click", function(e){
    var b = e.target.closest("button[data-cat]");
    if(!b) return;
    var k = b.dataset.cat;
    if(state.activeCats.has(k)) state.activeCats.delete(k); else state.activeCats.add(k);
    renderCalendar();
  });

  elSeg.addEventListener("click", function(e){
    var vb = e.target.closest("button[data-view]");
    if(vb){ state.view = vb.dataset.view; renderCalendar(); return; }
    var fb = e.target.closest("button[data-filter]");
    if(fb){ state.presencialOnly = !state.presencialOnly; renderCalendar(); return; }
  });

  document.getElementById("btnNew").addEventListener("click", function(){ if(canCreate()) openModal({date: toISO(state.current)}); });
  document.getElementById("btnClear").addEventListener("click", clearVisible);
  document.getElementById("btnToday").addEventListener("click", function(){ state.current = new Date(TODAY); renderCalendar(); });
  document.getElementById("btnPrev").addEventListener("click", function(){ step(-1); });
  document.getElementById("btnNext").addEventListener("click", function(){ step(1); });
  function step(dir){
    if(state.view === "dia") state.current = addDays(state.current, dir);
    else if(state.view === "semana") state.current = addDays(state.current, dir*7);
    else state.current = new Date(state.current.getFullYear(), state.current.getMonth()+dir, 1);
    renderCalendar();
  }
  document.getElementById("railPeople").addEventListener("click", function(){ if(isAdmin()) openPeopleManager(); });
  document.getElementById("railUsers").addEventListener("click", function(){ if(isAdmin()) openUsersManager(); });
  document.getElementById("railCategories").addEventListener("click", function(){ if(isAdmin()) openCategoriesManager(); });
  document.getElementById("railTheme").addEventListener("click", toggleTheme);
  document.getElementById("avatarChip").addEventListener("click", function(){ if(currentUser) logout(); });
  document.getElementById("userDot").addEventListener("click", function(){ if(currentUser) logout(); });

  // ---- init ----
  renderThemeIcon();
  renderCalendar();
  tryAutoLogin();
})();
