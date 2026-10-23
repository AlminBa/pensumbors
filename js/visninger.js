// Tegner listen med annonser og detaljvisningen for én annonse.

// ========== ELEMENTER PÅ SIDEN ==========
const listevisning = document.getElementById("listevisning");
const detaljvisning = document.getElementById("detaljvisning");
const detaljInnhold = document.getElementById("detalj-innhold");
const rutenett = document.getElementById("rutenett");
const antallTekst = document.getElementById("antall");
const STANDARDTITTEL = document.title;
const sidetittel = document.getElementById("sidetittel");
const visAlleLenke = document.getElementById("vis-alle-lenke");
const favorittLenke = document.getElementById("favoritt-lenke");
const favorittAntall = document.getElementById("favoritt-antall");

// ========== LISTEVISNING ==========
function lenkeTil(a) {
  return "#annonse-" + encodeURIComponent(a.id);
}

function lagKort(a) {
  const status = statusFor(a);
  const klasser = ["kort"];
  if (a.id === sistLagtUtId) klasser.push("ny");
  if (status === "Solgt") klasser.push("er-solgt");
  const erFavoritt = favoritter.has(a.id);
  return `
    <div class="kort-ramme">
    <a class="${klasser.join(" ")}" href="${lenkeTil(a)}">
      ${statusMerke(status)}
      <div class="omslag" style="background:${omslagsfarge(a.emnekode)}" aria-hidden="true">
        <div class="omslag-tittel"><span class="omslag-kode">${trygg(a.emnekode)}</span></div>
      </div>
      <div class="kort-innhold">
        <h3 class="kort-tittel">${trygg(a.tittel)}</h3>
        <span class="kort-kode">${trygg(a.emnekode)}</span>
        <div class="kort-pris">${formaterPris(a.pris)}</div>
        <div class="kort-detaljer">
          <span>${trygg(a.tilstand)}</span>
          <span class="sted">${stedIkon}${trygg(a.by)}</span>
        </div>
      </div>
    </a>
    <button type="button" class="hjerte" data-favoritt="${trygg(a.id)}"
            aria-pressed="${erFavoritt}" aria-label="Favoritt: ${trygg(a.tittel)}">${hjerteIkon}</button>
    </div>`;
}

function antallTekstFor(n) {
  return n === 1 ? "1 annonse" : `${n} annonser`;
}

function visAnnonser() {
  // 1. Les søk og filtre
  const k = lesKriterier();
  sjekkPrisfilter(k);

  // 2. Finn annonsene som passer med søk OG alle filtre, og sorter dem
  const favorittmodus = listemodus === "favoritter";
  const grunnlag = favorittmodus ? annonser.filter(a => favoritter.has(a.id)) : annonser;
  const treff = sorterTreff(grunnlag.filter(a => passer(a, k)), k.sortering);

  // 3. Oppdater tellere, filterbrikker og knapper
  const aktive = antallAktiveFiltre(k);
  antallTekst.textContent = antallTekstFor(treff.length);
  visResultaterKnapp.textContent = treff.length === 0 ? "Ingen annonser passer" : `Vis ${antallTekstFor(treff.length)}`;
  filterMerke.textContent = aktive;
  filterMerke.hidden = aktive === 0;
  nullstillFiltreKnapp.hidden = !harFilterInnhold();
  oppdaterFiltertellere(grunnlag, k);
  tegnFilterbrikker(k);
  visFlere.hidden = true;

  // 4. Tegn kortene, eller en melding hvis ingenting passer
  if (favorittmodus && antallFavoritter() === 0) {
    rutenett.innerHTML = `
      <div class="tomt" style="grid-column: 1 / -1">
        <strong>Du har ingen favoritter ennå</strong>
        Trykk på hjertet på en annonse for å lagre den her.
        <div><button type="button" class="knapp knapp-sekundar" id="tomt-alle">Vis alle annonser</button></div>
      </div>`;
    return;
  }

  if (annonser.length === 0) {
    rutenett.innerHTML = `
      <div class="tomt" style="grid-column: 1 / -1">
        <strong>Ingen annonser ennå</strong>
        Trykk på «Legg ut annonse» for å selge din første bok.
      </div>`;
    return;
  }

  if (treff.length === 0) {
    const filtreIBruk = harFilterInnhold();
    let tittel, tekst, knappetekst;
    if (k.sok && !filtreIBruk) {
      tittel = `Ingen treff på «${trygg(k.sok)}»`;
      tekst = "Sjekk stavemåten, eller prøv bare emnekoden, for eksempel MAT1100.";
      knappetekst = "Tøm søket";
    } else {
      tittel = "Ingen annonser passer";
      tekst = "Prøv et større prisområde, en annen by eller færre filtre.";
      knappetekst = k.sok ? "Nullstill søk og filtre" : "Nullstill filtre";
    }
    rutenett.innerHTML = `
      <div class="tomt" style="grid-column: 1 / -1">
        <strong>${tittel}</strong>
        ${tekst}
        <div><button type="button" class="knapp knapp-sekundar" id="tomt-nullstill">${knappetekst}</button></div>
      </div>`;
    return;
  }

  rutenett.innerHTML = treff.slice(0, visesAntall).map(lagKort).join("");
  tegnVisFlere(treff.length);
}

