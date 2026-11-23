/* ===== SETTINGS: edit these ===== */
const API_URL = "https://blzljjlt63.execute-api.ap-southeast-1.amazonaws.com";
const PHOTO_BASE = "photos/";
const STAFF_URL = "";      // address of the staff page on EC2. Empty = no Staff link shown.
const SHOP_ADDRESS = "Via della Moda, Milano";
const SHOP_HOURS = "Monday–Friday: 10 AM–7 PM | Saturday–Sunday: 10 AM–8 PM";

const SAMPLE = [];

const $ = id => document.getElementById(id);
const view = $("view"), count = $("count"), dlg = $("dlg"), form = $("form"), done = $("done"), err = $("err"), go = $("go");
let current = null, lastFocus = null;

$("addr").textContent = SHOP_ADDRESS;
$("hours").textContent = SHOP_HOURS;
if (STAFF_URL){ $("staff").href = STAFF_URL; $("staff").hidden = false; }

const peso = n => "₱" + Number(n).toLocaleString("en-PH");
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function skeleton(){
  view.setAttribute("aria-busy","true"); view.innerHTML = "";
  const g = el("div","grid");
  for (let i=0;i<6;i++) g.appendChild(el("div","skel"));
  view.appendChild(g);
}

function message(title, text, retry){
  view.setAttribute("aria-busy","false"); view.innerHTML = ""; count.textContent = "";
  const n = el("div","note");
  n.appendChild(el("h3",null,title));
  n.appendChild(el("p",null,text));
  if (retry){ const b = el("button","btn","Try again"); b.onclick = load; n.appendChild(b); }
  view.appendChild(n);
}

function card(it){
  const taken = it.status !== "available";
  const li = el("li", taken ? "taken" : "");
  const ph = el("div","photo");
  const fallback = () => ph.appendChild(el("span","ph",(it.name||"?").charAt(0).toUpperCase()));
  if (it.photo){
    const img = el("img"); img.src = PHOTO_BASE + encodeURIComponent(it.photo); img.alt = it.name; img.loading = "lazy";
    img.onerror = () => { img.remove(); fallback(); };
    ph.appendChild(img);
  } else fallback();
    const meta = el("div","meta");
    meta.append(el("h3","name",it.name), el("p","price",peso(it.price)));
    const b = el("button","btn", taken ? "Taken" : "Reserve");
    if (taken) b.disabled = true;
    else { b.setAttribute("aria-label","Reserve " + it.name); b.onclick = () => openDlg(it, b); }
    li.append(ph, meta, b);
    return li;
  }

  function render(items){
    view.setAttribute("aria-busy","false"); view.innerHTML = "";
    if (!items.length){ message("Nothing on the rack yet","New pieces go up every Friday at 7:00 PM."); return; }
    items.sort((a,b) => (a.status==="available"?0:1) - (b.status==="available"?0:1));
    const g = el("ul","grid");
    items.forEach(it => g.appendChild(card(it)));
    view.appendChild(g);
    heroPhoto(items);
    const open = items.filter(i => i.status==="available").length;
    count.textContent = open + " of " + items.length + " available";
  }

  async function load(){
    skeleton();
    try{
      if (!API_URL){ await new Promise(r => setTimeout(r,400)); render(SAMPLE.map(x => ({...x}))); return; }
      const r = await fetch(API_URL + "/items");
      if (!r.ok) throw new Error(r.status);
      render(await r.json());
    }catch(e){
      message("Couldn’t load the pieces","Check your connection and try again.", true);
    }
  }

  function openDlg(it, btn){
    current = it; lastFocus = btn;
    $("dsub").textContent = it.name + " · " + peso(it.price) + ". Pay at the shop within 2 days.";
    form.hidden = false; done.hidden = true; err.textContent = ""; go.disabled = false; go.textContent = "Reserve";
    dlg.showModal(); $("who").focus();
  }
  function closeDlg(){ dlg.close(); if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("who").value.trim(), contact = $("tel").value.trim();
    if (!name || !contact){ err.textContent = "Enter your name and contact number so the shop knows who’s coming."; return; }
    if (contact.replace(/\D/g,"").length < 7){ err.textContent = "Enter a valid contact number."; return; }
    err.textContent = ""; go.disabled = true; go.textContent = "Reserving…";
    try{
      let until = Date.now() + 2*24*60*60*1000;
      if (API_URL){
        const r = await fetch(API_URL + "/items/" + encodeURIComponent(current.itemId) + "/reserve", {
          method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name, contact})
        });
        if (r.status === 409){ err.textContent = "Sorry, someone just reserved this piece."; go.textContent = "Taken"; load(); return; }
        if (!r.ok) throw new Error(r.status);
    const data = await r.json().catch(() => ({}));

  if (data.reservedUntil) until = data.reservedUntil * 1000;
const reservations = JSON.parse(
  localStorage.getItem("riusoReservations") || "[]"
);

// Avoid saving the same item more than once.
const alreadySaved = reservations.some(
  item => item.id === current.itemId
);

if (!alreadySaved) {
  reservations.push({
    id: current.itemId,
    name: current.name,
    price: Number(current.price),
    image: PHOTO_BASE + encodeURIComponent(current.photo),
    status: "reserved",
    reservedAt: data.item?.reservedAt
      ? data.item.reservedAt * 1000
      : Date.now()
  });

  localStorage.setItem(
    "riusoReservations",
    JSON.stringify(reservations)
  );
}
    }
    const when = new Date(until).toLocaleString("en-PH",{weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});
    $("donemsg").textContent = current.name + " is held for " + name + ". Pay at the shop by " + when + ", or it goes back on the rack.";
    form.hidden = true; done.hidden = false; $("close").focus();
    load();
  }catch(e2){
    err.textContent = "Couldn’t reserve right now. Try again.";
    go.disabled = false; go.textContent = "Reserve";
  }
});
$("cancel").onclick = closeDlg;
$("close").onclick = closeDlg;
dlg.addEventListener("click", e => { if (e.target === dlg) closeDlg(); });

/* ===== countdown to the Friday 7:00 PM drop (Philippine time, UTC+8) ===== */
const OFFSET = 8*3600e3, HOUR = 3600e3, DAY = 24*HOUR;
function dropTime(now){
  const m = new Date(now + OFFSET);
  const add = (5 - m.getUTCDay() + 7) % 7;
  let t = Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate() + add, 19, 0, 0) - OFFSET;
  const live = t <= now && now - t < HOUR;
  if (t <= now && !live) t += 7*DAY;
  return {t, live};
}
const pad = n => String(n).padStart(2,"0");
function tick(){
  const now = Date.now(), {t, live} = dropTime(now);
  $("clock").hidden = live;
  $("dl").textContent = live ? "The new drop is live. Browse this week’s pieces now." : "Next drop, Friday at 7:00 PM";
  if (live) return;
  let s = Math.max(0, Math.floor((t - now) / 1000));
  $("cd").textContent = Math.floor(s / 86400); s %= 86400;
  $("ch").textContent = pad(Math.floor(s / 3600)); s %= 3600;
  $("cm").textContent = pad(Math.floor(s / 60));
  $("cs").textContent = pad(s % 60);
}
tick(); setInterval(tick, 1000);

/* Keep the original hero image */
function heroPhoto(items) {
  // Original hero.jpg will remain unchanged.
}

load();