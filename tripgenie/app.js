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

// Pastel gradients complementing teal/blue color scheme
const DEST_PASTELS = [
  'linear-gradient(135deg, #b8d4e8 0%, #c8e6d4 100%)',
  'linear-gradient(135deg, #d4c5e8 0%, #b8d4e8 100%)',
  'linear-gradient(135deg, #c8e6d4 0%, #b8e8d4 100%)',
  'linear-gradient(135deg, #e8d4b8 0%, #d4e8c8 100%)',
  'linear-gradient(135deg, #b8c8e8 0%, #c8d4e8 100%)',
  'linear-gradient(135deg, #d4e8b8 0%, #b8d4c8 100%)',
  'linear-gradient(135deg, #e8c8d4 0%, #c8b8e8 100%)',
  'linear-gradient(135deg, #b8e8e8 0%, #b8d4e8 100%)',
];
function getPastelForDest(destination) {
  if (!destination) return DEST_PASTELS[0];
  let hash = 0;
  for (let i = 0; i < destination.length; i++) hash = destination.charCodeAt(i) + ((hash << 5) - hash);
  return DEST_PASTELS[Math.abs(hash) % DEST_PASTELS.length];
}
const DEST_IMAGES = {};
function getDestImage(destination) { return null; }

function getDestImage(destination) {
  if (!destination) return DEST_IMAGES.default;
  const key = destination.toLowerCase().split(',')[0].trim().replace(/\s+/g,'');
  for (const [k, v] of Object.entries(DEST_IMAGES)) {
    if (k !== 'default' && key.includes(k)) return v;
  }
  return DEST_IMAGES.default;
}

function showAILoading(text='✨ AI is thinking…', sub='This may take a moment') {
  const el = document.getElementById('aiLoadingOverlay');
  const t  = document.getElementById('aiLoadingText');
  const s  = document.getElementById('aiLoadingSub');
  if (el) el.style.display='flex';
  if (t)  t.textContent = text;
  if (s)  s.textContent = sub;
}
function hideAILoading() {
  const el = document.getElementById('aiLoadingOverlay');
  if (el) el.style.display='none';
}
window.showAILoading = showAILoading;
window.hideAILoading = hideAILoading;

function skeletonTripCards(n=3) {
  return Array(n).fill(0).map(()=>`
    <div class="skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line medium"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line short"></div>
      </div>
    </div>`).join('');
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
  // Show skeleton while loading
  const grid = document.getElementById('dashTripsGrid');
  if (grid) grid.innerHTML = skeletonTripCards(3);
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
  const hasCover  = !!trip.cover_image;
  const pastel    = getPastelForDest(trip.destination);
  const dates = trip.start_date
    ? `📅 ${fmtDate(trip.start_date)}${trip.end_date?' – '+fmtDate(trip.end_date):''}`
    : '📅 Dates not set';
  const coverHTML = hasCover
    ? `<div class="trip-img"><img src="${trip.cover_image}" alt="${trip.destination}" style="width:100%;height:100%;object-fit:cover"/></div>`
    : `<div class="trip-img" style="background:${pastel};display:flex;align-items:center;justify-content:center">
        <span style="font-size:36px;opacity:0.6">✈️</span>
      </div>`;
  return `
  <div class="trip-card" onclick="openTripHub('${trip.id}')" style="cursor:pointer;overflow:hidden;border-radius:16px">
    ${coverHTML}
    <div class="trip-body">
      <h3>${trip.destination}</h3>
      <p class="trip-dates">${dates}</p>
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
  // Cover image or pastel gradient
  const hubImg = document.getElementById('hubTripImg');
  const hubImgWrap = hubImg?.parentElement;
  if (trip.cover_image) {
    if (hubImg) { hubImg.src = trip.cover_image; hubImg.style.display = 'block'; }
  } else {
    if (hubImg) hubImg.style.display = 'none';
    if (hubImgWrap) hubImgWrap.style.background = getPastelForDest(trip.destination);
  }
  document.getElementById('hubTripNotes').textContent = trip.notes || 'No notes yet.';
  document.getElementById('hubTripStatus').textContent = trip.status.charAt(0).toUpperCase()+trip.status.slice(1);

  // Show itinerary — prefer DB value, fall back to localStorage
  const itinEl = document.getElementById('hubItinerary');
  if (itinEl) {
    const trip   = allTrips.find(t => t.id === tripId);
    const dbItinerary = trip?.itinerary;
    const dbHtml = dbItinerary?.html;
    const localHtml = localStorage.getItem('itinerary_'+tripId);
    const saved  = dbHtml || localHtml;
    if (dbItinerary?.days) {
      // Sync DB itinerary days to local state
      localStorage.setItem('itinerary_raw_'+tripId, JSON.stringify(dbItinerary.days));
    }
    if (saved) {
      itinEl.innerHTML = saved.includes('openManualItinerary') ? saved.replace(/<div[^>]*><button[^>]*openManualItinerary[^>]*>.*?<\/button><\/div>/s, '') : saved;
    } else {
      itinEl.innerHTML = '<p style="color:#64748b;font-size:14px">No itinerary yet. Click "✏️ Edit Itinerary" to write your own.</p>';
    }
  }

  // Show hub page
  if (typeof window.navigate === 'function') window.navigate('tripHub');
  else if (typeof navigate === 'function') navigate('tripHub');

  // Load trip data
  loadHubBudget();
  loadHubChecklists();
  loadHubReminders();
  loadHubNotes();

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
async function deleteChecklistFromHub(clId) {
  if (!confirm('Delete this checklist?')) return;
  try {
    await apiFetch('/checklists/'+clId, {method:'DELETE'});
    tripChecklists = tripChecklists.filter(c=>c.id!==clId);
    renderHubChecklists();
    showToast('Checklist deleted');
  } catch(e) { showToast('Error: '+e.message); }
}

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
    <div class="cl-card">
      <div class="cl-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">${cl.icon||'📋'}</span>
          <div>
            <strong class="cl-title">${cl.title}</strong>
            <p class="cl-meta">${done} of ${total} completed</p>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-primary small-btn" onclick="openAddItem('${cl.id}')">+ Item</button>
          <button class="btn-outline small-btn" onclick="openEditChecklistModal('${cl.id}','${cl.title}','${cl.icon||'📋'}')" title="Edit">✏️</button>
          <button class="btn-outline small-btn" style="color:#ef4444;border-color:#ef4444" onclick="deleteChecklistFromHub('${cl.id}')" title="Delete">🗑</button>
        </div>
      </div>
      <div class="progress-bar" style="margin:0;border-radius:0;height:3px"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="cl-items">
        ${items.map(item=>`
          <label class="cl-item ${item.is_checked?'cl-item-done':''}">
            <input type="checkbox" ${item.is_checked?'checked':''} onchange="toggleItem('${item.id}',this.checked,'${cl.id}')" style="accent-color:#068cdf;flex-shrink:0">
            <span class="cl-item-label">${item.label}</span>
            <button onclick="openEditItemModal('${item.id}','${item.label}','${cl.id}')" style="background:none;border:none;color:#068cdf;cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0" title="Edit">✏️</button>
            <button onclick="deleteChecklistItem('${item.id}','${cl.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0" title="Delete">🗑</button>
          </label>`).join('')}
        ${!items.length?'<p class="cl-empty">No items yet</p>':''}
      </div>
    </div>`;
  }).join('');
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

