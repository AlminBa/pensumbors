// Søk, filtre og sortering – og filterpanelet på mobil.
//
// Alt brukeren har søkt og filtrert på samles i ett objekt («kriterier»). Det kan leses fra
// og skrives til skjemaet, og står også i adressen (?q=mat1100&by=oslo …). Da kan et søk
// deles som en lenke, og det huskes når du går frem og tilbake i nettleseren.

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
const aktiveFiltre = document.getElementById("aktive-filtre");
const visFlere = document.getElementById("vis-flere");
const visFlereTekst = document.getElementById("vis-flere-tekst");
const visFlereKnapp = document.getElementById("vis-flere-knapp");

const SORTERINGER = ["nyeste", "billigste", "dyreste"];
const SIDESTORRELSE = 24; // så mange annonser vises før «Vis flere»
let visesAntall = SIDESTORRELSE;

// ========== BY-LISTEN I FILTERET ==========
// Lager listen over byer ut fra annonsene som finnes. En valgt by beholdes selv om ingen
// annonser har den (f.eks. fra en delt lenke), så filteret ikke forsvinner i det stille.
function byggByvalg(valgt = byFilter.value) {
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
  if (valgt && !byer.has(valgt)) byer.set(valgt, storForbokstav(valgt));
  const sortert = [...byer.entries()].sort((a, b) => a[1].localeCompare(b[1], "nb"));
  byFilter.innerHTML = '<option value="">Alle byer</option>' +
    sortert.map(([nokkel, navn]) =>
      `<option value="${trygg(nokkel)}" data-navn="${trygg(navn)}">${trygg(navn)}</option>`).join("");
  byFilter.value = valgt;
}

// ========== KRITERIER ==========
// Tom tekst → null (ingen grense). Ugyldig tekst → NaN.
function tolkFilterPris(tekst) {
  const renset = String(tekst).replace(/\s/g, "").replace(/kr\.?$/i, "").replace(",", ".");
  if (renset === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(renset)) return NaN;
  return Number(renset);
}

function lesKriterier() {
  return {
    sok: sokefelt.value.trim(),
    min: tolkFilterPris(prisMin.value),
    max: tolkFilterPris(prisMax.value),
    tilstander: [...tilstandBokser()].filter(b => b.checked).map(b => b.value),
    by: byFilter.value,
    skjulSolgte: skjulSolgte.checked,
    sortering: sorteringValg.value
  };
}

// Fyller ut søkefeltet og filtrene
function settKriterier(k) {
  sokefelt.value = k.sok;
  prisMin.value = Number.isFinite(k.min) ? k.min : "";
  prisMax.value = Number.isFinite(k.max) ? k.max : "";
  tilstandBokser().forEach(b => (b.checked = k.tilstander.includes(b.value)));
  byggByvalg(k.by);
  skjulSolgte.checked = k.skjulSolgte;
  sorteringValg.value = k.sortering;
}

// Adressen (?q=…&by=…) → kriterier. Ukjente eller ugyldige verdier blir ignorert.
function kriterierFraAdresse(sokedel = location.search) {
  const p = new URLSearchParams(sokedel);
  const pris = navn => {
    const tall = tolkFilterPris(p.get(navn) ?? "");
    return Number.isFinite(tall) ? tall : null;
  };
  const tilstander = p.getAll("tilstand");
  const sortering = p.get("sorter");
  return {
    sok: (p.get("q") ?? "").trim(),
    min: pris("fra"),
    max: pris("til"),
    tilstander: TILSTANDER.filter(t => tilstander.includes(t)),
    by: bynokkel(p.get("by")),
    skjulSolgte: p.get("skjul_solgte") === "1",
    sortering: SORTERINGER.includes(sortering) ? sortering : "nyeste"
  };
}

// Kriterier → «?q=mat1100&by=oslo» (tom tekst når ingenting er valgt)
function sokedelFor(k) {
  const p = new URLSearchParams();
  if (k.sok) p.set("q", k.sok);
  if (Number.isFinite(k.min)) p.set("fra", k.min);
  if (Number.isFinite(k.max)) p.set("til", k.max);
  k.tilstander.forEach(t => p.append("tilstand", t));
  if (k.by) p.set("by", k.by);
  if (k.skjulSolgte) p.set("skjul_solgte", "1");
  if (k.sortering !== "nyeste") p.set("sorter", k.sortering);
  const tekst = p.toString();
  return tekst ? "?" + tekst : "";
}

