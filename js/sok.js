// Søk, filtre og sortering – og filterpanelet på mobil.

// ========== ELEMENTER I SØK OG FILTER ==========
const sokefelt = document.getElementById("sokefelt");
const skjulSolgte = document.getElementById("skjul-solgte");
const prisMin = document.getElementById("pris-min");
const prisMax = document.getElementById("pris-max");
const prisfilterFeil = document.getElementById("prisfilter-feil");
const byFilter = document.getElementById("by-filter");
const sorteringValg = document.getElementById("sortering");
const nullstillFiltreKnapp = document.getElementById("nullstill-filtre");
const filterMerke = document.getElementById("filter-merke");
const visResultaterKnapp = document.getElementById("vis-resultater");
const tilstandBokser = () => document.querySelectorAll('input[name="tilstand-filter"]');
const filterpanel = document.getElementById("filterpanel");

// ========== BY-LISTEN I FILTERET ==========
// Lager listen over byer ut fra annonsene som finnes
function byggByvalg() {
  const valgt = byFilter.value;
  const byer = new Map(); // nøkkel (små bokstaver) → navn som vises
  const harStorForbokstav = s => s[0] === s[0].toLocaleUpperCase("nb");
  for (const a of annonser) {
    const navn = String(a.by ?? "").trim();
    if (!navn) continue;
    const nokkel = bynokkel(navn);
    const eksisterende = byer.get(nokkel);
    // Foretrekk skrivemåten med stor forbokstav («Oslo» framfor «oslo»)
    if (!eksisterende || (!harStorForbokstav(eksisterende) && harStorForbokstav(navn))) {
      byer.set(nokkel, navn);
    }
  }
  const sortert = [...byer.entries()].sort((a, b) => a[1].localeCompare(b[1], "nb"));
  byFilter.innerHTML = '<option value="">Alle byer</option>' +
    sortert.map(([nokkel, navn]) => `<option value="${trygg(nokkel)}">${trygg(navn)}</option>`).join("");
  byFilter.value = byer.has(valgt) ? valgt : "";
}

// ========== LESE FILTRENE ==========
// Tom tekst → null (ingen grense). Ugyldig tekst → NaN.
function tolkFilterPris(tekst) {
  const renset = String(tekst).replace(/\s/g, "").replace(/kr\.?$/i, "").replace(",", ".");
  if (renset === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(renset)) return NaN;
  return Number(renset);
}

function lesFiltre() {
  const min = tolkFilterPris(prisMin.value);
  const max = tolkFilterPris(prisMax.value);
  const tilstander = [...tilstandBokser()].filter(b => b.checked).map(b => b.value);
  const by = byFilter.value;
  return { min, max, tilstander, by, skjulSolgte: skjulSolgte.checked };
}

// Viser feilmelding under prisfeltene hvis noe er galt
function sjekkPrisfilter(f) {
  let tekst = "";
  prisMin.removeAttribute("aria-invalid");
  prisMax.removeAttribute("aria-invalid");
  if (Number.isNaN(f.min) || Number.isNaN(f.max)) {
    tekst = "Skriv prisen som et tall, for eksempel 300.";
    if (Number.isNaN(f.min)) prisMin.setAttribute("aria-invalid", "true");
    if (Number.isNaN(f.max)) prisMax.setAttribute("aria-invalid", "true");
  } else if (f.min !== null && f.max !== null && f.min > f.max) {
    tekst = "«Fra»-prisen kan ikke være høyere enn «Til»-prisen.";
    prisMin.setAttribute("aria-invalid", "true");
    prisMax.setAttribute("aria-invalid", "true");
  }
  prisfilterFeil.textContent = tekst;
}

// Teller hvor mange filtre som er i bruk (skjul solgte, pris, tilstand, by)
function antallAktiveFiltre(f) {
  let antall = 0;
  if (f.skjulSolgte) antall++;
  if (Number.isFinite(f.min) || Number.isFinite(f.max)) antall++;
  if (f.tilstander.length) antall++;
  if (f.by) antall++;
  return antall;
}

// Er noe skrevet eller valgt i filtrene (også ugyldig tekst)?
function harFilterInnhold() {
  return skjulSolgte.checked || prisMin.value.trim() !== "" || prisMax.value.trim() !== "" ||
    [...tilstandBokser()].some(b => b.checked) || byFilter.value !== "";
}

function nullstillFiltre() {
  skjulSolgte.checked = false;
  prisMin.value = "";
  prisMax.value = "";
  tilstandBokser().forEach(b => (b.checked = false));
  byFilter.value = "";
}

function nullstillSokOgFiltre() {
  sokefelt.value = "";
  nullstillFiltre();
}

// ========== HENDELSER: SØK, FILTRE OG SORTERING ==========
// Søk mens du skriver (fra detaljvisningen går du tilbake til listen)
sokefelt.addEventListener("input", () => {
  visListeDirekte();
  visAnnonser();
});

// Alle endringer i filterpanelet oppdaterer listen med en gang
filterpanel.addEventListener("input", visAnnonser);
filterpanel.addEventListener("change", visAnnonser);

sorteringValg.addEventListener("change", visAnnonser);

nullstillFiltreKnapp.addEventListener("click", () => {
  nullstillFiltre();
  visAnnonser();
});

// ========== FILTERPANEL PÅ MOBIL ==========
const filtrerKnapp = document.getElementById("filtrer-knapp");
const mobilvisning = window.matchMedia("(max-width: 760px)");

function filterErApent() {
  return filterpanel.classList.contains("apen");
}

// Gjør alt utenfor panelet «inert» (eller vanlig igjen). Da kan verken Tab-tasten
// eller skjermlesere havne på annonsene bak panelet mens det er åpent.
function settSidenBakInert(inert) {
  for (let el = filterpanel; el !== document.body; el = el.parentElement) {
    for (const annet of el.parentElement.children) {
      if (annet !== el) annet.inert = inert;
    }
  }
}

function apneFilter() {
  filterpanel.classList.add("apen");
  filterpanel.setAttribute("role", "dialog");
  filterpanel.setAttribute("aria-modal", "true");
  filtrerKnapp.setAttribute("aria-expanded", "true");
  document.body.classList.add("modal-apen");
  settSidenBakInert(true);
  document.getElementById("filter-lukk").focus();
}

function lukkFilter(flyttFokus = true) {
  if (!filterErApent()) return;
  settSidenBakInert(false); // må skje før fokus flyttes tilbake til Filtrer-knappen
  filterpanel.classList.remove("apen");
  filterpanel.removeAttribute("role");
  filterpanel.removeAttribute("aria-modal");
  filtrerKnapp.setAttribute("aria-expanded", "false");
  document.body.classList.remove("modal-apen");
  if (flyttFokus) filtrerKnapp.focus();
}

filtrerKnapp.addEventListener("click", apneFilter);
document.getElementById("filter-lukk").addEventListener("click", () => lukkFilter());
visResultaterKnapp.addEventListener("click", () => lukkFilter());
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && filterErApent()) lukkFilter();
});
// Hvis skjermen blir bred mens panelet er åpent (f.eks. snur nettbrettet), lukk det
mobilvisning.addEventListener("change", e => {
  if (!e.matches) lukkFilter(false);
});