// ── Hub Notes + AI Tip ────────────────────────────────────────
async function loadHubNotes() {
  const trip = allTrips.find(t=>t.id===currentTripId);
  if (!trip) return;

  // Populate notes textarea
  const notesEl = document.getElementById('hubTripNotesEdit');
  if (notesEl) notesEl.value = trip.notes || '';

  const tipEl   = document.getElementById('hubAiTip');
  const tipText = document.getElementById('hubAiTipText');
  if (!tipEl || !tipText) return;

  // Skip AI tip for obviously fake/test destinations
  const dest = (trip.destination || '').toLowerCase().trim();
  const fakeNames = ['test','testing','asdf','qwerty','abc','123','hello','temp','sample','xxx','demo','trial'];
  const isFake = fakeNames.some(f => dest === f || dest.startsWith(f+' ') || dest.endsWith(' '+f)) || dest.length < 3;
  if (isFake) {
    tipEl.style.display = 'none';
    return;
  }

  // Check localStorage cache to avoid re-fetching
  const cached = localStorage.getItem('tg_tip_'+currentTripId);
  if (cached) {
    tipText.textContent = cached;
    tipEl.style.display = 'block';
    return;
  }

  try {
    const res = await apiFetch('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: `Give me ONE specific, practical insider travel tip for visiting ${trip.destination}.
Requirements:
- Must be about a REAL, specific place, area, or local practice in ${trip.destination}
- Something most tourists miss but locals know
- Max 2 sentences, direct and useful
- Do NOT start with "Sure", "Here's", or "Great" — just give the tip
- If you are not confident about ${trip.destination} being a real place, respond with exactly: SKIP`
      })
    });
    if (res.reply && res.reply.trim() !== 'SKIP' && res.reply.length > 20) {
      tipText.textContent = res.reply;
      tipEl.style.display = 'block';
      localStorage.setItem('tg_tip_'+currentTripId, res.reply);
    }
  } catch(e) {
    console.warn('AI tip failed:', e.message);
  }
}

async function saveTripNotes() {
  const notesEl = document.getElementById('hubTripNotesEdit');
  if (!notesEl) return;
  const notes = notesEl.value.trim();
  try {
    await apiFetch('/trips/'+currentTripId, {
      method: 'PATCH',
      body: JSON.stringify({ notes })
    });
    const trip = allTrips.find(t=>t.id===currentTripId);
    if (trip) trip.notes = notes;
    showToast('✅ Notes saved!');
  } catch(e) {
    showToast('Error saving notes: '+e.message);
  }
}
window.saveTripNotes = saveTripNotes;
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
  const budget  = parseFloat(document.getElementById('budgetAmount')?.value)||0;
  const currency = document.getElementById('budgetCurrency')?.value || getCurrency();

  const errs = [];
  if (!dest)  errs.push('📍 Please enter a destination');
  if (!start) errs.push('📅 Please select a start date');
  if (!end)   errs.push('📅 Please select an end date');
  if (start && end && new Date(end) < new Date(start)) errs.push('📅 End date must be after start date');
  if (errs.length) { showValidationErrors(errs); return; }

  let days = 3;
  if (start&&end) days=Math.max(1,Math.ceil((new Date(end)-new Date(start))/86400000));

  const startFmt = start ? new Date(start).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '';
  const endFmt   = end   ? new Date(end).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '';
  const budgetPerDay = budget>0 ? Math.round(budget/days) : 0;

  btn.innerHTML='⏳ Generating…'; btn.disabled=true;
  if (card) card.style.display='block';
  showAILoading('✨ Creating your AI itinerary…', `Building your ${days}-day ${dest} adventure`);

  try {
    // 1. Save trip first
    const trip = await apiFetch('/trips', {
      method:'POST', body:JSON.stringify({title:dest,destination:dest,start_date:start||null,end_date:end||null,notes})
    });
    if (budget>0) {
      await apiFetch('/budget/'+trip.id, {method:'POST',body:JSON.stringify({total_amount:budget,currency})});
    }
    allTrips.unshift(trip);
    currentTripId = trip.id;

    // 2. Build rich context-aware prompt
    const prompt = `You are TripGenie, an expert AI travel planner. Create a detailed ${days}-day itinerary for ${dest}.

TRIP DETAILS:
- Destination: ${dest}
- Travel dates: ${startFmt} to ${endFmt} (${days} days)
- Travel pace: ${pace} — ${pace==='Relaxed'?'fewer activities, more leisure and rest time':pace==='Intensive'?'pack in as many experiences as possible, early starts':'balanced mix of activities and downtime'}
- Interests: ${interests}
${budget>0 ? `- Total budget: ${currency} ${budget.toLocaleString()} (about ${currency} ${budgetPerDay.toLocaleString()} per day)` : ''}
${notes ? `- Special requirements: ${notes}` : ''}

RULES:
1. Use REAL, specific place names and restaurants in ${dest}
2. Match the ${pace} travel pace strictly
3. Center activities around: ${interests}
${budget>0 ? `4. Keep suggestions within ${currency} ${budgetPerDay.toLocaleString()}/day budget` : ''}
${notes ? `5. STRICTLY respect: ${notes}` : ''}

FORMAT (no markdown, no asterisks, exactly like this):
Day 1 — [Descriptive Theme]
🕘 9:00 AM - [Activity at specific place]
🕛 12:00 PM - [Lunch at specific restaurant]
🕒 3:00 PM - [Activity at specific place]
🕖 7:00 PM - [Dinner at specific restaurant]

Continue for all ${days} days with real ${dest} locations.`;

    const res = await apiFetch('/assistant/chat', {
      method:'POST', body:JSON.stringify({ message: prompt })
    });

    // 3. Parse itinerary
    const itinHTML = parseItinerary(res.reply, dest);
    const itinDays = parseItineraryToDays(res.reply);

    // 4. Save to DB
    try {
      await apiFetch('/trips/'+trip.id, {
        method:'PATCH',
        body:JSON.stringify({ itinerary: { days: itinDays, html: itinHTML } })
      });
      trip.itinerary = { days: itinDays, html: itinHTML };
    } catch(e) {
      localStorage.setItem('itinerary_'+trip.id, itinHTML);
    }

    // 5. Show trip hub
    renderMyTripsPage();
    renderDashboardStats();
    renderDashboardTrips();
    clearPlanForm();
    showToast('✅ Trip created with AI itinerary!');
    openTripHub(trip.id);

  } catch(e) {
    showToast('Error: '+e.message);
    console.error(e);
  } finally {
    btn.innerHTML='✨ Generate AI Itinerary'; btn.disabled=false;
    if (card) card.style.display='none';
    hideAILoading();
  }
}

// Parse AI reply into structured days for DB
function parseItineraryToDays(reply) {
  const lines = reply.split('\n').filter(l=>l.trim());
  const days = [];
  let currentDay = null;
  lines.forEach(line => {
    const l = line.trim().replace(/\*\*/g,'');
    if (l.match(/^day\s*\d+/i)) {
      if (currentDay) days.push(currentDay);
      currentDay = { title: l, activities: [] };
    } else if (l && currentDay) {
      currentDay.activities.push({ desc: l });
    }
  });
  if (currentDay) days.push(currentDay);
  return days;
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
  // Return clean HTML — Edit button is in the card header
  return html;
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
  <div class="cl-card">
    <div class="cl-header">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">${cl.icon||'📋'}</span>
        <div>
          <strong class="cl-title">${cl.title}</strong>
          <p class="cl-meta">${done} of ${total} completed</p>
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
    <div class="cl-items">
      ${items.map(item=>`
        <label class="cl-item ${item.is_checked?'cl-item-done':''}">
          <input type="checkbox" ${item.is_checked?'checked':''} onchange="togglePageItem('${item.id}',this.checked,'${cl.id}','${tripId}')" style="accent-color:#068cdf;flex-shrink:0">
          <span class="cl-item-label">${item.label}</span>
          <button onclick="openEditItemModal('${item.id}','${item.label}','${cl.id}')" style="background:none;border:none;color:#068cdf;cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0" title="Edit">✏️</button>
          <button onclick="deleteChecklistItem('${item.id}','${cl.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0" title="Delete">🗑</button>
        </label>`).join('')}
      ${!items.length?'<p class="cl-empty">No items yet</p>':''}
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
    // Update allChecklistsByTrip
    for (const tripId of Object.keys(allChecklistsByTrip)) {
      const cl = allChecklistsByTrip[tripId]?.find(c=>c.id===clId);
      if (cl) { cl.items=cl.items||[]; cl.items.push(item); break; }
    }
    // Update tripChecklists (hub)
    const cl2 = tripChecklists.find(c=>c.id===clId);
    if (cl2) { cl2.items=cl2.items||[]; cl2.items.push(item); }
    closeModal('modalAddItem');
    document.getElementById('newItemLabel').value='';
    showToast('Item added!');
    if (document.getElementById('page-checklists')?.classList.contains('active')) {
      filterChecklistByTrip();
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
let itineraryDays       = [];
let itineraryEditing    = false;
let itinerarySnapshot   = []; // backup for cancel

function openManualItinerary() {
  // Load from DB first (trip object), fallback to localStorage
  const trip = allTrips.find(t=>t.id===currentTripId);
  const dbDays = trip?.itinerary?.days;
  const localRaw = localStorage.getItem('itinerary_raw_'+currentTripId);

  if (dbDays && dbDays.length) {
    itineraryDays = JSON.parse(JSON.stringify(dbDays)); // deep clone
  } else if (localRaw) {
    try { itineraryDays = JSON.parse(localRaw); } catch { itineraryDays = []; }
  }

  // Clean up time fields — remove emoji clocks that AI adds (🕘, 🕛, etc.)
  itineraryDays.forEach(day => {
    day.activities = (day.activities || []).map(act => {
      let desc = act.desc || '';
      let time = act.time || '';
      // If desc starts with a time pattern like "🕘 9:00 AM - " extract it
      const timeMatch = desc.match(/^[🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚🕛🕜🕝🕞🕟🕠🕡🕢🕣🕤🕥🕦🕧]?\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]?\s*/i);
      if (timeMatch && !time) {
        time = timeMatch[1].trim();
        desc = desc.replace(timeMatch[0], '').trim();
      }
      // Strip leading emoji clocks from desc
      desc = desc.replace(/^[🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚🕛🕜🕝🕞🕟🕠🕡🕢🕣🕤🕥🕦🕧]\s*/, '').trim();
      return { time, desc };
    });
  });

  if (!itineraryDays.length) itineraryDays = [{ title:'Day 1', activities:[{time:'9:00 AM',desc:''}] }];

  // Save snapshot for cancel
  itinerarySnapshot = JSON.parse(JSON.stringify(itineraryDays));
  itineraryEditing = true;
  renderInPlaceEditor();
}

function closeManualItinerary() {
  itineraryEditing = false;
  // Restore snapshot (what was there before editing)
  const trip = allTrips.find(t=>t.id===currentTripId);
  const el = document.getElementById('hubItinerary');
  if (!el) return;
  const dbHtml = trip?.itinerary?.html;
  const localHtml = localStorage.getItem('itinerary_'+currentTripId);
  const saved = dbHtml || localHtml;
  if (saved) {
    el.innerHTML = saved.includes('openManualItinerary') ? saved :
      el.innerHTML = saved.replace(/<div[^>]*><button[^>]*openManualItinerary[^>]*>.*?<\/button><\/div>/s, '') || saved;
  } else {
    el.innerHTML = '<p style="color:#64748b;font-size:14px">No itinerary yet.</p>';
  }
  // Restore snapshot so cancel truly reverts
  itineraryDays = JSON.parse(JSON.stringify(itinerarySnapshot));
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

async function saveManualItinerary() {
  const rawHtml = itineraryDays.map(day=>`
    <div class="itinerary-day">
      <div class="itinerary-day-header">${day.title}</div>
      ${day.activities.map(act=>`
        <div class="itinerary-activity">${act.time?`<span>${act.time}</span>`:''} ${act.desc||'—'}</div>`).join('')}
    </div>`).join('');
  const html = rawHtml;

  // Save to DB (itinerary JSON + rendered HTML in notes)
  try {
    await apiFetch('/trips/'+currentTripId, {
      method: 'PATCH',
      body: JSON.stringify({ itinerary: { days: itineraryDays, html } })
    });
    // Also cache locally as fallback
    localStorage.setItem('itinerary_raw_'+currentTripId, JSON.stringify(itineraryDays));
    localStorage.setItem('itinerary_'+currentTripId, html);
  } catch(e) {
    // If API fails, still save locally
    localStorage.setItem('itinerary_raw_'+currentTripId, JSON.stringify(itineraryDays));
    localStorage.setItem('itinerary_'+currentTripId, html);
    showToast('Saved locally (sync failed)');
  }

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

// ============================================================
//  AI DESTINATION RECOMMENDER
// ============================================================
async function getDestinationReco() {
  const budget   = document.getElementById('recoBudget')?.value;
  const currency = document.getElementById('recoCurrency')?.value || 'PHP';
  const days     = document.getElementById('recoDays')?.value;
  const interests = [...document.querySelectorAll('.reco-interest.active')].map(b=>b.textContent.trim()).join(', ') || 'general travel';
  const resultsEl = document.getElementById('recoResults');

  if (!budget || !days) { showToast('Please enter your budget and number of days'); return; }

  resultsEl.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#068cdf" stroke-width="2" style="animation:spin 0.8s linear infinite;display:block;margin:0 auto 8px"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"/><path d="M21 12a9 9 0 00-9-9" stroke-linecap="round"/></svg>
    Finding the best destinations for you…
  </div>`;

  try {
    const res = await apiFetch('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: `You are a travel expert. Suggest exactly 3 destinations for this traveler.

TRAVELER PROFILE:
- Budget: ${currency} ${Number(budget).toLocaleString()} total
- Duration: ${days} days
- Interests: ${interests}

For each destination provide:
1. Destination name + country
2. Why it fits their budget and interests (1-2 sentences)
3. Estimated cost breakdown (flights, accommodation, food, activities)
4. Best time to visit
5. One must-do activity

FORMAT EXACTLY like this (use --- between destinations):
🌍 [Destination, Country]
✅ Why it fits: [reason]
💰 Budget breakdown: Flights ~${currency}X | Stay ~${currency}X/night | Food ~${currency}X/day | Activities ~${currency}X total
📅 Best time: [months]
⭐ Must do: [activity]
---
🌍 [Destination 2]
...
---
🌍 [Destination 3]
...

Be specific with real numbers based on the ${currency} ${budget} budget.`
      })
    });

    const destinations = res.reply.split('---').filter(d => d.trim());
    resultsEl.innerHTML = destinations.map((dest, i) => {
      const lines = dest.trim().split('\n').filter(l => l.trim());
      const title = lines[0] || `Destination ${i+1}`;
      const details = lines.slice(1).join('\n');
      return `
      <div style="border:1px solid #e8ecf0;border-radius:12px;padding:16px;margin-bottom:12px;background:white">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h3 style="font-size:16px;font-weight:700;color:#063937">${title}</h3>
          <button onclick="startPlanFromReco('${title.replace(/[🌍🌏🌎✈️]/g,'').trim()}')" class="btn-primary small-btn" style="white-space:nowrap;font-size:12px">Plan This Trip →</button>
        </div>
        <div style="font-size:13px;color:#475569;line-height:1.7;white-space:pre-line">${details}</div>
      </div>`;
    }).join('');
  } catch(e) {
    resultsEl.innerHTML = `<p style="color:#ef4444;font-size:14px">Error: ${e.message}</p>`;
  }
}

function startPlanFromReco(destination) {
  navigate('plantrip');
  setTimeout(() => {
    const destEl = document.getElementById('destination');
    if (destEl) { destEl.value = destination; destEl.focus(); }
  }, 100);
}
window.getDestinationReco = getDestinationReco;
window.startPlanFromReco  = startPlanFromReco;

// ============================================================
//  SMART REMINDER SUGGESTIONS
// ============================================================
async function openSmartReminders() {
  openModal('modalReminderSuggestions');
  const trip = allTrips.find(t=>t.id===currentTripId);
  if (!trip) return;

  const listEl = document.getElementById('reminderSuggestionsList');
  listEl.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8">Generating suggestions…</div>`;
  showAILoading('🔔 Generating smart reminders…', `Based on your ${destination} trip`);

  const startDate  = trip.start_date ? new Date(trip.start_date) : null;
  const daysUntil  = startDate ? Math.ceil((startDate - new Date()) / 86400000) : null;
  const destination = trip.destination;

  try {
    const res = await apiFetch('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: `You are a travel planning assistant. Generate smart reminder suggestions for this trip.

TRIP: ${destination}
${startDate ? `DEPARTURE: ${startDate.toDateString()} (${daysUntil} days away)` : ''}

Generate exactly 8 practical reminders a traveler should do before this trip.
Each reminder should have a specific recommended date relative to departure.

FORMAT EXACTLY (one per line, no intro text):
[emoji] [Task title] | [when to do it, e.g. "3 months before"] | [category: Flight/Hotel/Documents/Health/General/Money/Packing]

Examples:
✈️ Book flights | 3 months before | Flight
🏨 Reserve accommodation | 2 months before | Hotel
📄 Check visa requirements | 2 months before | Documents
💉 Get travel vaccinations | 6 weeks before | Health
🔔 Check in online | 24 hours before | Flight
🧳 Pack luggage | 2 days before | Packing
💳 Notify bank of travel | 1 week before | Money
📱 Download offline maps | 3 days before | General

Generate 8 reminders specific to traveling to ${destination}.`
      })
    });

    const lines = res.reply.split('\n').filter(l => l.includes('|'));
    window._reminderSuggestions = [];

    listEl.innerHTML = lines.map((line, i) => {
      const parts = line.split('|').map(p => p.trim());
      const title = parts[0] || line.trim();
      const when  = parts[1] || 'Before trip';
      const cat   = parts[2] || 'General';

      // Calculate actual date from "X months/weeks/days before"
      let remindDate = null;
      if (startDate) {
        const match = when.match(/(\d+)\s*(month|week|day|hour)/i);
        if (match) {
          const n = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          remindDate = new Date(startDate);
          if (unit.startsWith('month')) remindDate.setMonth(remindDate.getMonth() - n);
          else if (unit.startsWith('week')) remindDate.setDate(remindDate.getDate() - n*7);
          else if (unit.startsWith('day'))  remindDate.setDate(remindDate.getDate() - n);
          else if (unit.startsWith('hour')) remindDate.setHours(remindDate.getHours() - n);
        }
      }

      window._reminderSuggestions.push({ title, when, cat, remindDate });

      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e8ecf0;border-radius:8px;cursor:pointer;transition:all 0.15s" id="remSug_${i}" onclick="toggleReminderSug(${i})">
        <div style="width:20px;height:20px;border-radius:50%;border:2px solid #e8ecf0;flex-shrink:0;display:flex;align-items:center;justify-content:center" id="remSugCheck_${i}"></div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:500;color:#063937">${title}</div>
          <div style="font-size:12px;color:#94a3b8">${when} · ${cat}</div>
        </div>
        <button onclick="event.stopPropagation();addSingleReminder(${i})" style="font-size:12px;padding:4px 10px;border-radius:6px;border:1.5px solid #068cdf;color:#068cdf;background:white;cursor:pointer;white-space:nowrap;font-family:inherit">+ Add</button>
      </div>`;
    }).join('');

    // Add "Add All" button
    listEl.innerHTML += `<button onclick="addAllReminders()" class="btn-primary" style="width:100%;margin-top:8px">+ Add All Reminders</button>`;
    hideAILoading();
  } catch(e) {
    hideAILoading();
    listEl.innerHTML = `<p style="color:#ef4444">Error: ${e.message}</p>`;
  }
}

function toggleReminderSug(i) {
  const el    = document.getElementById(`remSug_${i}`);
  const check = document.getElementById(`remSugCheck_${i}`);
  const active = el.style.background === 'rgb(232, 244, 253)';
  el.style.background    = active ? 'white' : '#e8f4fd';
  el.style.borderColor   = active ? '#e8ecf0' : '#068cdf';
  check.innerHTML        = active ? '' : '✓';
  check.style.background = active ? 'white' : '#068cdf';
  check.style.color      = 'white';
  check.style.borderColor= active ? '#e8ecf0' : '#068cdf';
  check.style.fontSize   = '11px';
}

async function addSingleReminder(i) {
  const s = window._reminderSuggestions[i];
  if (!s) return;
  const remind_at = s.remindDate ? s.remindDate.toISOString() : new Date(Date.now()+86400000*7).toISOString();
  try {
    await apiFetch('/reminders', { method:'POST', body:JSON.stringify({
      title: s.title, remind_at, priority:'medium', category: s.cat, trip_id: currentTripId||null
    })});
    showToast('✅ Reminder added!');
  } catch(e) { showToast('Error: '+e.message); }
}

async function addAllReminders() {
  const sugs = window._reminderSuggestions || [];
  let added = 0;
  for (const s of sugs) {
    const remind_at = s.remindDate ? s.remindDate.toISOString() : new Date(Date.now()+86400000*7).toISOString();
    try {
      await apiFetch('/reminders', { method:'POST', body:JSON.stringify({
        title: s.title, remind_at, priority:'medium', category: s.cat, trip_id: currentTripId||null
      })});
      added++;
    } catch(e) {}
  }
  showToast(`✅ Added ${added} reminders!`);
  closeModal('modalReminderSuggestions');
}
window.openSmartReminders  = openSmartReminders;
window.toggleReminderSug   = toggleReminderSug;
window.addSingleReminder   = addSingleReminder;
window.addAllReminders     = addAllReminders;

// ============================================================
//  AI PACKING LIST
// ============================================================
async function openAIPackingList() {
  openModal('modalPackingList');
  const trip = allTrips.find(t=>t.id===currentTripId);
  if (!trip) return;
  const el = document.getElementById('packingListContent');
  el.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8">Generating packing list…</div>`;
  showAILoading('🧳 Generating your packing list…', `Customized for ${trip.destination}`);

  const days = trip.start_date && trip.end_date
    ? Math.ceil((new Date(trip.end_date)-new Date(trip.start_date))/86400000) : 7;

  try {
    const res = await apiFetch('/assistant/chat', {
      method:'POST', body:JSON.stringify({
        message:`Generate a practical packing list for a ${days}-day trip to ${trip.destination}.
${trip.notes ? `Trip notes: ${trip.notes}` : ''}
Group by category. Each item on its own line starting with - 
Use these exact category headers:
👕 Clothing
🧴 Toiletries
📄 Documents & Money
💊 Health & Safety
🔌 Electronics
🧳 Miscellaneous
Keep it practical — no luxury or unnecessary items.`
      })
    });

    // Parse into categories and items
    window._packingItems = [];
    const lines = res.reply.split('\n');
    let currentCat = '';
    let html = '';

    lines.forEach(line => {
      const l = line.trim();
      if (!l) return;
      if (l.match(/^[👕🧴📄💊🔌🧳]/)) {
        if (currentCat) html += '</div>';
        currentCat = l;
        html += `<div style="margin-bottom:14px">
          <div style="font-size:13px;font-weight:700;color:#063937;margin-bottom:6px;padding:4px 0;border-bottom:1px solid #f0f4f8">${l}</div>
          <div>`;
      } else if (l.startsWith('-')) {
        const item = l.replace(/^-\s*/, '').trim();
        const idx  = window._packingItems.length;
        window._packingItems.push({ item, cat: currentCat, checked: true });
        html += `<label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;font-size:13px">
          <input type="checkbox" checked id="packItem_${idx}" style="accent-color:#068cdf">
          <span>${item}</span>
        </label>`;
      }
    });
    if (currentCat) html += '</div></div>';
    el.innerHTML = html || '<p style="color:#94a3b8">Could not generate list. Try again.</p>';
    hideAILoading();
  } catch(e) {
    hideAILoading();
    el.innerHTML = `<p style="color:#ef4444">Error: ${e.message}</p>`;
  }
}

async function addPackingListToChecklist() {
  const items = (window._packingItems || []).filter((_, i) => document.getElementById(`packItem_${i}`)?.checked);
  if (!items.length) { showToast('Select at least one item'); return; }

  try {
    // Create a new checklist
    const cl = await apiFetch('/checklists', {
      method:'POST', body:JSON.stringify({ trip_id: currentTripId, title:'Packing List', icon:'🧳' })
    });
    cl.items = [];
    // Add all items
    for (const i of items) {
      const item = await apiFetch(`/checklists/${cl.id}/items`, {
        method:'POST', body:JSON.stringify({ label: i.item })
      });
      cl.items.push(item);
    }
    // Update local state
    tripChecklists.unshift(cl);
    if (!allChecklistsByTrip[currentTripId]) allChecklistsByTrip[currentTripId]=[];
    allChecklistsByTrip[currentTripId].unshift(cl);
    renderHubChecklists();
    closeModal('modalPackingList');
    showToast(`✅ Added ${items.length} items to Packing List checklist!`);
  } catch(e) { showToast('Error: '+e.message); }
}
window.openAIPackingList         = openAIPackingList;
window.addPackingListToChecklist = addPackingListToChecklist;

// ============================================================
//  CURRENCY CONVERTER
// ============================================================
let _exchangeRates = null;

async function convertCurrency() {
  const amount = parseFloat(document.getElementById('convAmount')?.value) || 0;
  const from   = document.getElementById('convFrom')?.value || 'PHP';
  const to     = document.getElementById('convTo')?.value || 'USD';
  const resEl  = document.getElementById('convResult');
  const rateEl = document.getElementById('convRate');

  if (!amount) { if(resEl) resEl.textContent = '—'; return; }

  try {
    if (!_exchangeRates || _exchangeRates._base !== from) {
      const r = await fetch(`https://api.frankfurter.app/latest?from=${from}`);
      const d = await r.json();
      _exchangeRates = { ...d.rates, [from]: 1, _base: from };
    }
    const rate = _exchangeRates[to];
    if (!rate) return;
    const converted = (amount * rate).toFixed(2);
    const symbols = {USD:'$',PHP:'₱',EUR:'€',GBP:'£',JPY:'¥',SGD:'S$',KRW:'₩',AUD:'A$',THB:'฿'};
    if(resEl) resEl.textContent = `${symbols[to]||''}${Number(converted).toLocaleString()}`;
    if(rateEl) rateEl.textContent = `1 ${from} = ${rate.toFixed(4)} ${to} · Live rate`;
  } catch(e) {
    if(resEl) resEl.textContent = 'Error fetching rates';
  }
}
window.convertCurrency = convertCurrency;

// ============================================================
//  PDF TRIP SUMMARY
// ============================================================
async function downloadTripPDF() {
  const trip = allTrips.find(t=>t.id===currentTripId);
  if (!trip) { showToast('No trip loaded'); return; }
  showToast('📄 Generating PDF…');

  // Gather data
  const budget      = tripBudget;
  const checklists  = tripChecklists;
  const reminders   = tripReminders;
  const itinerary   = trip.itinerary?.html || localStorage.getItem('itinerary_'+currentTripId) || '';
  const notes       = document.getElementById('hubTripNotesEdit')?.value || trip.notes || '';
  const aiTip       = localStorage.getItem('tg_tip_'+currentTripId) || '';

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—';
  const days    = trip.start_date && trip.end_date
    ? Math.ceil((new Date(trip.end_date)-new Date(trip.start_date))/86400000) : '—';

  const currency = budget?.currency || getCurrency();
  const sym = {USD:'$',PHP:'₱',EUR:'€',GBP:'£',JPY:'¥',AUD:'A$',SGD:'S$',KRW:'₩'}[currency]||'$';
  const fmt = n => sym + Number(n||0).toLocaleString();

  // Build budget section
  let budgetHTML = '';
  if (budget) {
    const spent = budget.categories?.reduce((s,c)=>s+(parseFloat(c.spent)||0),0)||0;
    budgetHTML = `
    <div class="pdf-section">
      <h2>💰 Budget Summary</h2>
      <div class="budget-row"><span>Total Budget</span><strong>${fmt(budget.total_amount)}</strong></div>
      <div class="budget-row"><span>Total Spent</span><strong>${fmt(spent)}</strong></div>
      <div class="budget-row"><span>Remaining</span><strong style="color:${spent>budget.total_amount?'#ef4444':'#22c55e'}">${fmt(budget.total_amount-spent)}</strong></div>
      ${(budget.categories||[]).map(c=>`<div class="budget-row cat-row"><span>${c.name}</span><span>${fmt(c.spent||0)} / ${fmt(c.allocated)}</span></div>`).join('')}
    </div>`;
  }

  // Build checklist section
  let checkHTML = '';
  if (checklists.length) {
    checkHTML = `<div class="pdf-section"><h2>✅ Checklists</h2>` +
      checklists.map(cl => {
        const items = cl.items||[];
        const done  = items.filter(i=>i.is_checked).length;
        return `<div class="cl-pdf"><strong>${cl.icon||'📋'} ${cl.title}</strong> <span class="cl-badge">${done}/${items.length}</span>
          <ul>${items.map(i=>`<li class="${i.is_checked?'done':''}">${i.is_checked?'☑':'☐'} ${i.label}</li>`).join('')}</ul></div>`;
      }).join('') + '</div>';
  }

  // Build reminders section
  let remHTML = '';
  if (reminders.length) {
    remHTML = `<div class="pdf-section"><h2>🔔 Reminders</h2><ul>` +
      reminders.map(r=>`<li class="${r.is_done?'done':''}">${r.is_done?'☑':'☐'} <strong>${r.title}</strong> · ${new Date(r.remind_at).toLocaleDateString()}</li>`).join('') +
      '</ul></div>';
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>TripGenie — ${trip.destination}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:white;padding:0}
    .cover{background:linear-gradient(135deg,#063937 0%,#0a4a6e 50%,#068cdf 100%);color:white;padding:48px 40px;position:relative}
    .cover-logo{font-size:14px;font-weight:700;letter-spacing:0.1em;opacity:0.7;margin-bottom:32px}
    .cover h1{font-size:40px;font-weight:800;margin-bottom:8px;letter-spacing:-1px}
    .cover .meta{font-size:16px;opacity:0.8;margin-bottom:4px}
    .cover .badge{display:inline-block;background:rgba(255,255,255,0.15);padding:4px 12px;border-radius:20px;font-size:13px;margin-top:12px;text-transform:capitalize}
    .content{padding:32px 40px}
    .pdf-section{margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e2eaf3}
    .pdf-section:last-child{border-bottom:none}
    h2{font-size:16px;font-weight:700;color:#063937;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .budget-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f4f8;font-size:14px}
    .cat-row{padding-left:16px;color:#475569;font-size:13px}
    .cl-pdf{margin-bottom:12px}
    .cl-pdf strong{font-size:14px;color:#063937}
    .cl-badge{background:#e8f4fd;color:#068cdf;font-size:11px;padding:2px 8px;border-radius:20px;margin-left:6px}
    ul{list-style:none;margin-top:8px;padding-left:8px}
    li{font-size:13px;padding:4px 0;color:#475569;border-bottom:1px solid #f8fafc}
    li.done{color:#94a3b8;text-decoration:line-through}
    .itin-html .itinerary-day{margin-bottom:16px;border:1px solid #e2eaf3;border-radius:8px;overflow:hidden}
    .itin-html .itinerary-day-header{background:#e8f4fd;padding:8px 14px;font-weight:700;color:#063937;font-size:14px}
    .itin-html .itinerary-activity{padding:6px 14px;font-size:13px;color:#475569;border-bottom:1px solid #f0f4f8}
    .itin-html .itinerary-activity:last-child{border-bottom:none}
    .notes-box{background:#f8fafc;border-radius:8px;padding:14px 16px;font-size:13px;color:#475569;line-height:1.7;white-space:pre-wrap}
    .ai-tip{background:linear-gradient(135deg,rgba(6,57,55,0.04),rgba(6,140,223,0.04));border:1px solid rgba(6,140,223,0.2);border-radius:8px;padding:14px 16px;font-size:13px;color:#475569;line-height:1.65}
    .footer{text-align:center;padding:20px;color:#94a3b8;font-size:11px;border-top:1px solid #e2eaf3;margin-top:20px}
    @media print{.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <div class="cover">
    <div class="cover-logo">🧞 TRIPGENIE</div>
    <h1>${trip.destination}</h1>
    <div class="meta">📅 ${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)}</div>
    ${days !== '—' ? `<div class="meta">⏱️ ${days} days</div>` : ''}
    <div class="badge">${trip.status||'upcoming'}</div>
  </div>
  <div class="content">
    ${itinerary ? `<div class="pdf-section"><h2>📅 Itinerary</h2><div class="itin-html">${itinerary.replace(/<button[^>]*>.*?<\/button>/gs,'')}</div></div>` : ''}
    ${budgetHTML}
    ${checkHTML}
    ${remHTML}
    ${notes ? `<div class="pdf-section"><h2>📝 Notes</h2><div class="notes-box">${notes}</div></div>` : ''}
    ${aiTip ? `<div class="pdf-section"><h2>🧞 AI Travel Tip</h2><div class="ai-tip">${aiTip}</div></div>` : ''}
  </div>
  <div class="footer">Generated by TripGenie · ${new Date().toLocaleDateString()}</div>
  <script>window.onload=()=>{window.print();}</script>
  </body></html>`;

  const blob = new Blob([html], { type:'text/html' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) showToast('Please allow popups to download the PDF');
}
window.downloadTripPDF = downloadTripPDF;
