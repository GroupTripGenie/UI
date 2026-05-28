// ============================================================
//  TripGenie — app.js  v2
//  Trip-centric data layer. Each trip has its own budget,
//  checklists and reminders. My Trips → click → Trip Hub page.
// ============================================================

const API = 'https://ui-production-e419.up.railway.app/api';

// ── Helpers ──────────────────────────────────────────────────
function getToken()    { return localStorage.getItem('tg_token'); }
function getUser()     { try { return JSON.parse(localStorage.getItem('tg_user')||'{}'); } catch { return {}; } }
function getCurrency() { return localStorage.getItem('tg_currency') || 'USD'; }

async function apiFetch(path, opts = {}) {
  const res  = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+getToken(), ...(opts.headers||{}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function fmtMoney(n) {
  const c = getCurrency();
  const sym = {USD:'$',PHP:'₱',EUR:'€',GBP:'£',JPY:'¥',AUD:'A$',SGD:'S$',KRW:'₩'}[c]||'$';
  return sym + Number(n||0).toLocaleString();
}

const DEST_IMAGES = {
  default:    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80',
  paris:      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80',
  tokyo:      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80',
  vietnam:    'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=400&q=80',
  bali:       'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80',
  barcelona:  'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&q=80',
  london:     'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&q=80',
  rome:       'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=80',
  newyork:    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80',
  dubai:      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&q=80',
  sydney:     'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400&q=80',
  singapore:  'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&q=80',
  manila:     'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&q=80',
  thailand:   'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=80',
  korea:      'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400&q=80',
  japan:      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80',
};

function getDestImage(destination) {
  if (!destination) return DEST_IMAGES.default;
  const key = destination.toLowerCase().split(',')[0].trim().replace(/\s+/g,'');
  for (const [k, v] of Object.entries(DEST_IMAGES)) {
    if (k !== 'default' && key.includes(k)) return v;
  }
  return DEST_IMAGES.default;
}

function loadingHTML(msg='Loading…') {
  return `<div style="text-align:center;padding:40px;color:#64748b">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#068cdf" stroke-width="2" style="animation:spin 0.8s linear infinite;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto">
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"/>
      <path d="M21 12a9 9 0 00-9-9" stroke-linecap="round"/>
    </svg><p>${msg}</p></div>`;
}

function emptyHTML(icon,title,sub,btnLabel,btnFn) {
  return `<div style="text-align:center;padding:48px 20px;color:#64748b">
    <div style="font-size:48px;margin-bottom:12px">${icon}</div>
    <h3 style="color:#063937;margin-bottom:6px">${title}</h3>
    <p style="font-size:14px;margin-bottom:20px">${sub}</p>
    ${btnLabel?`<button class="btn-primary" onclick="${btnFn}">${btnLabel}</button>`:''}
  </div>`;
}

// ============================================================
//  STATE
// ============================================================
let allTrips      = [];
let currentTripId = null;   // trip currently open in Hub page
let tripBudget    = null;
let tripChecklists= [];
let tripReminders = [];

// ============================================================
//  TRIPS — load & render
// ============================================================
async function loadTrips() {
  try {
    allTrips = await apiFetch('/trips');
    renderDashboardStats();
    renderDashboardTrips();
    renderMyTripsPage();
  } catch(e) { console.error('loadTrips:', e); }
}

function renderDashboardStats() {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('statTripsPlanned', allTrips.length);
  set('statCountries',    new Set(allTrips.map(t=>t.destination.split(',').pop().trim())).size);
  set('statCompleted',    allTrips.filter(t=>t.status==='completed').length);
  set('statUpcoming',     allTrips.filter(t=>t.status==='upcoming').length);
}

function renderDashboardTrips() {
  const grid = document.getElementById('dashTripsGrid');
  if (!grid) return;
  const upcoming = allTrips.filter(t=>t.status!=='completed').slice(0,4);
  grid.innerHTML = upcoming.length
    ? upcoming.map(t => smallTripCard(t)).join('')
    : emptyHTML('✈️','No trips yet','Plan your first adventure!','+ Plan a Trip',"navigate('plantrip')");
}

function smallTripCard(trip) {
  const img   = getDestImage(trip.destination);
  const dates = trip.start_date
    ? `📅 ${fmtDate(trip.start_date)}${trip.end_date?' – '+fmtDate(trip.end_date):''}`
    : '📅 Dates not set';
  const pct = trip.planning_pct || 0;
  return `
  <div class="trip-card" onclick="openTripHub('${trip.id}')" style="cursor:pointer">
    <div class="trip-img"><img src="${img}" alt="${trip.destination}" onerror="this.src='${DEST_IMAGES.default}'"/></div>
    <div class="trip-body">
      <h3>${trip.destination}</h3>
      <p class="trip-dates">${dates}</p>
      <div class="progress-row"><span>Planning</span><span>${pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <button class="btn-primary full-width" style="margin-top:12px" onclick="event.stopPropagation();openTripHub('${trip.id}')">Open Trip →</button>
    </div>
  </div>`;
}

function renderMyTripsPage() {
  const upEl = document.getElementById('upcomingTripsList');
  const paEl = document.getElementById('completedTripsList');
  const upcoming  = allTrips.filter(t=>t.status!=='completed');
  const completed = allTrips.filter(t=>t.status==='completed');
  if (upEl) upEl.innerHTML = upcoming.length
    ? upcoming.map(t=>smallTripCard(t)).join('')
    : emptyHTML('🗺️','No upcoming trips','Start planning your next adventure!','+ Plan a Trip',"navigate('plantrip')");
  if (paEl) paEl.innerHTML = completed.length
    ? completed.map(t=>smallTripCard(t)).join('')
    : '<p style="color:#64748b;font-size:14px;padding:20px 0">No completed trips yet.</p>';
}


// ── Trip Progress Calculator ──────────────────────────────────
async function calculateAndSaveProgress(tripId) {
  let score = 0;
  const trip = allTrips.find(t=>t.id===tripId);
  if (!trip) return;

  // +20 if dates are set
  if (trip.start_date && trip.end_date) score += 20;
  // +20 if notes/description added
  if (trip.notes && trip.notes.length > 5) score += 20;
  // +20 if itinerary exists
  if (localStorage.getItem('itinerary_'+tripId)) score += 20;
  // +20 if budget exists
  if (allBudgets[tripId] || tripBudget) score += 20;
  // +20 if has checklists with items
  const cls = allChecklistsByTrip[tripId]||[];
  if (cls.some(cl=>(cl.items||[]).length>0)) score += 20;

  score = Math.min(score, 100);

  // Save to backend
  try {
    await apiFetch('/trips/'+tripId, {method:'PATCH', body:JSON.stringify({planning_pct:score})});
    const idx = allTrips.findIndex(t=>t.id===tripId);
    if (idx>-1) allTrips[idx].planning_pct = score;
    // Update hub progress display
    const progEl = document.getElementById('hubProgress');
    if (progEl) progEl.textContent = score + '% planned';
  } catch {}
}

// ============================================================
//  TRIP HUB — the per-trip page
// ============================================================
async function openTripHub(tripId) {
  currentTripId = tripId;
  const trip = allTrips.find(t=>t.id===tripId);
  if (!trip) return;

  // Populate hub header
  document.getElementById('hubTripName').textContent  = trip.destination;
  document.getElementById('hubTripDates').textContent = trip.start_date
    ? `${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date||trip.start_date)}`
    : 'Dates not set';
  document.getElementById('hubTripImg').src  = getDestImage(trip.destination);
  document.getElementById('hubTripNotes').textContent = trip.notes || 'No notes yet.';
  document.getElementById('hubTripStatus').textContent = trip.status.charAt(0).toUpperCase()+trip.status.slice(1);

  // Show itinerary if saved
  const itinEl = document.getElementById('hubItinerary');
  if (itinEl) {
    const saved = localStorage.getItem('itinerary_'+tripId);
    if (saved) {
      // Check if it already has the edit button
      itinEl.innerHTML = saved.includes('openManualItinerary') ? saved :
        `<div style="text-align:right;margin-bottom:10px"><button class="btn-outline small-btn" onclick="openManualItinerary()" style="font-size:12px">✏️ Edit Itinerary</button></div>` + saved;
    } else {
      itinEl.innerHTML = '<p style="color:#64748b;font-size:14px">No itinerary yet. Click "✨ Generate with AI" or "✏️ Write My Own" above.</p>';
    }
  }

  // Show hub page
  navigate('tripHub');

  // Load trip data
  loadHubBudget();
  loadHubChecklists();
  loadHubReminders();

  // Calculate and update progress
  setTimeout(() => calculateAndSaveProgress(tripId), 1500);
}

// ── Hub Budget ────────────────────────────────────────────────
async function loadHubBudget() {
  const el = document.getElementById('hubBudgetContent');
  if (!el) return;
  el.innerHTML = loadingHTML('Loading budget…');
  try {
    tripBudget = await apiFetch('/budget/'+currentTripId);
    if (tripBudget) {
      // Also load all expenses so we can show them per category
      try {
        tripBudget.expenses = await apiFetch('/budget/'+currentTripId+'/expenses');
      } catch { tripBudget.expenses = []; }
    }
    renderHubBudget();
  } catch { tripBudget = null; renderHubBudget(); }
}

function renderHubBudget() {
  const el = document.getElementById('hubBudgetContent');
  if (!el) return;

  if (!tripBudget) {
    el.innerHTML = `
      <div style="text-align:center;padding:24px">
        <p style="color:#64748b;margin-bottom:16px">No budget set for this trip yet.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <select id="hubBudgetCurrency" style="padding:10px 8px;border:1.5px solid #e8ecf0;border-radius:8px;font-size:14px;width:80px;flex-shrink:0">
            <option>USD</option><option>PHP</option><option>EUR</option><option>GBP</option><option>JPY</option><option>SGD</option>
          </select>
          <input type="number" id="hubTotalBudget" placeholder="Total budget (e.g. 50000)" style="flex:1;padding:12px 14px;border:1.5px solid #e8ecf0;border-radius:8px;font-size:18px;font-weight:600;min-width:160px"/>
          <button class="btn-primary" onclick="createTripBudget()">Set Budget</button>
        </div>
      </div>`;
    return;
  }

  const cats  = tripBudget.categories || [];
  const total = parseFloat(tripBudget.total_amount||0);
  const spent = cats.reduce((s,c)=>s+parseFloat(c.spent||0),0);
  const rem   = total - spent;

  el.innerHTML = `
    <div class="stats-grid three-col" style="margin-bottom:20px">
      <div class="stat-card"><div><p class="stat-label">Total Budget</p><p class="stat-value">${fmtMoney(total)}</p></div></div>
      <div class="stat-card"><div><p class="stat-label">Spent</p><p class="stat-value" style="color:#f97316">${fmtMoney(spent)}</p></div></div>
      <div class="stat-card"><div><p class="stat-label">Remaining</p><p class="stat-value" style="color:#22c55e">${fmtMoney(rem)}</p></div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="font-size:16px">Categories</h3>
      <button class="btn-primary small-btn" onclick="openModal('modalAddCategory')">+ Add Category</button>
    </div>
    <div id="hubCategoryList">
      ${cats.length ? cats.map(cat => hubCategoryHTML(cat)).join('') : '<p style="color:#64748b;font-size:14px">No categories yet. Add one above!</p>'}
    </div>`;
}

function hubCategoryHTML(cat) {
  const pct   = cat.allocated>0 ? Math.min(Math.round(cat.spent/cat.allocated*100),100) : 0;
  const color = cat.color||'#068cdf';
  const catId = cat.category_id;
  // Get expenses for this category from cached data
  const catExpenses = (tripBudget?.expenses || []).filter(e => e.category_id === catId);
  return `
  <div class="budget-item" style="margin-bottom:12px;border:1px solid #e8ecf0;border-radius:10px;overflow:hidden">
    <div style="padding:14px">
      <div class="budget-item-header">
        <div class="budget-label"><span class="dot" style="background:${color}"></span><strong>${cat.name}</strong></div>
        <div class="budget-meta" style="gap:6px">
          <span>${fmtMoney(cat.spent)} / ${fmtMoney(cat.allocated)}</span>
          <button class="edit-btn" onclick="openAddExpenseForCat('${catId}','${cat.name}')">+ Expense</button>
        <button class="edit-btn" onclick="openEditCategoryModal('${catId}','${cat.name}',${cat.allocated},'${color}')" title="Edit">✏️</button>
        <button class="edit-btn" style="color:#ef4444" onclick="deleteHubCategory('${catId}')" title="Delete">🗑</button>
        </div>
      </div>
      <div class="budget-progress-row" style="margin-top:8px">
        <div class="progress-bar flex1"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="pct">${pct}%</span>
      </div>
    </div>
    ${catExpenses.length ? `
    <div style="border-top:1px solid #f1f5f9">
      ${catExpenses.map(e=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid #f8fafc;font-size:13px">
          <div>
            <span>${e.description}</span>
            <span style="color:#94a3b8;font-size:11px;margin-left:8px">${fmtDate(e.spent_on)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <strong>${fmtMoney(e.amount)}</strong>
            <button onclick="openEditExpenseModal('${e.id}','${e.description}',${e.amount},'${catId}')" style="background:none;border:none;color:#068cdf;cursor:pointer;font-size:13px;padding:2px 4px" title="Edit">✏️</button>
            <button onclick="deleteExpense('${e.id}','${catId}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px" title="Delete">🗑</button>
          </div>
        </div>`).join('')}
    </div>` : ''}
  </div>`;
}

async function createTripBudget() {
  const amount   = document.getElementById('hubTotalBudget')?.value;
  const currency = document.getElementById('hubBudgetCurrency')?.value || 'USD';
  if (!amount) { showToast('Please enter a budget amount'); return; }
  try {
    tripBudget = await apiFetch('/budget/'+currentTripId, {
      method:'POST', body:JSON.stringify({total_amount:parseFloat(amount), currency})
    });
    renderHubBudget();
    showToast('Budget set!');
  } catch(e) { showToast('Error: '+e.message); }
}

function openAddExpenseForCat(catId, catName) {
  document.getElementById('newExpDesc').value   = '';
  document.getElementById('newExpAmount').value = '';
  document.getElementById('newExpDate').value   = new Date().toISOString().split('T')[0];
  document.getElementById('newExpCat').value    = catName;
  window._expenseCatId = catId;
  openModal('modalAddExpense');
}
async function deleteExpense(expenseId, catId) {
  if (!confirm('Delete this expense?')) return;
  try {
    await apiFetch('/budget/'+currentTripId+'/expenses/'+expenseId, {method:'DELETE'});
    // Update local state immediately — remove from tripBudget.expenses
    if (tripBudget) {
      if (tripBudget.expenses) {
        tripBudget.expenses = tripBudget.expenses.filter(e=>e.id!==expenseId);
      }
      // Update category spent amount
      const cat = tripBudget.categories?.find(c=>c.category_id===catId);
      if (cat) {
        const removed = tripBudget.expenses ? 0 : 0; // will be recalculated from fresh fetch
      }
    }
    // Refresh from server to get accurate totals
    tripBudget = await apiFetch('/budget/'+currentTripId);
    if (tripBudget) {
      // Load expenses too
      try {
        tripBudget.expenses = await apiFetch('/budget/'+currentTripId+'/expenses');
      } catch {}
    }
    if (allBudgets[currentTripId]) allBudgets[currentTripId]=tripBudget;
    renderHubBudget();
    if (document.getElementById('page-budget')?.classList.contains('active')) {
      renderBudgetPage(document.getElementById('budgetTripFilter')?.value||'all');
    }
    showToast('Expense deleted');
  } catch(e) { showToast('Error: '+e.message); }
}

async function saveCategory() {
  const name   = document.getElementById('newCatName').value.trim();
  const amount = parseFloat(document.getElementById('newCatAmount').value)||0;
  const color  = document.querySelector('.color-swatch.selected')?.dataset.color||'#068cdf';
  if (!name)   { showToast('Please enter a category name'); return; }
  if (!amount) { showToast('Please enter a budget amount for this category'); return; }
  try {
    // Create budget first if it doesn't exist — use allocated amount as initial total
    if (!tripBudget) {
      tripBudget = await apiFetch('/budget/'+currentTripId, {
        method:'POST', body:JSON.stringify({total_amount:amount, currency:getCurrency()})
      });
    } else {
      // Update total_amount to include new category allocation
      const newTotal = parseFloat(tripBudget.total_amount||0) + amount;
      await apiFetch('/budget/'+currentTripId, {
        method:'POST', body:JSON.stringify({total_amount:newTotal, currency:getCurrency()})
      });
      tripBudget.total_amount = newTotal;
    }
    await apiFetch('/budget/'+currentTripId+'/categories', {
      method:'POST', body:JSON.stringify({name, allocated:amount, color})
    });
    closeModal('modalAddCategory');
    document.getElementById('newCatName').value='';
    document.getElementById('newCatAmount').value='';
    showToast('Category "'+name+'" added!');
    await loadHubBudget();
  } catch(e) { showToast('Error: '+e.message); }
}

async function saveExpense() {
  const desc   = document.getElementById('newExpDesc').value.trim();
  const amount = parseFloat(document.getElementById('newExpAmount').value);
  const date   = document.getElementById('newExpDate').value;
  const catId  = window._expenseCatId;
  if (!desc||!amount) { showToast('Please fill in description and amount'); return; }
  if (!catId)         { showToast('Please open this from a category'); return; }
  try {
    await apiFetch('/budget/'+currentTripId+'/expenses', {
      method:'POST',
      body:JSON.stringify({category_id:catId, description:desc, amount, spent_on:date||new Date().toISOString().split('T')[0]})
    });
    closeModal('modalAddExpense');
    document.getElementById('newExpDesc').value='';
    document.getElementById('newExpAmount').value='';
    showToast('Expense added!');
    await loadHubBudget();
  } catch(e) { showToast('Error: '+e.message); }
}

// ── Hub Checklists ────────────────────────────────────────────
async function loadHubChecklists() {
  const el = document.getElementById('hubChecklistContent');
  if (!el) return;
  el.innerHTML = loadingHTML('Loading checklists…');
  try {
    tripChecklists = await apiFetch('/checklists?tripId='+currentTripId);
    renderHubChecklists();
  } catch { tripChecklists = []; renderHubChecklists(); }
}

function renderHubChecklists() {
  const el = document.getElementById('hubChecklistContent');
  if (!el) return;
  const btn = `<div style="text-align:right;margin-bottom:12px"><button class="btn-primary small-btn" onclick="openModal('modalNewChecklist')">+ New Checklist</button></div>`;
  if (!tripChecklists.length) {
    el.innerHTML = btn + emptyHTML('📋','No checklists yet','Add a checklist to stay organized!','','');
    return;
  }
  el.innerHTML = btn + tripChecklists.map(cl => {
    const items = cl.items||[];
    const done  = items.filter(i=>i.is_checked).length;
    const total = items.length;
    const pct   = total ? Math.round(done/total*100) : 0;
    return `
    <div style="border:1px solid #e8ecf0;border-radius:10px;margin-bottom:12px;overflow:hidden">
      <div style="background:#f8fafc;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">${cl.icon||'📋'}</span>
          <div><strong style="font-size:15px">${cl.title}</strong><p style="font-size:12px;color:#64748b;margin:0">${done} of ${total} completed</p></div>
        </div>
        <button class="btn-primary small-btn" onclick="openAddItem('${cl.id}')">+ Item</button>
        <button class="btn-outline small-btn" onclick="openEditChecklistModal('${cl.id}','${cl.title}','${cl.icon||'📋'}')" title="Edit">✏️</button>
      </div>
      <div style="padding:4px 0;background:#fff">
        <div class="progress-bar" style="margin:0;border-radius:0;height:3px"><div class="progress-fill" style="width:${pct}%"></div></div>
        ${items.map(item=>`
          <div style="display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid #f8fafc;gap:8px">
            <input type="checkbox" ${item.is_checked?'checked':''} onchange="toggleItem('${item.id}',this.checked,'${cl.id}')" style="accent-color:#068cdf;flex-shrink:0">
            <span style="flex:1;${item.is_checked?'text-decoration:line-through;color:#94a3b8':''}">${item.label}</span>
            <button onclick="openEditItemModal('${item.id}','${item.label}','${cl.id}')" style="background:none;border:none;color:#068cdf;cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0" title="Edit">✏️</button>
            <button onclick="deleteChecklistItem('${item.id}','${cl.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0" title="Delete">🗑</button>
          </div>`).join('')}
        ${!items.length?'<p style="text-align:center;color:#94a3b8;font-size:13px;padding:12px">No items yet</p>':''}
      </div>
    </div>`;
  }).join('');
}

async function saveChecklist() {
  const title = document.getElementById('newChecklistTitle').value.trim();
  const icon  = document.getElementById('newChecklistIcon').value||'📋';
  if (!title) { showToast('Please enter a title'); return; }
  try {
    const cl = await apiFetch('/checklists', {
      method:'POST', body:JSON.stringify({trip_id:currentTripId, title, icon})
    });
    cl.items = [];
    tripChecklists.unshift(cl);
    renderHubChecklists();
    closeModal('modalNewChecklist');
    document.getElementById('newChecklistTitle').value='';
    showToast('Checklist created!');
  } catch(e) { showToast('Error: '+e.message); }
}

function openAddItem(clId) {
  document.getElementById('newItemLabel').value  = '';
  document.getElementById('newItemTarget').value = clId;
  openModal('modalAddItem');
}

async function saveItem() {
  const label = document.getElementById('newItemLabel').value.trim();
  const clId  = document.getElementById('newItemTarget').value;
  if (!label) { showToast('Please enter an item'); return; }
  try {
    const item = await apiFetch('/checklists/'+clId+'/items', {
      method:'POST', body:JSON.stringify({label})
    });
    const cl = tripChecklists.find(c=>c.id===clId);
    if (cl) { cl.items=cl.items||[]; cl.items.push(item); }
    renderHubChecklists();
    closeModal('modalAddItem');
    document.getElementById('newItemLabel').value='';
    showToast('Item added!');
  } catch(e) { showToast('Error: '+e.message); }
}

async function toggleItem(itemId, checked, clId) {
  try {
    await apiFetch('/checklists/items/'+itemId, {method:'PATCH', body:JSON.stringify({is_checked:checked})});
    const cl = tripChecklists.find(c=>c.id===clId);
    if (cl) { const it=cl.items.find(i=>i.id===itemId); if(it) it.is_checked=checked; }
    renderHubChecklists();
  } catch(e) { console.error('toggleItem:',e); }
}

// ── Hub Reminders ─────────────────────────────────────────────
async function loadHubReminders() {
  const el = document.getElementById('hubReminderContent');
  if (!el) return;
  el.innerHTML = loadingHTML('Loading reminders…');
  try {
    tripReminders = await apiFetch('/reminders?tripId='+currentTripId+'&done=false');
    renderHubReminders();
  } catch { tripReminders = []; renderHubReminders(); }
}

function renderHubReminders() {
  const el = document.getElementById('hubReminderContent');
  if (!el) return;
  const btn = `<div style="text-align:right;margin-bottom:12px"><button class="btn-primary small-btn" onclick="openModal('modalAddReminder')">+ Add Reminder</button></div>`;
  if (!tripReminders.length) {
    el.innerHTML = btn + emptyHTML('🔔',"No reminders yet",'Add reminders for this trip!','','');
    return;
  }
  el.innerHTML = btn + tripReminders.map(r => {
    const badgeClass = {low:'badge-low',medium:'badge-medium',high:'badge-high'}[r.priority]||'badge-medium';
    const dt   = r.remind_at ? new Date(r.remind_at) : null;
    const dStr = dt ? fmtDate(dt) : '';
    const tStr = dt ? dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '';
    return `
    <div class="reminder-item" data-rem-id="${r.id}" style="border:1px solid #e8ecf0;border-radius:10px;padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <strong>${r.title}</strong>
          <span class="badge ${badgeClass}">${r.priority}</span>
        </div>
        ${r.description?`<p style="font-size:13px;color:#64748b;margin:0 0 4px">${r.description}</p>`:''}
        <div style="font-size:12px;color:#94a3b8;display:flex;gap:8px">
          ${dStr?`<span>📅 ${dStr}</span>`:''}
          ${tStr?`<span>🕐 ${tStr}</span>`:''}
          ${r.category?`<span class="tag">${r.category}</span>`:''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn-outline small-btn" onclick="openEditReminderModal('${r.id}')">Edit</button>
        <button class="btn-green small-btn" onclick="markDone('${r.id}')">Done</button>
      </div>
    </div>`;
  }).join('');
}

async function saveReminder() {
  const title = document.getElementById('newReminderTitle').value.trim();
  const desc  = document.getElementById('newReminderDesc').value.trim();
  const date  = document.getElementById('newReminderDate').value;
  const time  = document.getElementById('newReminderTime').value;
  const pri   = document.getElementById('newReminderPriority').value;
  const cat   = document.getElementById('newReminderCat').value.trim()||'General';
  if (!title) { showToast('Please enter a title'); return; }
  const remind_at = date&&time ? new Date(date+'T'+time).toISOString()
    : date ? new Date(date).toISOString() : new Date().toISOString();
  try {
    const r = await apiFetch('/reminders', {
      method:'POST',
      body:JSON.stringify({title,description:desc,remind_at,priority:pri,category:cat,trip_id:currentTripId||null})
    });
    tripReminders.unshift(r);
    renderHubReminders();
    closeModal('modalAddReminder');
    document.getElementById('newReminderTitle').value='';
    document.getElementById('newReminderDesc').value='';
    document.getElementById('newReminderCat').value='';
    showToast('Reminder added!');
  } catch(e) { showToast('Error: '+e.message); }
}

function openEditReminderModal(id) {
  const r = tripReminders.find(r=>r.id===id);
  if (!r) return;
  window._editingReminderId = id;
  document.getElementById('editReminderTitle').value    = r.title;
  document.getElementById('editReminderDesc').value     = r.description||'';
  document.getElementById('editReminderPriority').value = r.priority;
  if (r.remind_at) {
    const dt = new Date(r.remind_at);
    document.getElementById('editReminderDate').value = dt.toISOString().split('T')[0];
    document.getElementById('editReminderTime').value = dt.toTimeString().slice(0,5);
  }
  openModal('modalEditReminder');
}

async function saveEditReminder() {
  const id    = window._editingReminderId;
  const title = document.getElementById('editReminderTitle').value.trim();
  const desc  = document.getElementById('editReminderDesc').value.trim();
  const date  = document.getElementById('editReminderDate').value;
  const time  = document.getElementById('editReminderTime').value;
  const pri   = document.getElementById('editReminderPriority').value;
  if (!title) { showToast('Please enter a title'); return; }
  const remind_at = date&&time ? new Date(date+'T'+time).toISOString() : undefined;
  try {
    const updated = await apiFetch('/reminders/'+id, {
      method:'PATCH', body:JSON.stringify({title,description:desc,priority:pri,...(remind_at?{remind_at}:{})})
    });
    const idx = tripReminders.findIndex(r=>r.id===id);
    if (idx>-1) tripReminders[idx]={...tripReminders[idx],...updated};
    renderHubReminders();
    closeModal('modalEditReminder');
    showToast('Reminder updated!');
  } catch(e) { showToast('Error: '+e.message); }
}

async function markDone(id) {
  try {
    await apiFetch('/reminders/'+id, {method:'PATCH', body:JSON.stringify({is_done:true})});
  } catch(e) {}
  tripReminders = tripReminders.filter(r=>r.id!==id);
  renderHubReminders();
  showToast('Done ✓');
}

// ============================================================
//  PLAN TRIP — Create My Own
// ============================================================
async function createMyOwnTrip() {
  const dest  = document.getElementById('destination')?.value?.trim();
  const start = document.getElementById('startDate')?.value;
  const end   = document.getElementById('endDate')?.value;
  const budget= parseFloat(document.getElementById('budgetAmount')?.value)||0;
  const notes = document.getElementById('tripNotes')?.value?.trim()||'';

  // Proper validation with specific messages
  const errors = [];
  if (!dest)          errors.push('📍 Please enter a destination');
  if (!start)         errors.push('📅 Please select a start date');
  if (!end)           errors.push('📅 Please select an end date');
  if (start && end && new Date(end) < new Date(start)) errors.push('📅 End date must be after start date');

  if (errors.length) {
    showValidationErrors(errors);
    return;
  }
  try {
    const trip = await apiFetch('/trips', {
      method:'POST', body:JSON.stringify({title:dest,destination:dest,start_date:start||null,end_date:end||null,notes})
    });
    if (budget>0) {
      await apiFetch('/budget/'+trip.id, {method:'POST',body:JSON.stringify({total_amount:budget,currency:getCurrency()})});
    }
    allTrips.unshift(trip);
    renderMyTripsPage();
    renderDashboardStats();
    renderDashboardTrips();
    showToast('Trip "'+dest+'" created!');
    clearPlanForm();
    openTripHub(trip.id);
  } catch(e) { showToast('Error: '+e.message); }
}

// ============================================================
//  PLAN TRIP — Generate AI Itinerary then Save
// ============================================================
async function generateItinerary() {
  const btn   = document.getElementById('generateBtn');
  const card  = document.getElementById('generatingCard');
  const dest  = document.getElementById('destination')?.value?.trim();
  const start = document.getElementById('startDate')?.value;
  const end   = document.getElementById('endDate')?.value;
  const notes = document.getElementById('tripNotes')?.value?.trim()||'';
  const pace  = document.querySelector('.pace-btn.active')?.textContent?.trim()||'Moderate';
  const interests = [...document.querySelectorAll('.interest-btn.active')].map(b=>b.textContent.trim()).join(', ')||'general sightseeing';
  const budget= parseFloat(document.getElementById('budgetAmount')?.value)||0;

  // Proper validation
  const errs = [];
  if (!dest)  errs.push('📍 Please enter a destination');
  if (!start) errs.push('📅 Please select a start date');
  if (!end)   errs.push('📅 Please select an end date');
  if (start && end && new Date(end) < new Date(start)) errs.push('📅 End date must be after start date');
  if (errs.length) { showValidationErrors(errs); return; }

  let days = 3;
  if (start&&end) days=Math.max(1,Math.ceil((new Date(end)-new Date(start))/86400000));

  btn.innerHTML='⏳ Generating…'; btn.disabled=true;
  if (card) card.style.display='block';

  try {
    // 1. Save trip first
    const trip = await apiFetch('/trips', {
      method:'POST', body:JSON.stringify({title:dest,destination:dest,start_date:start||null,end_date:end||null,notes})
    });
    if (budget>0) {
      await apiFetch('/budget/'+trip.id, {method:'POST',body:JSON.stringify({total_amount:budget,currency:getCurrency()})});
    }
    allTrips.unshift(trip);
    currentTripId = trip.id;

    // 2. Generate AI itinerary
    const res = await apiFetch('/assistant/chat', {
      method:'POST',
      body:JSON.stringify({
        message:`Create a detailed ${days}-day travel itinerary for ${dest}.
Travel pace: ${pace}.
Interests: ${interests}.
${budget>0 ? `Total budget: ${getCurrency()} ${budget}.` : ''}
${notes ? `Special requirements: ${notes}` : ''}
Important: Strictly follow any special requirements mentioned above (e.g. family-friendly activities, dietary restrictions, mobility limitations, etc.)
Format EXACTLY like this for each day:
Day 1 — [Theme]
🕘 9:00 AM - [Specific activity with real place name]
🕛 12:00 PM - [Lunch recommendation]
🕒 3:00 PM - [Activity]
🕖 7:00 PM - [Dinner recommendation]
Day 2 — [Theme]
...continue for all ${days} days. Use real places in ${dest}. Be specific and practical.`
      })
    });

    // 3. Parse and store itinerary
    const itinHTML = parseItinerary(res.reply, dest);
    localStorage.setItem('itinerary_'+trip.id, itinHTML);

    // 4. Show trip hub with itinerary
    renderMyTripsPage();
    renderDashboardStats();
    renderDashboardTrips();
    clearPlanForm();
    showToast('Trip created with AI itinerary!');
    openTripHub(trip.id);

  } catch(e) {
    showToast('Error: '+e.message);
    console.error(e);
  } finally {
    btn.innerHTML='✨ Generate AI Itinerary'; btn.disabled=false;
    if (card) card.style.display='none';
  }
}

function parseItinerary(reply, dest) {
  const lines = reply.split('\n').filter(l=>l.trim());
  let html = '', inDay = false;
  lines.forEach(line => {
    const l = line.trim().replace(/\*\*/g,'');
    if (l.match(/^day\s*\d+/i)) {
      if (inDay) html+='</div>';
      html+=`<div class="itinerary-day"><div class="itinerary-day-header" style="display:flex;justify-content:space-between;align-items:center">${l}</div>`;
      inDay=true;
    } else if (l&&inDay) {
      html+=`<div class="itinerary-activity">${l}</div>`;
    }
  });
  if (inDay) html+='</div>';
  if (!html) html=`<div class="itinerary-day"><div class="itinerary-day-header">Your ${dest} Itinerary</div><div class="itinerary-activity">${reply}</div></div>`;
  // Add edit button at the top
  return `<div style="text-align:right;margin-bottom:10px">
    <button class="btn-outline small-btn" onclick="openManualItinerary()" style="font-size:12px">✏️ Edit Itinerary</button>
  </div>` + html;
}


function showValidationErrors(errors) {
  const el = document.getElementById('planValidation');
  if (el) {
    el.innerHTML = errors.map(e=>`<div style="padding:4px 0">${e}</div>`).join('');
    el.style.display = 'block';
    setTimeout(() => { el.style.display='none'; }, 5000);
  } else {
    showToast(errors[0]);
  }
}

function clearPlanForm() {
  ['destination','startDate','endDate','budgetAmount','tripNotes'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.querySelectorAll('.interest-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.pace-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.pace-btn:nth-child(2)')?.classList.add('active');
}

// ── Edit Trip ─────────────────────────────────────────────────
function openEditCurrentTrip() {
  const trip = allTrips.find(t=>t.id===currentTripId);
  if (!trip) return;
  document.getElementById('editTripDest').value  = trip.destination;
  document.getElementById('editTripStart').value = trip.start_date?trip.start_date.split('T')[0]:'';
  document.getElementById('editTripEnd').value   = trip.end_date?trip.end_date.split('T')[0]:'';
  document.getElementById('editTripNotes').value = trip.notes||'';
  openModal('modalEditTrip');
}

async function saveEditTrip() {
  const dest  = document.getElementById('editTripDest').value.trim();
  const start = document.getElementById('editTripStart').value;
  const end   = document.getElementById('editTripEnd').value;
  const notes = document.getElementById('editTripNotes').value;
  if (!dest) { showToast('Please enter a destination'); return; }
  // Auto-calculate status based on dates
  let status = 'upcoming';
  if (start && end) {
    const now   = new Date();
    const startD= new Date(start);
    const endD  = new Date(end);
    if (endD < now)        status = 'completed';
    else if (startD <= now) status = 'ongoing';
    else                    status = 'upcoming';
  }
  try {
    const updated = await apiFetch('/trips/'+currentTripId, {
      method:'PATCH', body:JSON.stringify({destination:dest,start_date:start||null,end_date:end||null,notes,status})
    });
    const idx = allTrips.findIndex(t=>t.id===currentTripId);
    if (idx>-1) allTrips[idx]={...allTrips[idx],...updated};
    // Refresh hub header
    document.getElementById('hubTripName').textContent  = updated.destination;
    document.getElementById('hubTripDates').textContent = updated.start_date
      ? `${fmtDate(updated.start_date)} – ${fmtDate(updated.end_date||updated.start_date)}`
      : 'Dates not set';
    document.getElementById('hubTripNotes').textContent = updated.notes||'No notes yet.';
    renderMyTripsPage();
    renderDashboardTrips();
    closeModal('modalEditTrip');
    showToast('Trip updated!');
  } catch(e) { showToast('Error: '+e.message); }
}

async function deleteCurrentTrip() {
  if (!confirm('Delete this trip? This cannot be undone.')) return;
  try {
    await apiFetch('/trips/'+currentTripId, {method:'DELETE'});
    allTrips = allTrips.filter(t=>t.id!==currentTripId);
    renderMyTripsPage();
    renderDashboardStats();
    renderDashboardTrips();
    navigate('mytrips');
    showToast('Trip deleted');
  } catch(e) { showToast('Error: '+e.message); }
}

// ── Hub: Generate itinerary for existing trip ─────────────────
async function generateHubItinerary() {
  const trip = allTrips.find(t=>t.id===currentTripId);
  if (!trip) return;
  const btn = document.getElementById('hubGenBtn');
  if (btn) { btn.disabled=true; btn.textContent='Generating…'; }
  const days = trip.start_date&&trip.end_date
    ? Math.max(1,Math.ceil((new Date(trip.end_date)-new Date(trip.start_date))/86400000))
    : 3;
  try {
    const res = await apiFetch('/assistant/chat', {
      method:'POST',
      body:JSON.stringify({
        message:`Create a detailed ${days}-day travel itinerary for ${trip.destination}.
${trip.notes ? `Special requirements: ${trip.notes}` : ''}
${trip.notes ? 'Important: Strictly follow any special requirements above.' : ''}
Format EXACTLY like this:
Day 1 — [Theme]
🕘 9:00 AM - [Specific activity with real place name]
🕛 12:00 PM - [Lunch recommendation]
🕒 3:00 PM - [Activity]
🕖 7:00 PM - [Dinner recommendation]
Day 2 — [Theme]
...continue for all ${days} days. Use real places in ${trip.destination}. Be specific and practical.`
      })
    });
    const html = parseItinerary(res.reply, trip.destination);
    localStorage.setItem('itinerary_'+currentTripId, html);
    const el = document.getElementById('hubItinerary');
    if (el) el.innerHTML = html;
    showToast('Itinerary generated!');
  } catch(e) { showToast('Error: '+e.message); }
  finally { if(btn){btn.disabled=false;btn.textContent='✨ Generate Itinerary';} }
}

// ============================================================
//  INIT
// ============================================================
// ── Page History for back button ─────────────────────────────
let pageHistory = ['dashboard'];
const _navOrig  = window.navigate;

document.addEventListener('DOMContentLoaded', () => {
  loadTrips();
  // Expose functions to global scope for onclick handlers
  window.generateItinerary  = generateItinerary;
  window.createMyOwnTrip    = createMyOwnTrip;
  window.saveEditTrip       = saveEditTrip;
  window.deleteCurrentTrip  = deleteCurrentTrip;
  window.openEditCurrentTrip= openEditCurrentTrip;
  window.openTripHub        = openTripHub;
  window.generateHubItinerary=generateHubItinerary;
  window.openManualItinerary= openManualItinerary;
  window.closeManualItinerary=closeManualItinerary;
  window.saveManualItinerary= saveManualItinerary;
  window.addItineraryDay          = addItineraryDay;
  window.renderItineraryEditorDays = renderItineraryEditorDays;
  window.removeDay          = removeDay;
  window.addActivity        = addActivity;
  window.removeActivity     = removeActivity;
  window.saveCategory       = saveCategory;
  window.saveExpense        = saveExpense;
  window.saveChecklist      = saveChecklist;
  window.saveItem           = saveItem;
  window.saveReminder       = saveReminder;
  window.saveEditReminder   = saveEditReminder;
  window.markDone           = markDone;
  window.markDonePage       = markDonePage;
  window.deleteReminder     = deleteReminder;
  window.createTripBudget   = createTripBudget;
  window.quickSetBudget     = quickSetBudget;
  window.openAddCategoryForTrip = openAddCategoryForTrip;
  window.openAddExpenseForCat   = openAddExpenseForCat;
  window.deleteBudgetCategory   = deleteBudgetCategory;
  window.filterBudgetByTrip     = filterBudgetByTrip;
  window.filterChecklistByTrip  = filterChecklistByTrip;
  window.filterReminderByTrip   = filterReminderByTrip;
  window.openNewChecklistFromPage = openNewChecklistFromPage;
  window.openNewChecklistForTrip  = openNewChecklistForTrip;
  window.openAddItemForChecklist  = openAddItemForChecklist;
  window.archiveChecklist         = archiveChecklist;
  window.deleteChecklistFromPage  = deleteChecklistFromPage;
  window.togglePageItem           = togglePageItem;
  window.openEditPageReminder     = openEditPageReminder;
  window.openEditReminderModal    = openEditReminderModal;
  window.deleteExpense              = deleteExpense;
  window.calculateAndSaveProgress  = calculateAndSaveProgress;
  window.showValidationErrors       = showValidationErrors;
  window.loadCalendar             = loadCalendar;
  window.renderCalendar           = renderCalendar;
  window.setCalView               = setCalView;
  window.calNav                   = calNav;
  window.calToday                 = calToday;
  window.openDayDetail            = openDayDetail;
  window.filterCalendar           = buildCalEvents;
});

// ============================================================
//  STANDALONE PAGES — Budget / Checklists / Reminders
//  with "All Trips" + per-trip filter + delete/archive
// ============================================================

// ── Currency: apply globally whenever getCurrency() is called ─
// (getCurrency() already reads from localStorage — just make sure
//  fmtMoney uses it everywhere, which it does.)

// ── Populate trip filters in all standalone pages ─────────────
function populateTripFilters() {
  const filters = ['budgetTripFilter','checklistTripFilter','reminderTripFilter'];
  filters.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="all">All Trips</option>' +
      allTrips.map(t=>`<option value="${t.id}">${t.destination}</option>`).join('');
    if (current) el.value = current;
  });
}

// ── BUDGET PAGE ───────────────────────────────────────────────
let allBudgets   = {}; // tripId -> budgetData
let allExpenses  = {}; // tripId -> expenses[]

async function loadBudgetPage() {
  const el = document.getElementById('budgetPageContent');
  if (!el) return;
  el.innerHTML = loadingHTML('Loading budgets…');
  populateTripFilters();

  // Load budget for every trip
  for (const trip of allTrips) {
    try {
      const b = await apiFetch('/budget/'+trip.id);
      if (b) allBudgets[trip.id] = b;
    } catch {}
  }
  renderBudgetPage('all');
}

function filterBudgetByTrip() {
  const val    = document.getElementById('budgetTripFilter')?.value || 'all';
  const search = (document.getElementById('budgetSearch')?.value || '').toLowerCase();
  const sort   = document.getElementById('budgetSort')?.value || 'date-asc';
  if (val !== 'all') currentTripId = val;
  renderBudgetPage(val, search, sort);
}

function renderBudgetPage(tripFilter, search='', sort='date-asc') {
  const el = document.getElementById('budgetPageContent');
  if (!el) return;

  let trips = tripFilter === 'all' ? [...allTrips] : allTrips.filter(t=>t.id===tripFilter);

  // Search filter
  if (search) trips = trips.filter(t =>
    t.destination?.toLowerCase().includes(search) ||
    t.title?.toLowerCase().includes(search) ||
    (t.start_date && t.start_date.includes(search))
  );

  // Sort
  trips.sort((a,b) => {
    if (sort === 'date-asc')  return new Date(a.start_date||0) - new Date(b.start_date||0);
    if (sort === 'date-desc') return new Date(b.start_date||0) - new Date(a.start_date||0);
    if (sort === 'name-asc')  return (a.destination||'').localeCompare(b.destination||'');
    if (sort === 'name-desc') return (b.destination||'').localeCompare(a.destination||'');
    return 0;
  });

  if (!trips.length) {
    el.innerHTML = emptyHTML('💰','No trips yet','Create a trip first to track its budget','+ Plan a Trip',"navigate('plantrip')");
    return;
  }

  let html = '';
  trips.forEach(trip => {
    const b    = allBudgets[trip.id];
    const cats = b?.categories || [];
    const total= parseFloat(b?.total_amount||0);
    const spent= cats.reduce((s,c)=>s+parseFloat(c.spent||0),0);
    const rem  = total - spent;
    const currency = b?.currency || getCurrency();
    const sym  = {USD:'$',PHP:'₱',EUR:'€',GBP:'£',JPY:'¥',AUD:'A$',SGD:'S$',KRW:'₩'}[currency]||'$';
    const fmt  = n => sym + Number(n||0).toLocaleString();
    const dateStr = trip.start_date
      ? `${fmtDate(new Date(trip.start_date))}${trip.end_date ? ' – ' + fmtDate(new Date(trip.end_date)) : ''}`
      : null;

    html += `
    <div class="card section" style="margin-bottom:20px">
      <div class="card-header" style="flex-wrap:wrap;gap:8px">
        <div>
          <h2 style="font-size:16px;margin-bottom:2px">✈️ ${trip.destination}</h2>
          ${dateStr ? `<p style="font-size:12px;color:#94a3b8;margin:0">📅 ${dateStr}</p>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-left:auto">
          <button class="btn-primary small-btn" onclick="openAddCategoryForTrip('${trip.id}')">+ Category</button>
          <button class="btn-outline small-btn" onclick="openTripHub('${trip.id}')">Open Trip →</button>
        </div>
      </div>`;

    if (!b) {
      html += `<div style="padding:16px">
        <p style="color:#64748b;font-size:14px;margin-bottom:12px">No budget set yet.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select id="qb_currency_${trip.id}" style="padding:10px 8px;border:1.5px solid #e8ecf0;border-radius:8px;font-size:14px;width:80px;flex-shrink:0">
            <option>USD</option><option>PHP</option><option>EUR</option><option>GBP</option><option>JPY</option><option>SGD</option>
          </select>
          <input type="number" id="qb_amount_${trip.id}" placeholder="Total budget (e.g. 50000)" style="flex:1;padding:12px 14px;border:1.5px solid #e8ecf0;border-radius:8px;font-size:18px;font-weight:600;min-width:140px"/>
          <button class="btn-primary" onclick="quickSetBudget('${trip.id}')">Set Budget</button>
        </div>
      </div>`;
    } else {
      const pctSpent = total>0 ? Math.min(Math.round(spent/total*100),100) : 0;
      html += `
      <div style="padding:0 0 16px">
        <div class="stats-grid three-col" style="margin-bottom:16px">
          <div class="stat-card"><div><p class="stat-label">Total</p><p class="stat-value" style="font-size:18px">${fmt(total)}</p></div></div>
          <div class="stat-card"><div><p class="stat-label">Spent</p><p class="stat-value" style="font-size:18px;color:#f97316">${fmt(spent)}</p></div></div>
          <div class="stat-card"><div><p class="stat-label">Left</p><p class="stat-value" style="font-size:18px;color:#22c55e">${fmt(rem)}</p></div></div>
        </div>
        <div class="progress-bar" style="margin-bottom:16px;height:8px">
          <div class="progress-fill" style="width:${pctSpent}%;background:${pctSpent>90?'#ef4444':pctSpent>70?'#f97316':'#22c55e'}"></div>
        </div>
        ${cats.length ? cats.map(cat => budgetCatRow(cat, trip.id, fmt)).join('') : '<p style="color:#94a3b8;font-size:13px;padding:8px 0">No categories yet. Add one above!</p>'}
      </div>`;
    }
    html += '</div>';
  });

  el.innerHTML = html;
}

function budgetCatRow(cat, tripId, fmt) {
  const pct   = cat.allocated>0 ? Math.min(Math.round(cat.spent/cat.allocated*100),100) : 0;
  const color = cat.color||'#068cdf';
  const overBudget = pct >= 100;
  return `
  <div style="border:1px solid #e8ecf0;border-radius:10px;padding:14px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>
        <strong>${cat.name}</strong>
        ${overBudget?'<span style="background:#fee2e2;color:#dc2626;font-size:11px;padding:2px 6px;border-radius:4px">Over budget!</span>':''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="color:#64748b;font-size:13px">${fmt(cat.spent)} / ${fmt(cat.allocated)}</span>
        <button class="edit-btn" onclick="openAddExpenseForCat('${cat.category_id}','${cat.name}');currentTripId='${tripId}'" title="Add expense">+ Expense</button>
        <button class="edit-btn" onclick="openEditCategoryModal('${cat.category_id}','${cat.name}',${cat.allocated},'${cat.color||'#068cdf'}');currentTripId='${tripId}'" title="Edit">✏️</button>
        <button class="edit-btn" style="color:#ef4444" onclick="deleteBudgetCategory('${cat.category_id}','${tripId}')" title="Delete">🗑</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <div class="progress-bar flex1" style="height:8px"><div class="progress-fill" style="width:${pct}%;background:${overBudget?'#ef4444':color}"></div></div>
      <span style="font-size:12px;color:#64748b;min-width:32px">${pct}%</span>
    </div>
  </div>`;
}

async function quickSetBudget(tripId) {
  const amount   = document.getElementById('qb_amount_'+tripId)?.value;
  const currency = document.getElementById('qb_currency_'+tripId)?.value || 'USD';
  if (!amount) { showToast('Enter a budget amount'); return; }
  try {
    const b = await apiFetch('/budget/'+tripId, {method:'POST',body:JSON.stringify({total_amount:parseFloat(amount),currency})});
    allBudgets[tripId] = b;
    renderBudgetPage(document.getElementById('budgetTripFilter')?.value||'all');
    showToast('Budget set!');
  } catch(e) { showToast('Error: '+e.message); }
}

function openAddCategoryForTrip(tripId) {
  currentTripId = tripId;
  document.getElementById('newCatName').value='';
  document.getElementById('newCatAmount').value='';
  openModal('modalAddCategory');
}

// Override saveCategory to refresh budget page after saving
const _origSaveCat = window.saveCategory;
async function saveCategory() {
  const name   = document.getElementById('newCatName').value.trim();
  const amount = parseFloat(document.getElementById('newCatAmount').value)||0;
  const color  = document.querySelector('.color-swatch.selected')?.dataset.color||'#068cdf';
  if (!name) { showToast('Please enter a category name'); return; }
  try {
    if (!allBudgets[currentTripId]) {
      const b = await apiFetch('/budget/'+currentTripId,{method:'POST',body:JSON.stringify({total_amount:0,currency:getCurrency()})});
      allBudgets[currentTripId]=b;
    }
    await apiFetch('/budget/'+currentTripId+'/categories',{method:'POST',body:JSON.stringify({name,allocated:amount,color})});
    // Refresh budget data
    const b = await apiFetch('/budget/'+currentTripId);
    allBudgets[currentTripId]=b;
    closeModal('modalAddCategory');
    document.getElementById('newCatName').value='';
    document.getElementById('newCatAmount').value='';
    showToast('Category "'+name+'" added!');
    // Refresh whichever view is open
    if (document.getElementById('page-budget')?.classList.contains('active')) {
      renderBudgetPage(document.getElementById('budgetTripFilter')?.value||'all');
    }
    if (document.getElementById('page-tripHub')?.classList.contains('active')) {
      tripBudget=b; renderHubBudget();
    }
  } catch(e) { showToast('Error: '+e.message); }
}

async function deleteBudgetCategory(catId, tripId) {
  if (!confirm('Delete this category and all its expenses?')) return;
  // Note: backend doesn't have delete category endpoint yet — remove from UI optimistically
  if (allBudgets[tripId]) {
    allBudgets[tripId].categories = allBudgets[tripId].categories.filter(c=>c.category_id!==catId);
  }
  renderBudgetPage(document.getElementById('budgetTripFilter')?.value||'all');
  showToast('Category removed');
}

// Override saveExpense to refresh budget page
async function saveExpense() {
  const desc   = document.getElementById('newExpDesc').value.trim();
  const amount = parseFloat(document.getElementById('newExpAmount').value);
  const date   = document.getElementById('newExpDate').value;
  const catId  = window._expenseCatId;
  if (!desc||!amount) { showToast('Please fill in description and amount'); return; }
  if (!catId)         { showToast('Please open from a category button'); return; }
  try {
    await apiFetch('/budget/'+currentTripId+'/expenses',{
      method:'POST',
      body:JSON.stringify({category_id:catId,description:desc,amount,spent_on:date||new Date().toISOString().split('T')[0]})
    });
    // Refresh budget data including expenses
    const b = await apiFetch('/budget/'+currentTripId);
    try { b.expenses = await apiFetch('/budget/'+currentTripId+'/expenses'); } catch { b.expenses=[]; }
    allBudgets[currentTripId]=b;
    if (currentTripId) tripBudget=b;
    closeModal('modalAddExpense');
    document.getElementById('newExpDesc').value='';
    document.getElementById('newExpAmount').value='';
    showToast('Expense added!');
    if (document.getElementById('page-budget')?.classList.contains('active')) {
      renderBudgetPage(document.getElementById('budgetTripFilter')?.value||'all');
    }
    if (document.getElementById('page-tripHub')?.classList.contains('active')) {
      renderHubBudget();
    }
  } catch(e) { showToast('Error: '+e.message); }
}

// ── CHECKLISTS PAGE ───────────────────────────────────────────
let allChecklistsByTrip = {}; // tripId -> []

async function loadChecklistPage() {
  const el = document.getElementById('checklistPageContent');
  if (!el) return;
  el.innerHTML = loadingHTML('Loading checklists…');
  populateTripFilters();
  for (const trip of allTrips) {
    try {
      allChecklistsByTrip[trip.id] = await apiFetch('/checklists?tripId='+trip.id);
    } catch { allChecklistsByTrip[trip.id]=[]; }
  }
  renderChecklistPage('all');
}

function filterChecklistByTrip() {
  const val    = document.getElementById('checklistTripFilter')?.value || 'all';
  const search = (document.getElementById('checklistSearch')?.value || '').toLowerCase();
  const sort   = document.getElementById('checklistSort')?.value || 'date-asc';
  if (val !== 'all') currentTripId = val;
  renderChecklistPage(val, search, sort);
}

function openNewChecklistFromPage() {
  const val = document.getElementById('checklistTripFilter')?.value||'all';
  if (val==='all' && allTrips.length) currentTripId=allTrips[0].id;
  else if (val!=='all') currentTripId=val;
  document.getElementById('newChecklistTitle').value='';
  document.getElementById('newChecklistIcon').value='📋';
  openModal('modalNewChecklist');
}

function renderChecklistPage(tripFilter, search='', sort='date-asc') {
  const el = document.getElementById('checklistPageContent');
  if (!el) return;
  let trips = tripFilter==='all' ? [...allTrips] : allTrips.filter(t=>t.id===tripFilter);

  if (search) trips = trips.filter(t =>
    t.destination?.toLowerCase().includes(search) ||
    t.title?.toLowerCase().includes(search)
  );

  trips.sort((a,b) => {
    if (sort === 'date-asc')  return new Date(a.start_date||0) - new Date(b.start_date||0);
    if (sort === 'date-desc') return new Date(b.start_date||0) - new Date(a.start_date||0);
    if (sort === 'name-asc')  return (a.destination||'').localeCompare(b.destination||'');
    if (sort === 'name-desc') return (b.destination||'').localeCompare(a.destination||'');
    return 0;
  });

  if (!trips.length) {
    el.innerHTML = emptyHTML('📋','No trips yet','Create a trip first!','+ Plan a Trip',"navigate('plantrip')");
    return;
  }
  let html='';
  trips.forEach(trip => {
    const cls = allChecklistsByTrip[trip.id]||[];
    const dateStr = trip.start_date
      ? `${fmtDate(new Date(trip.start_date))}${trip.end_date ? ' – ' + fmtDate(new Date(trip.end_date)) : ''}`
      : null;
    html+=`
    <div class="card section" style="margin-bottom:20px">
      <div class="card-header">
        <div>
          <h2 style="font-size:16px;margin-bottom:2px">✈️ ${trip.destination}</h2>
          ${dateStr ? `<p style="font-size:12px;color:#94a3b8;margin:0">📅 ${dateStr}</p>` : ''}
        </div>
        <button class="btn-primary small-btn" onclick="openNewChecklistForTrip('${trip.id}')" style="white-space:nowrap">+ New Checklist</button>
      </div>
      ${cls.length ? cls.map(cl=>checklistCard(cl,trip.id)).join('') : '<p style="color:#94a3b8;font-size:14px;padding:12px 0">No checklists yet.</p>'}
    </div>`;
  });
  el.innerHTML=html;
}

function checklistCard(cl, tripId) {
  const items=cl.items||[];
  const done=items.filter(i=>i.is_checked).length;
  const total=items.length;
  const pct=total?Math.round(done/total*100):0;
  return `
  <div style="border:1px solid #e8ecf0;border-radius:10px;margin-bottom:12px;overflow:hidden">
    <div style="background:#f8fafc;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">${cl.icon||'📋'}</span>
        <div>
          <strong style="font-size:15px">${cl.title}</strong>
          <p style="font-size:12px;color:#64748b;margin:0">${done} of ${total} completed</p>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn-outline small-btn" onclick="openAddItemForChecklist('${cl.id}')">+ Item</button>
        <button class="btn-outline small-btn" onclick="openEditChecklistModal('${cl.id}','${cl.title}','${cl.icon||'📋'}')" title="Edit">✏️</button>
        <button class="btn-outline small-btn" onclick="archiveChecklist('${cl.id}','${tripId}')" title="Archive">📦</button>
        <button class="btn-outline small-btn" style="color:#ef4444;border-color:#ef4444" onclick="deleteChecklistFromPage('${cl.id}','${tripId}')" title="Delete">🗑</button>
      </div>
    </div>
    <div class="progress-bar" style="margin:0;border-radius:0;height:3px"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div style="padding:4px 0;background:#fff">
      ${items.map(item=>`
        <label style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f8fafc;cursor:pointer">
          <input type="checkbox" ${item.is_checked?'checked':''} onchange="togglePageItem('${item.id}',this.checked,'${cl.id}','${tripId}')" style="accent-color:#068cdf;flex-shrink:0">
          <span style="flex:1;${item.is_checked?'text-decoration:line-through;color:#94a3b8':''}">${item.label}</span>
          <button onclick="openEditItemModal('${item.id}','${item.label}','${cl.id}')" style="background:none;border:none;color:#068cdf;cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0" title="Edit">✏️</button>
          <button onclick="deleteChecklistItem('${item.id}','${cl.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0" title="Delete">🗑</button>
        </div>`).join('')}
      ${!items.length?'<p style="text-align:center;color:#94a3b8;font-size:13px;padding:12px">No items yet</p>':''}
    </div>
  </div>`;
}

function openNewChecklistForTrip(tripId) {
  currentTripId=tripId;
  document.getElementById('newChecklistTitle').value='';
  document.getElementById('newChecklistIcon').value='📋';
  openModal('modalNewChecklist');
}

function openAddItemForChecklist(clId) {
  document.getElementById('newItemLabel').value='';
  document.getElementById('newItemTarget').value=clId;
  openModal('modalAddItem');
}

async function togglePageItem(itemId, checked, clId, tripId) {
  try {
    await apiFetch('/checklists/items/'+itemId,{method:'PATCH',body:JSON.stringify({is_checked:checked})});
    const cls = allChecklistsByTrip[tripId]||[];
    const cl  = cls.find(c=>c.id===clId);
    if (cl) { const it=cl.items?.find(i=>i.id===itemId); if(it) it.is_checked=checked; }
    renderChecklistPage(document.getElementById('checklistTripFilter')?.value||'all');
  } catch(e) { console.error(e); }
}

// Override saveChecklist to also refresh checklist page
async function saveChecklist() {
  const title = document.getElementById('newChecklistTitle').value.trim();
  const icon  = document.getElementById('newChecklistIcon').value||'📋';
  if (!title) { showToast('Please enter a title'); return; }
  if (!currentTripId) { showToast('Please select a trip first'); return; }
  try {
    const cl = await apiFetch('/checklists',{method:'POST',body:JSON.stringify({trip_id:currentTripId,title,icon})});
    cl.items=[];
    if (!allChecklistsByTrip[currentTripId]) allChecklistsByTrip[currentTripId]=[];
    allChecklistsByTrip[currentTripId].unshift(cl);
    // Also update hub state
    tripChecklists=allChecklistsByTrip[currentTripId];
    closeModal('modalNewChecklist');
    document.getElementById('newChecklistTitle').value='';
    showToast('Checklist created!');
    if (document.getElementById('page-checklists')?.classList.contains('active')) {
      renderChecklistPage(document.getElementById('checklistTripFilter')?.value||'all');
    }
    if (document.getElementById('page-tripHub')?.classList.contains('active')) renderHubChecklists();
  } catch(e) { showToast('Error: '+e.message); }
}

// Override saveItem
async function saveItem() {
  const label = document.getElementById('newItemLabel').value.trim();
  const clId  = document.getElementById('newItemTarget').value;
  if (!label) { showToast('Please enter an item'); return; }
  try {
    const item = await apiFetch('/checklists/'+clId+'/items',{method:'POST',body:JSON.stringify({label})});
    // Find the checklist in allChecklistsByTrip
    for (const tripId of Object.keys(allChecklistsByTrip)) {
      const cl = allChecklistsByTrip[tripId]?.find(c=>c.id===clId);
      if (cl) { cl.items=cl.items||[]; cl.items.push(item); break; }
    }
    const cl2 = tripChecklists.find(c=>c.id===clId);
    if (cl2) { cl2.items=cl2.items||[]; cl2.push?.(item); }
    closeModal('modalAddItem');
    document.getElementById('newItemLabel').value='';
    showToast('Item added!');
    if (document.getElementById('page-checklists')?.classList.contains('active')) {
      renderChecklistPage(document.getElementById('checklistTripFilter')?.value||'all');
    }
    if (document.getElementById('page-tripHub')?.classList.contains('active')) renderHubChecklists();
  } catch(e) { showToast('Error: '+e.message); }
}

async function archiveChecklist(clId, tripId) {
  showToast('Checklist archived (hidden from view)');
  if (allChecklistsByTrip[tripId]) {
    allChecklistsByTrip[tripId]=allChecklistsByTrip[tripId].filter(c=>c.id!==clId);
  }
  renderChecklistPage(document.getElementById('checklistTripFilter')?.value||'all');
}

async function deleteChecklistFromPage(clId, tripId) {
  if (!confirm('Delete this checklist and all its items?')) return;
  try {
    await apiFetch('/checklists/'+clId,{method:'DELETE'});
    if (allChecklistsByTrip[tripId]) {
      allChecklistsByTrip[tripId]=allChecklistsByTrip[tripId].filter(c=>c.id!==clId);
    }
    renderChecklistPage(document.getElementById('checklistTripFilter')?.value||'all');
    showToast('Checklist deleted');
  } catch(e) { showToast('Error: '+e.message); }
}

// ── REMINDERS PAGE ────────────────────────────────────────────
let allRemindersByTrip = {}; // tripId -> []
let globalReminders    = [];

async function loadReminderPage() {
  const el = document.getElementById('reminderPageContent');
  if (!el) return;
  el.innerHTML = loadingHTML('Loading reminders…');
  populateTripFilters();
  try {
    globalReminders = await apiFetch('/reminders?done=false');
    // Group by trip
    allRemindersByTrip={};
    globalReminders.forEach(r => {
      const tid = r.trip_id||'none';
      if (!allRemindersByTrip[tid]) allRemindersByTrip[tid]=[];
      allRemindersByTrip[tid].push(r);
    });
    renderReminderPage('all');
    updateReminderStats();
  } catch(e) {
    el.innerHTML = emptyHTML('🔔','No reminders','Add your first reminder!','','');
  }
}

function updateReminderStats() {
  const now=new Date();
  const today=now.toDateString();
  const high=globalReminders.filter(r=>r.priority==='high').length;
  const dueToday=globalReminders.filter(r=>r.remind_at&&new Date(r.remind_at).toDateString()===today).length;
  const thisWeek=globalReminders.filter(r=>{
    if(!r.remind_at)return false;
    const diff=(new Date(r.remind_at)-now)/86400000;
    return diff>=0&&diff<=7;
  }).length;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('statHighPriority',high); set('statDueToday',dueToday); set('statThisWeek',thisWeek);
}

function filterReminderByTrip() {
  const val      = document.getElementById('reminderTripFilter')?.value || 'all';
  const search   = (document.getElementById('reminderSearch')?.value || '').toLowerCase();
  const category = document.getElementById('reminderCategoryFilter')?.value || 'all';
  if (val !== 'all') currentTripId = val;
  renderReminderPage(val, search, category);
}

function renderReminderPage(tripFilter, search='', categoryFilter='all') {
  const el=document.getElementById('reminderPageContent');
  if(!el) return;

  let reminders=[];
  if(tripFilter==='all') {
    reminders=globalReminders;
  } else {
    reminders=(allRemindersByTrip[tripFilter]||[]).concat(allRemindersByTrip['none']||[]);
  }

  // Search filter
  if(search) reminders=reminders.filter(r=>
    r.title?.toLowerCase().includes(search) ||
    r.description?.toLowerCase().includes(search) ||
    r.category?.toLowerCase().includes(search)
  );

  // Category filter
  if(categoryFilter && categoryFilter!=='all') {
    reminders=reminders.filter(r=>r.category===categoryFilter);
  }

  if(!reminders.length) {
    el.innerHTML=emptyHTML('🔔',"You're all caught up!",'No pending reminders.','','');
    return;
  }

  // Group by category for display
  const tripMap={};
  allTrips.forEach(t=>tripMap[t.id]=t.destination);

  if(tripFilter==='all') {
    const grouped={};
    reminders.forEach(r=>{
      const key=r.category||'General';
      if(!grouped[key]) grouped[key]=[];
      grouped[key].push(r);
    });
    const catIcons={'Flight':'✈️','Hotel':'🏨','High Priority':'🔴','Documents':'📄','Money':'💰','Packing':'🧳','Health':'💊','General':'📌'};
    let html='';
    Object.entries(grouped).forEach(([cat,rems])=>{
      const icon=catIcons[cat]||'📌';
      html+=`<div style="margin-bottom:20px">
        <h3 style="font-size:14px;color:#64748b;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          ${icon} ${cat}
        </h3>
        ${rems.map(r=>reminderRow(r)).join('')}
      </div>`;
    });
    el.innerHTML=html;
  } else {
    el.innerHTML=reminders.map(r=>reminderRow(r)).join('');
  }
}

function reminderRow(r) {
  const badgeClass={low:'badge-low',medium:'badge-medium',high:'badge-high'}[r.priority]||'badge-medium';
  const dt=r.remind_at?new Date(r.remind_at):null;
  const dStr=dt?fmtDate(dt):'';
  const tStr=dt?dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):'';
  return `
  <div class="reminder-item" style="border:1px solid #e8ecf0;border-radius:10px;padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
        <strong>${r.title}</strong>
        <span class="badge ${badgeClass}">${r.priority}</span>
      </div>
      ${r.description?`<p style="font-size:13px;color:#64748b;margin:0 0 4px">${r.description}</p>`:''}
      <div style="font-size:12px;color:#94a3b8;display:flex;gap:8px;flex-wrap:wrap">
        ${dStr?`<span>📅 ${dStr}</span>`:''}
        ${tStr?`<span>🕐 ${tStr}</span>`:''}
        ${r.category?`<span class="tag">${r.category}</span>`:''}
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
      <button class="btn-outline small-btn" onclick="openEditPageReminder('${r.id}')">Edit</button>
      <button class="btn-green small-btn" onclick="markDonePage('${r.id}')">Done</button>
      <button class="btn-outline small-btn" style="color:#ef4444;border-color:#ef4444" onclick="deleteReminder('${r.id}')">🗑</button>
    </div>
  </div>`;
}

function openEditPageReminder(id) {
  const r=globalReminders.find(r=>r.id===id);
  if(!r) return;
  window._editingReminderId=id;
  document.getElementById('editReminderTitle').value=r.title;
  document.getElementById('editReminderDesc').value=r.description||'';
  document.getElementById('editReminderPriority').value=r.priority;
  if(r.remind_at){
    const dt=new Date(r.remind_at);
    document.getElementById('editReminderDate').value=dt.toISOString().split('T')[0];
    document.getElementById('editReminderTime').value=dt.toTimeString().slice(0,5);
  }
  openModal('modalEditReminder');
}

// Override saveReminder to also update global list
async function saveReminder() {
  const title=document.getElementById('newReminderTitle').value.trim();
  const desc=document.getElementById('newReminderDesc').value.trim();
  const date=document.getElementById('newReminderDate').value;
  const time=document.getElementById('newReminderTime').value;
  const pri=document.getElementById('newReminderPriority').value;
  const catEl=document.getElementById('newReminderCat');
  const cat=catEl?.value || 'General';
  if(!title){showToast('Please enter a title');return;}
  const remind_at=date&&time?new Date(date+'T'+time).toISOString():date?new Date(date+'T00:00').toISOString():new Date().toISOString();
  try {
    const r=await apiFetch('/reminders',{method:'POST',body:JSON.stringify({title,description:desc,remind_at,priority:pri,category:cat,trip_id:currentTripId||null})});
    globalReminders.unshift(r);
    const tid=r.trip_id||'none';
    if(!allRemindersByTrip[tid]) allRemindersByTrip[tid]=[];
    allRemindersByTrip[tid].unshift(r);
    tripReminders.unshift(r);
    closeModal('modalAddReminder');
    // Reset form
    document.getElementById('newReminderTitle').value='';
    document.getElementById('newReminderDesc').value='';
    document.getElementById('newReminderDate').value='';
    document.getElementById('newReminderTime').value='';
    if(catEl) catEl.value='General';
    showToast('Reminder added!');
    updateReminderStats();
    // Re-render without page refresh
    if(document.getElementById('page-reminders')?.classList.contains('active')){
      filterReminderByTrip();
    }
    if(document.getElementById('page-tripHub')?.classList.contains('active')) renderHubReminders();
  } catch(e){showToast('Error: '+e.message);}
}

// Override saveEditReminder
async function saveEditReminder() {
  const id=window._editingReminderId;
  const title=document.getElementById('editReminderTitle').value.trim();
  const desc=document.getElementById('editReminderDesc').value.trim();
  const date=document.getElementById('editReminderDate').value;
  const time=document.getElementById('editReminderTime').value;
  const pri=document.getElementById('editReminderPriority').value;
  if(!title){showToast('Please enter a title');return;}
  const remind_at=date&&time?new Date(date+'T'+time).toISOString():undefined;
  try {
    const updated=await apiFetch('/reminders/'+id,{method:'PATCH',body:JSON.stringify({title,description:desc,priority:pri,...(remind_at?{remind_at}:{})})});
    const idx=globalReminders.findIndex(r=>r.id===id);
    if(idx>-1) globalReminders[idx]={...globalReminders[idx],...updated};
    const idx2=tripReminders.findIndex(r=>r.id===id);
    if(idx2>-1) tripReminders[idx2]={...tripReminders[idx2],...updated};
    closeModal('modalEditReminder');
    showToast('Reminder updated!');
    if(document.getElementById('page-reminders')?.classList.contains('active')){
      renderReminderPage(document.getElementById('reminderTripFilter')?.value||'all');
    }
    if(document.getElementById('page-tripHub')?.classList.contains('active')) renderHubReminders();
  } catch(e){showToast('Error: '+e.message);}
}

async function markDonePage(id) {
  try { await apiFetch('/reminders/'+id,{method:'PATCH',body:JSON.stringify({is_done:true})}); } catch{}
  globalReminders=globalReminders.filter(r=>r.id!==id);
  tripReminders=tripReminders.filter(r=>r.id!==id);
  Object.keys(allRemindersByTrip).forEach(tid=>{
    allRemindersByTrip[tid]=allRemindersByTrip[tid].filter(r=>r.id!==id);
  });
  updateReminderStats();
  renderReminderPage(document.getElementById('reminderTripFilter')?.value||'all');
  showToast('Done ✓');
}

async function markDone(id) { return markDonePage(id); }

async function deleteReminder(id) {
  if(!confirm('Delete this reminder?')) return;
  try { await apiFetch('/reminders/'+id,{method:'DELETE'}); } catch{}
  globalReminders=globalReminders.filter(r=>r.id!==id);
  tripReminders=tripReminders.filter(r=>r.id!==id);
  Object.keys(allRemindersByTrip).forEach(tid=>{
    allRemindersByTrip[tid]=allRemindersByTrip[tid].filter(r=>r.id!==id);
  });
  updateReminderStats();
  renderReminderPage(document.getElementById('reminderTripFilter')?.value||'all');
  showToast('Reminder deleted');
}

// ── Hook navigate to load pages ───────────────────────────────
const _origNavigate = window.navigate;
if (_origNavigate) {
  window.navigate = function(page) {
    _origNavigate(page);
    if (page==='budget')     loadBudgetPage();
    if (page==='checklists') loadChecklistPage();
    if (page==='reminders')  loadReminderPage();
    if (page==='calendar')   loadCalendar();
  };
}

// ── Currency: apply preferred currency globally ───────────────
// fmtMoney already uses getCurrency() which reads from localStorage.
// When user saves profile with PHP, getCurrency() returns 'PHP' everywhere.

// ============================================================
//  IN-PLACE ITINERARY EDITOR
// ============================================================
let itineraryDays    = [];
let itineraryEditing = false;

function openManualItinerary() {
  const saved = localStorage.getItem('itinerary_raw_'+currentTripId);
  if (saved) { try { itineraryDays = JSON.parse(saved); } catch { itineraryDays = []; } }
  if (!itineraryDays.length) itineraryDays = [{ title:'Day 1', activities:[{time:'9:00 AM',desc:''}] }];
  itineraryEditing = true;
  renderInPlaceEditor();
}

function closeManualItinerary() {
  itineraryEditing = false;
  const saved = localStorage.getItem('itinerary_'+currentTripId);
  const el = document.getElementById('hubItinerary');
  if (el) el.innerHTML = saved || '<p style="color:#64748b;font-size:14px">No itinerary yet.</p>';
}

function renderInPlaceEditor() {
  const el = document.getElementById('hubItinerary');
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:2px solid #068cdf;margin-bottom:16px">
      <button onclick="addItineraryDay()" class="btn-primary small-btn">+ Add Day</button>
      <div style="display:flex;gap:8px">
        <button onclick="saveManualItinerary()" class="btn-primary small-btn">💾 Save</button>
        <button onclick="closeManualItinerary()" class="btn-outline small-btn">Cancel</button>
      </div>
    </div>
    <div id="itineraryDaysList"></div>`;
  renderItineraryEditorDays();
}

function renderItineraryEditorDays() {
  const el = document.getElementById('itineraryDaysList');
  if (!el) return;
  el.innerHTML = itineraryDays.map((day, di) => `
    <div style="border:1px solid #e8ecf0;border-radius:10px;margin-bottom:12px;overflow:hidden">
      <div style="background:#e8f4fd;padding:10px 14px;display:flex;align-items:center;gap:8px">
        <input type="text" value="${day.title.replace(/"/g,'&quot;')}"
          oninput="itineraryDays[${di}].title=this.value"
          style="flex:1;background:transparent;border:none;font-weight:700;font-size:14px;color:#068cdf;outline:none;font-family:inherit"/>
        <button onclick="addActivity(${di})" style="background:#068cdf;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;white-space:nowrap">+ Activity</button>
        <button onclick="removeDay(${di})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:18px;line-height:1">×</button>
      </div>
      <div style="padding:8px 14px">
        ${day.activities.map((act, ai) => `
          <div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #f8fafc">
            <input type="text" value="${(act.time||'').replace(/"/g,'&quot;')}" placeholder="Time"
              oninput="itineraryDays[${di}].activities[${ai}].time=this.value"
              style="width:85px;padding:6px 8px;border:1px solid #e8ecf0;border-radius:6px;font-size:13px;font-family:inherit;outline:none;flex-shrink:0"/>
            <input type="text" value="${(act.desc||'').replace(/"/g,'&quot;')}" placeholder="Activity…"
              oninput="itineraryDays[${di}].activities[${ai}].desc=this.value"
              style="flex:1;padding:6px 8px;border:1px solid #e8ecf0;border-radius:6px;font-size:13px;font-family:inherit;outline:none"/>
            <button onclick="removeActivity(${di},${ai})" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;flex-shrink:0">×</button>
          </div>`).join('')}
        ${!day.activities.length?'<p style="color:#94a3b8;font-size:13px;padding:8px 0">No activities. Click "+ Activity"</p>':''}
      </div>
    </div>`).join('');
}

function addItineraryDay() {
  itineraryDays.push({title:`Day ${itineraryDays.length+1}`,activities:[{time:'9:00 AM',desc:''}]});
  renderItineraryEditorDays();
}

function removeDay(di) {
  if (itineraryDays.length<=1){showToast('Keep at least one day');return;}
  itineraryDays.splice(di,1);
  itineraryDays.forEach((d,i)=>{if(/^Day \d+$/.test(d.title))d.title=`Day ${i+1}`;});
  renderItineraryEditorDays();
}

function addActivity(di) {
  itineraryDays[di].activities.push({time:'',desc:''});
  renderItineraryEditorDays();
  setTimeout(()=>{
    const inputs=[...document.querySelectorAll('#itineraryDaysList input[placeholder="Time"]')];
    if(inputs.length) inputs[inputs.length-1].focus();
  },50);
}

function removeActivity(di,ai) {
  itineraryDays[di].activities.splice(ai,1);
  renderItineraryEditorDays();
}

function saveManualItinerary() {
  localStorage.setItem('itinerary_raw_'+currentTripId, JSON.stringify(itineraryDays));
  const rawHtml = itineraryDays.map(day=>`
    <div class="itinerary-day">
      <div class="itinerary-day-header">${day.title}</div>
      ${day.activities.map(act=>`
        <div class="itinerary-activity">${act.time?`<span>${act.time}</span>`:''} ${act.desc||'—'}</div>`).join('')}
    </div>`).join('');
  const html = `<div style="text-align:right;margin-bottom:10px">
    <button class="btn-outline small-btn" onclick="openManualItinerary()" style="font-size:12px">✏️ Edit Itinerary</button>
  </div>` + rawHtml;
  localStorage.setItem('itinerary_'+currentTripId, html);
  itineraryEditing = false;
  const el = document.getElementById('hubItinerary');
  if (el) el.innerHTML = html;
  showToast('Itinerary saved! ✓');
}

// ============================================================
//  CALENDAR
// ============================================================
let calView    = 'month';   // 'month' | 'week' | 'day'
let calDate    = new Date(); // current focused date
let calEvents  = [];         // all parsed events

function setCalView(view) {
  calView = view;
  ['month','week','day'].forEach(v => {
    const btn = document.getElementById('calView'+v.charAt(0).toUpperCase()+v.slice(1));
    if (btn) {
      btn.style.background = v===view ? '#068cdf' : 'white';
      btn.style.color      = v===view ? 'white'   : '#063937';
    }
  });
  renderCalendar();
}

function calNav(dir) {
  if (calView==='month') calDate.setMonth(calDate.getMonth()+dir);
  else if (calView==='week') calDate.setDate(calDate.getDate()+(dir*7));
  else calDate.setDate(calDate.getDate()+dir);
  calDate = new Date(calDate); // force re-render
  renderCalendar();
}

function calToday() {
  calDate = new Date();
  renderCalendar();
}

async function loadCalendar() {
  // Populate trip filter
  const sel = document.getElementById('calTripFilter');
  if (sel) {
    sel.innerHTML = '<option value="all">All Trips</option>' +
      allTrips.map(t=>`<option value="${t.id}">${t.destination}</option>`).join('');
  }
  await buildCalEvents();
  renderCalendar();
}

async function buildCalEvents() {
  calEvents = [];

  const tripFilter = document.getElementById('calTripFilter')?.value || 'all';
  const trips = tripFilter==='all' ? allTrips : allTrips.filter(t=>t.id===tripFilter);

  // 1. Trip date ranges
  trips.forEach(trip => {
    if (trip.start_date) {
      calEvents.push({
        type:    'trip',
        tripId:  trip.id,
        title:   '✈️ ' + trip.destination,
        date:    trip.start_date.split('T')[0],
        endDate: trip.end_date ? trip.end_date.split('T')[0] : trip.start_date.split('T')[0],
        color:   '#068cdf',
        data:    trip
      });
    }
  });

  // 2. Itinerary activities (from localStorage)
  trips.forEach(trip => {
    const raw = localStorage.getItem('itinerary_raw_'+trip.id);
    if (!raw) return;
    try {
      const days = JSON.parse(raw);
      if (!trip.start_date) return;
      days.forEach((day, di) => {
        const dayDate = new Date(trip.start_date);
        dayDate.setDate(dayDate.getDate() + di);
        const dateStr = dayDate.toISOString().split('T')[0];
        day.activities.forEach(act => {
          if (act.desc) {
            calEvents.push({
              type:   'itinerary',
              tripId: trip.id,
              title:  (act.time?act.time+' ':'')+act.desc,
              date:   dateStr,
              color:  '#22c55e',
              data:   { trip, day, act }
            });
          }
        });
      });
    } catch {}
  });

  // 3. Reminders
  try {
    const reminders = tripFilter==='all'
      ? await apiFetch('/reminders?done=false')
      : await apiFetch('/reminders?done=false&tripId='+tripFilter);
    reminders.forEach(r => {
      if (r.remind_at) {
        calEvents.push({
          type:   'reminder',
          tripId: r.trip_id,
          title:  '🔔 '+r.title,
          date:   r.remind_at.split('T')[0],
          time:   new Date(r.remind_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),
          color:  r.priority==='high'?'#ef4444':r.priority==='medium'?'#f97316':'#22c55e',
          data:   r
        });
      }
    });
  } catch {}
}

function getEventsForDate(dateStr) {
  return calEvents.filter(e => {
    if (e.endDate) {
      return dateStr >= e.date && dateStr <= e.endDate;
    }
    return e.date === dateStr;
  });
}

function renderCalendar() {
  const titleEl = document.getElementById('calTitle');
  const bodyEl  = document.getElementById('calBody');
  if (!bodyEl) return;

  if (calView==='month') renderMonthView(titleEl, bodyEl);
  else if (calView==='week') renderWeekView(titleEl, bodyEl);
  else renderDayView(titleEl, bodyEl);
}

// ── Month View ────────────────────────────────────────────────
function renderMonthView(titleEl, bodyEl) {
  const year  = calDate.getFullYear();
  const month = calDate.getMonth();
  const today = new Date().toISOString().split('T')[0];

  if (titleEl) titleEl.textContent = calDate.toLocaleDateString('en-US',{month:'long',year:'numeric'});

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build calendar using table for reliable equal-width columns
  const isDark = document.body.classList.contains('dark');
  const borderCol = isDark ? '#2d3748' : '#e8ecf0';
  const altBg     = isDark ? '#141824' : '#fafafa';
  const hoverBg   = isDark ? '#252d3d' : '#f8fafc';
  const baseBg    = isDark ? '#1a1f2e' : 'white';
  const textCol   = isDark ? '#f1f5f9' : '#063937';

  let html = `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:560px">
    <thead>
      <tr>${dayNames.map(d=>`<th style="padding:10px 4px;text-align:center;font-size:12px;font-weight:700;color:#64748b;background:${altBg};border-bottom:2px solid ${borderCol}">${d}</th>`).join('')}</tr>
    </thead>
    <tbody>`;

  let cells = [];
  // Empty cells before month
  for (let i=0; i<firstDay; i++) cells.push({empty:true, before:true});
  // Month days
  for (let d=1; d<=daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({ d, dateStr, isToday: dateStr===today, events: getEventsForDate(dateStr) });
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push({empty:true, after:true});

  // Build rows
  for (let r=0; r<cells.length/7; r++) {
    html += '<tr>';
    for (let c=0; c<7; c++) {
      const cell = cells[r*7+c];
      if (cell.empty) {
        html += `<td style="height:90px;background:${altBg};border:1px solid ${borderCol}"></td>`;
      } else {
        const maxShow = 2;
        html += `<td onclick="openDayDetail('${cell.dateStr}')"
          style="height:90px;vertical-align:top;padding:6px 6px;border:1px solid ${borderCol};cursor:pointer;background:${baseBg};transition:background 0.1s"
          onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${baseBg}'">
          <div style="display:flex;justify-content:center;margin-bottom:4px">
            <span style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:${cell.isToday?'700':'500'};background:${cell.isToday?'#068cdf':'transparent'};color:${cell.isToday?'white':textCol}">${cell.d}</span>
          </div>
          ${cell.events.slice(0,maxShow).map(e=>`<div style="background:${e.color};color:white;border-radius:4px;padding:2px 5px;font-size:10px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${e.title}">${e.title}</div>`).join('')}
          ${cell.events.length>maxShow?`<div style="font-size:10px;color:#64748b">+${cell.events.length-maxShow} more</div>`:''}
        </td>`;
      }
    }
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  bodyEl.innerHTML = html;
}

// ── Week View ─────────────────────────────────────────────────
function renderWeekView(titleEl, bodyEl) {
  const today = new Date().toISOString().split('T')[0];
  // Get start of week (Sunday)
  const startOfWeek = new Date(calDate);
  startOfWeek.setDate(calDate.getDate() - calDate.getDay());
  const days = Array.from({length:7}, (_,i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate()+i);
    return d;
  });

  if (titleEl) {
    titleEl.textContent = `${days[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${days[6].toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
  }

  const hours = Array.from({length:24},(_,i)=>i);
  let html = `
  <div style="display:grid;grid-template-columns:60px repeat(7,1fr);border-bottom:1px solid #e8ecf0">
    <div style="background:#f8fafc"></div>
    ${days.map(d => {
      const dateStr = d.toISOString().split('T')[0];
      const isToday = dateStr===today;
      return `<div style="padding:8px;text-align:center;background:${isToday?'#e8f4fd':'#f8fafc'};border-left:1px solid #e8ecf0">
        <div style="font-size:11px;color:#64748b;font-weight:600">${d.toLocaleDateString('en-US',{weekday:'short'})}</div>
        <div style="font-size:18px;font-weight:700;color:${isToday?'#068cdf':'#063937'}">${d.getDate()}</div>
      </div>`;
    }).join('')}
  </div>
  <div style="max-height:500px;overflow-y:auto">
    <div style="display:grid;grid-template-columns:60px repeat(7,1fr)">
      <div>
        ${hours.map(h=>`<div style="height:48px;padding:4px 8px;font-size:11px;color:#94a3b8;text-align:right;border-bottom:1px solid #f8fafc">${h===0?'12am':h<12?h+'am':h===12?'12pm':(h-12)+'pm'}</div>`).join('')}
      </div>
      ${days.map(d => {
        const dateStr = d.toISOString().split('T')[0];
        const dayEvents = getEventsForDate(dateStr);
        return `<div style="border-left:1px solid #e8ecf0;position:relative;min-height:${48*24}px" onclick="openDayDetail('${dateStr}')">
          ${hours.map(h=>`<div style="height:48px;border-bottom:1px solid #f8fafc"></div>`).join('')}
          ${dayEvents.map(e=>`
            <div style="position:absolute;left:2px;right:2px;top:${getEventTop(e)}px;background:${e.color};color:white;border-radius:4px;padding:3px 6px;font-size:11px;cursor:pointer;z-index:1;overflow:hidden" title="${e.title}" onclick="event.stopPropagation();openDayDetail('${dateStr}')">${e.title}</div>`).join('')}
        </div>`;
      }).join('')}
    </div>
  </div>`;

  bodyEl.innerHTML = html;
}

function getEventTop(e) {
  if (e.time) {
    const match = e.time.match(/(\d+):(\d+)\s*(am|pm)?/i);
    if (match) {
      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const ampm = match[3]?.toLowerCase();
      if (ampm==='pm' && h!==12) h+=12;
      if (ampm==='am' && h===12) h=0;
      return (h*60+m)*0.8; // 48px per hour = 0.8px per minute
    }
  }
  return 8*48; // default 8am
}

// ── Day View ──────────────────────────────────────────────────
function renderDayView(titleEl, bodyEl) {
  const dateStr = calDate.toISOString().split('T')[0];
  if (titleEl) titleEl.textContent = calDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

  const dayEvents = getEventsForDate(dateStr);
  const hours = Array.from({length:24},(_,i)=>i);

  let html = `<div style="display:grid;grid-template-columns:70px 1fr;max-height:600px;overflow-y:auto">`;
  hours.forEach(h => {
    const label = h===0?'12 AM':h<12?h+' AM':h===12?'12 PM':(h-12)+' PM';
    const hourEvents = dayEvents.filter(e => {
      if (!e.time) return h===8 && e.type==='trip';
      const match=e.time.match(/(\d+):(\d+)\s*(am|pm)?/i);
      if (!match) return false;
      let eh=parseInt(match[1]);
      const ampm=match[3]?.toLowerCase();
      if (ampm==='pm'&&eh!==12) eh+=12;
      if (ampm==='am'&&eh===12) eh=0;
      return eh===h;
    });
    html += `
    <div style="padding:8px;font-size:12px;color:#94a3b8;text-align:right;border-bottom:1px solid #f1f5f9;height:60px;display:flex;align-items:flex-start;justify-content:flex-end">${label}</div>
    <div style="border-left:2px solid #e8ecf0;border-bottom:1px solid #f1f5f9;padding:4px 8px;min-height:60px">
      ${hourEvents.map(e=>`
        <div style="background:${e.color};color:white;border-radius:6px;padding:6px 10px;margin-bottom:4px;font-size:13px">
          <strong>${e.title}</strong>
          ${e.data?.destination?`<div style="font-size:11px;opacity:0.85">Trip: ${e.data.destination}</div>`:''}
          ${e.data?.description?`<div style="font-size:11px;opacity:0.85">${e.data.description}</div>`:''}
        </div>`).join('')}
    </div>`;
  });
  html += '</div>';

  // Also show all-day events at top
  const allDay = dayEvents.filter(e=>e.type==='trip');
  if (allDay.length) {
    const allDayHtml = `<div style="padding:12px 16px;border-bottom:2px solid #e8ecf0;background:#f8fafc">
      <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px">ALL DAY</div>
      ${allDay.map(e=>`<div style="background:${e.color};color:white;border-radius:6px;padding:6px 12px;font-size:13px;margin-bottom:4px">${e.title}</div>`).join('')}
    </div>`;
    html = allDayHtml + html;
  }

  bodyEl.innerHTML = html;
}

// ── Day detail panel ──────────────────────────────────────────
function openDayDetail(dateStr) {
  const panel = document.getElementById('calDayDetail');
  const title = document.getElementById('calDayDetailTitle');
  const body  = document.getElementById('calDayDetailContent');
  if (!panel||!title||!body) return;

  const d = new Date(dateStr+'T12:00:00');
  title.textContent = d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

  const events = getEventsForDate(dateStr);
  if (!events.length) {
    body.innerHTML = '<p style="color:#94a3b8;font-size:14px">No events on this day.</p>';
  } else {
    const groups = {trip:[], itinerary:[], reminder:[]};
    events.forEach(e => groups[e.type]?.push(e));
    let html='';
    if (groups.trip.length) {
      html+=`<div style="margin-bottom:12px"><p style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px">✈️ TRIPS</p>
        ${groups.trip.map(e=>`<div style="background:#e8f4fd;border-left:3px solid #068cdf;padding:8px 12px;border-radius:0 6px 6px 0;margin-bottom:6px;cursor:pointer" onclick="openTripHub('${e.tripId}')">${e.title} <span style="font-size:11px;color:#068cdf">→ Open Trip</span></div>`).join('')}</div>`;
    }
    if (groups.itinerary.length) {
      html+=`<div style="margin-bottom:12px"><p style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px">📅 ITINERARY</p>
        ${groups.itinerary.map(e=>`<div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:8px 12px;border-radius:0 6px 6px 0;margin-bottom:6px;font-size:13px">${e.title}</div>`).join('')}</div>`;
    }
    if (groups.reminder.length) {
      html+=`<div style="margin-bottom:12px"><p style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px">🔔 REMINDERS</p>
        ${groups.reminder.map(e=>`<div style="background:#fff7ed;border-left:3px solid ${e.color};padding:8px 12px;border-radius:0 6px 6px 0;margin-bottom:6px;font-size:13px">${e.title}${e.time?`<span style="color:#94a3b8;margin-left:8px">${e.time}</span>`:''}</div>`).join('')}</div>`;
    }
    body.innerHTML=html;
  }

  panel.style.display='block';
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ============================================================
//  EDIT / DELETE FUNCTIONS FOR ALL ITEMS
// ============================================================

// ── BUDGET CATEGORY: Edit ─────────────────────────────────────
function openEditCategoryModal(catId, name, allocated, color) {
  window._editingCatId    = catId;
  window._editingCatColor = color;
  document.getElementById('editCatName').value   = name;
  document.getElementById('editCatAmount').value = allocated;
  // Pre-select color swatch
  document.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === color);
  });
  openModal('modalEditBudget');
}

async function saveEditCategory() {
  const name   = document.getElementById('editCatName').value.trim();
  const amount = parseFloat(document.getElementById('editCatAmount').value) || 0;
  const color  = document.querySelector('.color-swatch.selected')?.dataset.color || window._editingCatColor || '#068cdf';
  if (!name) { showToast('Please enter a category name'); return; }

  // Optimistically update local state
  if (tripBudget?.categories) {
    const cat = tripBudget.categories.find(c => c.category_id === window._editingCatId);
    if (cat) { cat.name = name; cat.allocated = amount; cat.color = color; }
  }
  if (allBudgets[currentTripId]?.categories) {
    const cat = allBudgets[currentTripId].categories.find(c => c.category_id === window._editingCatId);
    if (cat) { cat.name = name; cat.allocated = amount; cat.color = color; }
  }

  closeModal('modalEditBudget');
  showToast('Category updated!');

  // Refresh views
  if (document.getElementById('page-tripHub')?.classList.contains('active')) renderHubBudget();
  if (document.getElementById('page-budget')?.classList.contains('active')) {
    renderBudgetPage(document.getElementById('budgetTripFilter')?.value || 'all');
  }
}

// ── BUDGET CATEGORY: Delete from hub ─────────────────────────
async function deleteHubCategory(catId) {
  if (!confirm('Delete this category and all its expenses?')) return;
  if (tripBudget?.categories) {
    tripBudget.categories = tripBudget.categories.filter(c => c.category_id !== catId);
    if (tripBudget.expenses) tripBudget.expenses = tripBudget.expenses.filter(e => e.category_id !== catId);
  }
  renderHubBudget();
  showToast('Category deleted');
}

// ── EXPENSE: Edit ─────────────────────────────────────────────
function openEditExpenseModal(expId, desc, amount, catId) {
  window._editingExpId  = expId;
  window._editingExpCat = catId;
  document.getElementById('editExpDesc').value   = desc;
  document.getElementById('editExpAmount').value = amount;
  openModal('modalEditExpense');
}

async function saveEditExpense() {
  const desc   = document.getElementById('editExpDesc').value.trim();
  const amount = parseFloat(document.getElementById('editExpAmount').value);
  if (!desc || !amount) { showToast('Please fill in all fields'); return; }

  // Update local state optimistically
  const updateExp = arr => {
    if (!arr) return;
    const e = arr.find(e => e.id === window._editingExpId);
    if (e) { e.description = desc; e.amount = amount; }
  };
  updateExp(tripBudget?.expenses);
  updateExp(allBudgets[currentTripId]?.expenses);

  // Recalculate category spent
  if (tripBudget?.categories && tripBudget?.expenses) {
    tripBudget.categories.forEach(cat => {
      cat.spent = tripBudget.expenses
        .filter(e => e.category_id === cat.category_id)
        .reduce((s, e) => s + parseFloat(e.amount), 0);
    });
  }

  closeModal('modalEditExpense');
  showToast('Expense updated!');
  if (document.getElementById('page-tripHub')?.classList.contains('active')) renderHubBudget();
  if (document.getElementById('page-budget')?.classList.contains('active')) {
    renderBudgetPage(document.getElementById('budgetTripFilter')?.value || 'all');
  }
}

// ── CHECKLIST ITEM: Edit ──────────────────────────────────────
function openEditItemModal(itemId, label, clId) {
  window._editingItemId = itemId;
  window._editingItemCl = clId;
  document.getElementById('editItemLabel').value = label;
  openModal('modalEditItem');
}

async function saveEditItem() {
  const label = document.getElementById('editItemLabel').value.trim();
  if (!label) { showToast('Please enter a label'); return; }
  try {
    await apiFetch('/checklists/items/' + window._editingItemId, {
      method: 'PATCH', body: JSON.stringify({ label })
    });
    // Update all local state
    const updateItems = arr => {
      if (!arr) return;
      const item = arr.find(i => i.id === window._editingItemId);
      if (item) item.label = label;
    };
    tripChecklists.forEach(cl => updateItems(cl.items));
    Object.values(allChecklistsByTrip).forEach(cls => cls.forEach(cl => updateItems(cl.items)));

    closeModal('modalEditItem');
    showToast('Item updated!');
    if (document.getElementById('page-tripHub')?.classList.contains('active')) renderHubChecklists();
    if (document.getElementById('page-checklists')?.classList.contains('active')) {
      renderChecklistPage(document.getElementById('checklistTripFilter')?.value || 'all');
    }
  } catch(e) { showToast('Error: ' + e.message); }
}

// ── CHECKLIST ITEM: Delete ────────────────────────────────────
async function deleteChecklistItem(itemId, clId) {
  if (!confirm('Delete this item?')) return;
  try {
    await apiFetch('/checklists/items/' + itemId, { method: 'DELETE' });
  } catch {}
  // Remove from local state
  const removeItem = arr => {
    if (!arr) return;
    arr.forEach(cl => {
      if (cl.id === clId) cl.items = (cl.items || []).filter(i => i.id !== itemId);
    });
  };
  removeItem(tripChecklists);
  Object.values(allChecklistsByTrip).forEach(cls => removeItem(cls));

  showToast('Item deleted');
  if (document.getElementById('page-tripHub')?.classList.contains('active')) renderHubChecklists();
  if (document.getElementById('page-checklists')?.classList.contains('active')) {
    renderChecklistPage(document.getElementById('checklistTripFilter')?.value || 'all');
  }
}

// ── CHECKLIST: Edit title/icon ────────────────────────────────
function openEditChecklistModal(clId, title, icon) {
  window._editingClId = clId;
  document.getElementById('editClTitle').value = title;
  document.getElementById('editClIcon').value  = icon || '📋';
  openModal('modalEditChecklist');
}

async function saveEditChecklist() {
  const title = document.getElementById('editClTitle').value.trim();
  const icon  = document.getElementById('editClIcon').value || '📋';
  if (!title) { showToast('Please enter a title'); return; }

  const updateCl = arr => {
    if (!arr) return;
    const cl = arr.find(c => c.id === window._editingClId);
    if (cl) { cl.title = title; cl.icon = icon; }
  };
  updateCl(tripChecklists);
  Object.values(allChecklistsByTrip).forEach(cls => updateCl(cls));

  closeModal('modalEditChecklist');
  showToast('Checklist updated!');
  if (document.getElementById('page-tripHub')?.classList.contains('active')) renderHubChecklists();
  if (document.getElementById('page-checklists')?.classList.contains('active')) {
    renderChecklistPage(document.getElementById('checklistTripFilter')?.value || 'all');
  }
}

// Export all new functions
window.openEditCategoryModal  = openEditCategoryModal;
window.saveEditCategory       = saveEditCategory;
window.deleteHubCategory      = deleteHubCategory;
window.openEditExpenseModal   = openEditExpenseModal;
window.saveEditExpense        = saveEditExpense;
window.openEditItemModal      = openEditItemModal;
window.saveEditItem           = saveEditItem;
window.deleteChecklistItem    = deleteChecklistItem;
window.openEditChecklistModal = openEditChecklistModal;
window.saveEditChecklist      = saveEditChecklist;
