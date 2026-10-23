// Lagrede søk: lagre et søk med filtre, finne det igjen på Min side og se hvor mange nye
// annonser som har kommet siden sist (som «Lagrede søk» på Finn).

// ========== ELEMENTER ==========
const lagreSokKnapp = document.getElementById("lagre-sok-knapp");
const lagredeSokListe = document.getElementById("lagrede-sok");
const lagredeSokAntall = document.getElementById("lagrede-sok-antall");
const lagredeSokOverskrift = document.getElementById("lagrede-sok-overskrift");
const minSideMerke = document.getElementById("min-side-merke");

// Et søk kjennes igjen på adressen uten sortering (sorteringen endrer ikke treffene)
function sokedelUtenSortering(k) {
  return sokedelFor({ ...k, sortering: "nyeste" });
}

// Søket «mat1100» med filtrene God og UiO → «"mat1100" · God · UiO»
function beskrivSok(k) {
  const deler = filterbrikker(k).map(b => b.tekst);
  if (k.sok) deler.unshift(`«${k.sok}»`);
  return deler.join(" · ") || "Alle annonser";
}

// Når annonsen ble lagt ut (eksempelannonsene har bare en dato)
function lagtUtTid(a) {
  return a.opprettet || Date.parse(`${a.dato}T12:00:00`) || 0;
}

// Treffene for et lagret søk, og de som er nye siden brukeren sist så søket.
// Dine egne annonser og solgte bøker regnes ikke som nye.
function treffFor(sok) {
  const k = kriterierFraAdresse(sok.sokedel);
  const treff = annonser.filter(a => passer(a, k));
  const nye = treff.filter(a => !erMin(a) && statusFor(a) !== "Solgt" && lagtUtTid(a) > sok.sistSett);
  return { treff, nye };
}

// ========== KNAPPEN «LAGRE SØK» ==========
// Vises når du har søkt eller filtrert. Teksten er alltid «Lagre søk»; om søket er lagret,
// vises med fylt ikon og aria-pressed (slik en av/på-knapp skal fungere).
function oppdaterLagreSokKnapp(k) {
  const harSok = Boolean(k.sok) || antallAktiveFiltre(k) > 0;
  lagreSokKnapp.hidden = !harSok || listemodus === "favoritter";
  const lagret = lagredeSok.some(s => s.sokedel === sokedelUtenSortering(k));
  lagreSokKnapp.setAttribute("aria-pressed", String(lagret));
}

lagreSokKnapp.addEventListener("click", async () => {
  const k = lesKriterier();
  const sokedel = sokedelUtenSortering(k);
  const finnes = lagredeSok.find(s => s.sokedel === sokedel);
  if (finnes) {
    lagredeSok = lagredeSok.filter(s => s !== finnes);
    oppdaterLagreSokKnapp(k);
    oppdaterSokVarsel();
    const lagret = await Data.slettSok(finnes.id);
    visMelding(lagret ? "Søket er fjernet fra lagrede søk." : "Søket ble fjernet, men endringen kunne ikke lagres i nettleseren.");
  } else {
    const na = Date.now();
    const sok = { id: nyId(), navn: beskrivSok(k), sokedel, opprettet: na, sistSett: na };
    lagredeSok.unshift(sok);
    oppdaterLagreSokKnapp(k);
    const lagret = await Data.lagreSok(sok);
    visMelding(lagret ? "Søket er lagret. Du finner det på Min side." : "Søket ble lagret, men kunne ikke lagres i nettleseren.");
  }
});

// ========== LAGREDE SØK PÅ MIN SIDE ==========
function tegnLagredeSok() {
  lagredeSokAntall.textContent = lagredeSok.length ? `${lagredeSok.length} søk` : "";
  if (!lagredeSok.length) {
    lagredeSokListe.innerHTML = `
      <div class="tomt">
        <strong>Ingen lagrede søk</strong>
        Søk eller filtrer, og trykk «Lagre søk». Da finner du søket igjen her – og ser når det kommer nye bøker.
      </div>`;
    return;
  }
  lagredeSokListe.innerHTML = `<ul class="lagrede-sok">${lagredeSok.map(sok => {
    const { treff, nye } = treffFor(sok);
    return `
      <li class="lagret-sok">
        <div class="lagret-sok-info">
          <a class="lagret-sok-navn" href="${trygg(location.pathname + sok.sokedel)}" data-sok-id="${trygg(sok.id)}">${trygg(sok.navn)}</a>
          <p class="lagret-sok-detaljer">${antallTekstFor(treff.length)} · lagret ${trygg(formaterDato(sok.opprettet))}</p>
        </div>
        ${nye.length ? `<span class="nye-merke">${nye.length} ${nye.length === 1 ? "ny" : "nye"}</span>` : ""}
        <button type="button" class="lenkeknapp fare" data-slett-sok="${trygg(sok.id)}">Slett<span class="skjult-tekst"> søket ${trygg(sok.navn)}</span></button>
      </li>`;
  }).join("")}</ul>`;
}

// Viser treffene for et lagret søk, og merker søket som sett (de nye er ikke nye lenger)
async function visLagretSok(id) {
  const sok = lagredeSok.find(s => s.id === id);
  if (!sok) return;
  sok.sistSett = Date.now();
  settKriterier(kriterierFraAdresse(sok.sokedel));
  visesAntall = SIDESTORRELSE;
  listeScroll = 0;
  gaTilListe("alle");
  sidetittel.focus({ preventScroll: true });
  oppdaterSokVarsel();
  await Data.merkSokSomSett(sok.id, sok.sistSett);
}

async function slettLagretSok(id) {
  lagredeSok = lagredeSok.filter(s => s.id !== id);
  tegnLagredeSok();
  oppdaterSokVarsel();
  lagredeSokOverskrift.focus({ preventScroll: true });
  const lagret = await Data.slettSok(id);
  visMelding(lagret ? "Søket er slettet." : "Søket ble slettet, men endringen kunne ikke lagres i nettleseren.");
}

lagredeSokListe.addEventListener("click", e => {
  const lenke = e.target.closest("a[data-sok-id]");
  if (lenke) {
    // Med Ctrl/Cmd/Shift åpnes søket som en vanlig lenke (f.eks. i en ny fane)
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    visLagretSok(lenke.dataset.sokId);
    return;
  }
  const slett = e.target.closest("[data-slett-sok]");
  if (slett) slettLagretSok(slett.dataset.slettSok);
});

// ========== VARSEL OM NYE TREFF ==========
// Et merke på «Min side» i menyen viser hvor mange nye annonser de lagrede søkene har.
// En annonse som passer flere søk, telles bare én gang.
function oppdaterSokVarsel() {
  const nye = new Set();
  for (const sok of lagredeSok) for (const a of treffFor(sok).nye) nye.add(a.id);
  minSideMerke.hidden = nye.size === 0;
  minSideMerke.innerHTML = `${nye.size}<span class="skjult-tekst"> ${nye.size === 1 ? "ny annonse" : "nye annonser"} i lagrede søk</span>`;
}