// ========== DETALJVISNING ==========
function tegnDetalj(id) {
  const a = annonser.find(x => x.id === id);

  if (!a) {
    document.title = "Fant ikke annonsen – Pensumbørs";
    detaljInnhold.innerHTML = `
      <div class="tomt">
        <strong tabindex="-1" class="detalj-tittel-fokus">Fant ikke annonsen</strong>
        Den kan ha blitt fjernet, eller lenken er feil.
      </div>`;
    return;
  }

  const status = statusFor(a);
  const epost = lagEpost(a);
  const emne = encodeURIComponent(`Pensumbørs: ${a.tittel}`);
  const beskrivelse = String(a.beskrivelse ?? "").trim();
  const erFavoritt = favoritter.has(a.id);
  document.title = `${a.tittel} – Pensumbørs`;

  detaljInnhold.innerHTML = `
    <article class="detalj${status === "Solgt" ? " er-solgt" : ""}" data-id="${trygg(a.id)}">
      <div class="omslag" style="background:${omslagsfarge(a.emnekode)}" aria-hidden="true">
        <div class="omslag-tittel"><span class="omslag-kode">${trygg(a.emnekode)}</span></div>
      </div>

      <div class="detalj-info">
        <div class="detalj-topprad">
          <span id="detalj-status">${statusMerke(status)}</span>
          <button type="button" class="favoritt-knapp${erFavoritt ? " er-favoritt" : ""}" data-favoritt="${trygg(a.id)}">
            ${hjerteIkon}<span class="favoritt-knapp-tekst">${erFavoritt ? "Lagret som favoritt" : "Lagre som favoritt"}</span>
          </button>
        </div>
        <h1 class="detalj-tittel detalj-tittel-fokus" tabindex="-1">${trygg(a.tittel)}</h1>
        <p class="detalj-forfatter">av ${trygg(a.forfatter)}</p>
        <div class="detalj-pris">${formaterPris(a.pris)}</div>

        <dl class="detalj-fakta">
          <div><dt>Emnekode</dt><dd>${trygg(a.emnekode)}</dd></div>
          <div><dt>Tilstand</dt><dd>${trygg(a.tilstand)}</dd></div>
          <div><dt>By</dt><dd>${trygg(a.by)}</dd></div>
          <div><dt>Selger</dt><dd>${trygg(a.selger)}</dd></div>
          <div><dt>Lagt ut</dt><dd>${trygg(formaterDato(a.dato))}</dd></div>
        </dl>

        <div class="detalj-seksjon">
          <h2>Beskrivelse</h2>
          ${beskrivelse
            ? `<p class="detalj-beskrivelse">${trygg(beskrivelse)}</p>`
            : `<p class="detalj-beskrivelse tom">Selgeren har ikke skrevet noen beskrivelse.</p>`}
        </div>

        <div class="detalj-seksjon kontakt">
          <button type="button" class="knapp knapp-primar" id="kontakt-knapp"
                  aria-expanded="false" aria-controls="kontakt-boks">Kontakt selger</button>
          <div class="kontakt-boks" id="kontakt-boks" hidden>
            <p>Send en e-post til ${trygg(a.selger)}:</p>
            <a href="mailto:${epost}?subject=${emne}">${epost}</a>
            <p class="liten">Adressen er oppdiktet, fordi Pensumbørs er et studentprosjekt.</p>
          </div>
        </div>

        <div class="selgerboks">
          <h2 id="status-overskrift">Endre status</h2>
          <div class="statusvalg" role="group" aria-labelledby="status-overskrift">
            ${STATUSER.map(s =>
              `<button type="button" data-status="${s}" aria-pressed="${s === status}">${s}</button>`
            ).join("")}
          </div>
          <p class="statushjelp">Solgte bøker vises blekere og havner nederst i listen.</p>
        </div>
      </div>
    </article>`;
}