// Holder adressen i takt med søket, uten å lage nye steg i nettleserhistorikken
function oppdaterAdresse() {
  const url = location.pathname + sokedelFor(lesKriterier()) + location.hash;
  if (url !== location.pathname + location.search + location.hash) history.replaceState(null, "", url);
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

// ========== FILTRERING OG SORTERING ==========
// «Calculus: A Complete Course» → ["calculus", "a", "complete", "course"]
function ordI(tekst) {
  return String(tekst ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// Søket treffer emnekoden, også skrevet med mellomrom («mat 1100» finner MAT1100). Ellers må
// hvert ord du skriver være starten på et ord i tittel, forfatter eller emnekode, så
// «kalkulus lind» finner Kalkulus av Tom Lindstrøm.
function treffPaSok(a, sok) {
  const sokeord = ordI(sok);
  if (sokeord.length === 0) return true;
  if (String(a.emnekode).toLowerCase().includes(sokeord.join(""))) return true;
  const ord = ordI([a.tittel, a.forfatter, a.emnekode].join(" "));
  return sokeord.every(s => ord.some(o => o.startsWith(s)));
}

// Passer annonsen med søket og filtrene? «unntak» hopper over ett filter. Det brukes av
// tellerne, som viser hvor mange treff hvert valg gir sammen med de andre filtrene.
function passer(a, k, unntak = "") {
  if (k.sok && !treffPaSok(a, k.sok)) return false;
  if (k.skjulSolgte && statusFor(a) === "Solgt") return false;
  const pris = Number(a.pris);
  if (Number.isFinite(k.min) && pris < k.min) return false;
  if (Number.isFinite(k.max) && pris > k.max) return false;
  if (unntak !== "tilstand" && k.tilstander.length && !k.tilstander.includes(a.tilstand)) return false;
  if (unntak !== "by" && k.by && bynokkel(a.by) !== k.by) return false;
  return true;
}

// Solgte annonser kommer alltid sist
function sorterTreff(treff, sortering) {
  return treff.sort((x, y) => {
    const xSolgt = statusFor(x) === "Solgt";
    const ySolgt = statusFor(y) === "Solgt";
    if (xSolgt !== ySolgt) return xSolgt ? 1 : -1;
    // Nyeste først; ved samme dato vises den sist lagt ut øverst
    const nyest = String(y.dato).localeCompare(String(x.dato)) || (y.opprettet || 0) - (x.opprettet || 0);
    if (sortering === "billigste") return (Number(x.pris) - Number(y.pris)) || nyest;
    if (sortering === "dyreste") return (Number(y.pris) - Number(x.pris)) || nyest;
    return nyest;
  });
}

// ========== TELLERE I FILTRENE ==========
// Viser hvor mange annonser hvert valg gir, sammen med de andre filtrene (som på Finn)
function oppdaterFiltertellere(grunnlag, k) {
  const tell = (unntak, verdiFor) => {
    const antall = new Map();
    for (const a of grunnlag) {
      if (passer(a, k, unntak)) antall.set(verdiFor(a), (antall.get(verdiFor(a)) || 0) + 1);
    }
    return antall;
  };
  const perTilstand = tell("tilstand", a => a.tilstand);
  tilstandBokser().forEach(boks => {
    boks.closest("label").querySelector(".filter-antall").innerHTML =
      `${perTilstand.get(boks.value) || 0}<span class="skjult-tekst"> annonser</span>`;
  });
  const perBy = tell("by", a => bynokkel(a.by));
  for (const valg of byFilter.options) {
    if (valg.value) valg.textContent = `${valg.dataset.navn} (${perBy.get(valg.value) || 0})`;
  }
}

// ========== FILTERBRIKKER ==========
// Filtrene som er i bruk vises som brikker over annonsene. Trykk på en for å fjerne filteret.
function filterbrikker(k) {
  const brikker = [];
  if (k.skjulSolgte) brikker.push({ tekst: "Skjul solgte", fjern: "solgte" });
  if (Number.isFinite(k.min) && Number.isFinite(k.max)) {
    brikker.push({ tekst: `${k.min.toLocaleString("nb-NO")}–${formaterPris(k.max)}`, fjern: "pris" });
  } else if (Number.isFinite(k.min)) {
    brikker.push({ tekst: `Fra ${formaterPris(k.min)}`, fjern: "pris" });
  } else if (Number.isFinite(k.max)) {
    brikker.push({ tekst: `Til ${formaterPris(k.max)}`, fjern: "pris" });
  }
  k.tilstander.forEach(t => brikker.push({ tekst: t, fjern: "tilstand:" + t }));
  if (k.by) brikker.push({ tekst: byFilter.selectedOptions[0]?.dataset.navn ?? storForbokstav(k.by), fjern: "by" });
  return brikker;
}

function tegnFilterbrikker(k) {
  const brikker = filterbrikker(k);
  aktiveFiltre.hidden = brikker.length === 0;
  aktiveFiltre.innerHTML = brikker.map(b =>
    `<button type="button" class="brikke" data-fjern="${trygg(b.fjern)}"
             aria-label="Fjern filteret ${trygg(b.tekst)}">${trygg(b.tekst)}${kryssIkon}</button>`
  ).join("") + (brikker.length > 1
    ? '<button type="button" class="lenkeknapp" data-fjern="alle">Fjern alle</button>'
    : "");
}

aktiveFiltre.addEventListener("click", e => {
  const knapp = e.target.closest("[data-fjern]");
  if (!knapp) return;
  const hva = knapp.dataset.fjern;
  const plass = [...aktiveFiltre.querySelectorAll(".brikke")].indexOf(knapp);
  if (hva === "alle") nullstillFiltre();
  else if (hva === "solgte") skjulSolgte.checked = false;
  else if (hva === "pris") { prisMin.value = ""; prisMax.value = ""; }
  else if (hva === "by") byFilter.value = "";
  else if (hva.startsWith("tilstand:")) {
    tilstandBokser().forEach(b => { if (b.value === hva.slice("tilstand:".length)) b.checked = false; });
  }
  nyttSok();
  // Fokus til brikken som nå står på samme plass, eller til overskriften hvis ingen er igjen
  const brikker = aktiveFiltre.querySelectorAll(".brikke");
  const neste = hva === "alle" ? null : brikker[Math.min(plass, brikker.length - 1)];
  if (neste) neste.focus();
  else sidetittel.focus({ preventScroll: true });
});

// ========== VIS FLERE ==========
function tegnVisFlere(antallTreff) {
  visFlere.hidden = antallTreff <= visesAntall;
  visFlereTekst.textContent = `Viser ${visesAntall} av ${antallTreff} annonser`;
}

visFlereKnapp.addEventListener("click", () => {
  const forsteNye = visesAntall;
  visesAntall += SIDESTORRELSE;
  visAnnonser();
  // Fokus til det første nye kortet, så tastaturbrukere fortsetter der de var
  const kort = rutenett.querySelectorAll(".kort")[forsteNye];
  if (kort) kort.focus();
});

// ========== HENDELSER: SØK, FILTRE OG SORTERING ==========
// Kjøres når søket eller et filter endres: tilbake til første side, oppdater adressen og listen
function nyttSok() {
  visesAntall = SIDESTORRELSE;
  oppdaterAdresse();
  visAnnonser();
}

// Søk mens du skriver (fra detaljvisningen går du tilbake til listen)
sokefelt.addEventListener("input", () => {
  visListeDirekte();
  nyttSok();
});

// Alle endringer i filterpanelet oppdaterer listen med en gang. Bare «input»: «change» kommer
// også når et prisfelt mister fokus, og å tegne listen på nytt da kan sluke klikket som flyttet fokuset.
filterpanel.addEventListener("input", nyttSok);

sorteringValg.addEventListener("change", nyttSok);

nullstillFiltreKnapp.addEventListener("click", () => {
  nullstillFiltre();
  nyttSok();
});

// Frem og tilbake i nettleseren kan gi et annet søk i adressen – da oppdateres skjemaet
window.addEventListener("popstate", () => {
  const fraAdressen = kriterierFraAdresse();
  if (sokedelFor(fraAdressen) === sokedelFor(lesKriterier())) return;
  settKriterier(fraAdressen);
  visesAntall = SIDESTORRELSE;
  if (!annonseIdFraAdresse()) visAnnonser();
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
