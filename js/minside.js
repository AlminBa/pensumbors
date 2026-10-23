// Min side: dine egne annonser – og å endre status på, redigere og slette dem.
// De lagrede søkene på Min side ligger i js/lagredesok.js.

// ========== ELEMENTER ==========
const minsideVisning = document.getElementById("minside-visning");
const minSideOverskrift = document.getElementById("min-side-overskrift");
const mineAnnonserListe = document.getElementById("mine-annonser");
const mineAnnonserAntall = document.getElementById("mine-annonser-antall");

// Er annonsen lagt ut av den som bruker appen? (se Data.hentBruker i js/data.js)
function erMin(a) {
  return Boolean(a.eier) && a.eier === bruker.id;
}

// ========== MINE ANNONSER ==========
function lagMinRad(a) {
  const status = statusFor(a);
  // Skjult tekst gjør at skjermlesere hører hvilken annonse knappene gjelder
  const hvilken = `<span class="skjult-tekst"> «${trygg(a.tittel)}»</span>`;
  return `
    <li class="min-rad${status === "Solgt" ? " er-solgt" : ""}" data-id="${trygg(a.id)}">
      <div class="min-omslag" style="background:${omslagsfarge(a.emnekode)}" aria-hidden="true">
        <span>${trygg(a.emnekode)}</span>
        ${a.bilder?.length ? `<img data-bilde="${trygg(a.bilder[0])}" alt="">` : ""}
      </div>
      <div class="min-info">
        <a class="min-tittel" href="${lenkeTil(a)}">${trygg(a.tittel)}</a>
        <p class="min-detaljer">${formaterPris(a.pris)} · ${trygg(a.emnekode)} · lagt ut ${trygg(formaterDato(a.dato))}</p>
        <div class="min-handlinger">
          <label class="min-status">
            <span>Status${hvilken}</span>
            <select class="velger" data-handling="status">
              ${STATUSER.map(s => `<option${s === status ? " selected" : ""}>${s}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="lenkeknapp" data-handling="rediger">Rediger${hvilken}</button>
          <button type="button" class="lenkeknapp fare" data-handling="slett">Slett${hvilken}</button>
        </div>
      </div>
    </li>`;
}

function tegnMinSide() {
  const mine = sorterTreff(annonser.filter(erMin), "nyeste");
  mineAnnonserAntall.textContent = mine.length ? antallTekstFor(mine.length) : "";
  mineAnnonserListe.innerHTML = mine.length
    ? `<ul class="mine-annonser">${mine.map(lagMinRad).join("")}</ul>`
    : `<div class="tomt">
         <strong>Du har ingen annonser ennå</strong>
         Bøkene du legger ut, dukker opp her. Her kan du også redigere dem, markere dem som solgt og slette dem.
         <div><button type="button" class="knapp knapp-primar" data-handling="ny">Legg ut annonse</button></div>
       </div>`;
  lastBilder(mineAnnonserListe);
  tegnLagredeSok();
}

function annonseFor(element) {
  const id = element.closest("[data-id]")?.dataset.id;
  return annonser.find(a => a.id === id);
}

mineAnnonserListe.addEventListener("change", async e => {
  const valg = e.target.closest('select[data-handling="status"]');
  const a = valg && annonseFor(valg);
  if (!a) return;
  valg.closest(".min-rad").classList.toggle("er-solgt", valg.value === "Solgt");
  await endreStatus(a, valg.value);
});

mineAnnonserListe.addEventListener("click", e => {
  const knapp = e.target.closest("button[data-handling]");
  if (!knapp) return;
  if (knapp.dataset.handling === "ny") return apneSkjema();
  const a = annonseFor(knapp);
  if (!a) return;
  if (knapp.dataset.handling === "rediger") apneSkjema(a);
  if (knapp.dataset.handling === "slett") slettAnnonse(a);
});

// ========== ENDRE STATUS OG SLETTE ==========
// Bare eieren kan endre eller slette en annonse. Med en ekte server må serveren også sjekke det.
async function endreStatus(a, nyStatus) {
  if (!erMin(a) || !STATUSER.includes(nyStatus) || statusFor(a) === nyStatus) return;
  a.status = nyStatus;
  visAnnonser(); // listen bak oppdateres også
  const lagret = await Data.oppdaterAnnonse(a.id, { status: nyStatus });
  visMelding(lagret
    ? `Status endret til «${nyStatus}».`
    : "Statusen ble endret, men kunne ikke lagres i nettleseren.");
}

async function slettAnnonse(a) {
  if (!erMin(a)) return;
  const ja = await bekreft("Slette annonsen?",
    `«${a.tittel}» blir borte for godt. Det kan ikke angres.`, "Slett annonsen");
  if (!ja) return;

  annonser = annonser.filter(x => x.id !== a.id);
  const varFavoritt = favoritter.delete(a.id);
  byggValg(); // byen eller lærestedet kan ha forsvunnet fra filteret
  oppdaterFavorittTeller();
  if (annonseIdFraAdresse() === a.id) {
    // Annonsen finnes ikke lenger, så vi går til Min side i stedet
    history.replaceState(null, "", adresseFor("min-side"));
    visRiktigVisning();
  } else {
    tegnPaNytt();
    minSideOverskrift.focus({ preventScroll: true });
  }

  const lagret = await Data.slettAnnonse(a.id);
  if (varFavoritt) await Data.settFavoritt(a.id, false);
  visMelding(lagret
    ? "Annonsen er slettet."
    : "Annonsen ble slettet, men endringen kunne ikke lagres i nettleseren.");
}