// Klikk inne i detaljvisningen: kontaktknapp og statusknapper
detaljInnhold.addEventListener("click", async e => {
  // «Kontakt selger» viser eller skjuler e-postadressen
  if (e.target.closest("#kontakt-knapp")) {
    const knapp = document.getElementById("kontakt-knapp");
    const boks = document.getElementById("kontakt-boks");
    const apen = boks.hidden;
    boks.hidden = !apen;
    knapp.setAttribute("aria-expanded", String(apen));
    knapp.textContent = apen ? "Skjul kontaktinfo" : "Kontakt selger";
    return;
  }

  // Statusknappene
  const statusKnapp = e.target.closest("button[data-status]");
  if (!statusKnapp) return;
  const artikkel = detaljInnhold.querySelector(".detalj");
  const a = annonser.find(x => x.id === artikkel.dataset.id);
  const nyStatus = statusKnapp.dataset.status;
  if (!a || statusFor(a) === nyStatus) return;

  a.status = nyStatus;

  // Oppdater detaljvisningen uten å tegne alt på nytt
  document.getElementById("detalj-status").innerHTML = statusMerke(nyStatus);
  artikkel.classList.toggle("er-solgt", nyStatus === "Solgt");
  detaljInnhold.querySelectorAll("button[data-status]").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.status === nyStatus))
  );

  visAnnonser(); // listen bak oppdateres også
  const lagret = await Data.oppdaterAnnonse(a.id, { status: nyStatus });
  visMelding(lagret
    ? `Status endret til «${nyStatus}».`
    : "Statusen ble endret, men kunne ikke lagres i nettleseren.");
});

// ========== FAVORITTKNAPPER (hjertene) ==========
function oppdaterFavorittTeller() {
  const antall = antallFavoritter();
  favorittAntall.textContent = antall;
  favorittAntall.hidden = antall === 0;
}

// Oppdaterer alle hjerter for én annonse (på kortet og i detaljvisningen)
function oppdaterFavorittKnapper(id) {
  const erFavoritt = favoritter.has(id);
  document.querySelectorAll("[data-favoritt]").forEach(knapp => {
    if (knapp.dataset.favoritt !== id) return;
    if (knapp.classList.contains("hjerte")) {
      knapp.setAttribute("aria-pressed", String(erFavoritt));
    } else {
      knapp.classList.toggle("er-favoritt", erFavoritt);
      knapp.querySelector(".favoritt-knapp-tekst").textContent =
        erFavoritt ? "Lagret som favoritt" : "Lagre som favoritt";
    }
  });
}

// ========== BEKREFTELSESMELDING ==========
const melding = document.getElementById("melding");
let meldingTimer = null;
function visMelding(tekst, varighet = 3200) {
  melding.textContent = tekst;
  melding.classList.add("synlig");
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(() => melding.classList.remove("synlig"), varighet);
}
