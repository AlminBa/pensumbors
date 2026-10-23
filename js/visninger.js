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
const forsideLenke = document.getElementById("forside-lenke");
const minSideLenke = document.getElementById("min-side-lenke");

// ========== BILDER ==========
// Bildene ligger i datalaget og hentes etter at siden er tegnet. Et bilde vises med en
// midlertidig adresse (object URL) som huskes, så det bare hentes én gang.
const bildeUrler = new Map(); // bilde-ID → adresse, eller null hvis bildet ikke finnes

async function bildeUrl(id) {
  if (!bildeUrler.has(id)) {
    const blob = await Data.hentBilde(id);
    bildeUrler.set(id, blob ? URL.createObjectURL(blob) : null);
  }
  return bildeUrler.get(id);
}

function glemBilde(id) {
  const url = bildeUrler.get(id);
  if (url) URL.revokeObjectURL(url);
  bildeUrler.delete(id);
}

// Fyller inn bildene i «beholder». Finnes ikke bildet, vises det genererte omslaget under.
async function lastBilder(beholder) {
  await Promise.all([...beholder.querySelectorAll("img[data-bilde]:not([src])")].map(async img => {
    const url = await bildeUrl(img.dataset.bilde);
    if (url) img.src = url;
    else img.remove();
  }));
}

// Det første bildet over det genererte omslaget (med en tom alt-tekst: tittelen står ved siden av)
function forsidebilde(a) {
  return a.bilder?.length
    ? `<img class="omslag-bilde" data-bilde="${trygg(a.bilder[0])}" alt="" decoding="async">`
    : "";
}

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
      <div class="omslag${a.bilder?.length ? " har-bilde" : ""}" style="background:${omslagsfarge(a.emnekode)}">
        <div class="omslag-tittel" aria-hidden="true"><span class="omslag-kode">${trygg(a.emnekode)}</span></div>
        ${forsidebilde(a)}
        ${a.kanSendes ? '<span class="omslag-merke">Kan sendes</span>' : ""}
      </div>
      <div class="kort-innhold">
        <h3 class="kort-tittel">${trygg(a.tittel)}</h3>
        <div class="kort-emne">
          <span class="kort-kode">${trygg(a.emnekode)}</span>
          ${a.larested ? `<span class="kort-larested">${trygg(a.larested)}</span>` : ""}
        </div>
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
  oppdaterLagreSokKnapp(k);
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
  lastBilder(rutenett);
  tegnVisFlere(treff.length);
}

// ========== DETALJVISNING ==========
// Bildegalleri: ett stort bilde, og miniatyrer for å bytte bilde når det er flere
function lagGalleri(a) {
  const antall = a.bilder.length;
  return `
    <div class="galleri">
      <div class="galleri-hoved">
        <img class="galleri-bilde" data-bilde="${trygg(a.bilder[0])}" alt="${trygg(`Bilde 1 av ${antall} av «${a.tittel}»`)}">
      </div>
      ${antall > 1 ? `
      <div class="galleri-miniatyrer" role="group" aria-label="Velg bilde">
        ${a.bilder.map((id, i) => `
          <button type="button" class="miniatyr" data-vis-bilde="${i}" aria-pressed="${i === 0}">
            <img data-bilde="${trygg(id)}" alt="Vis bilde ${i + 1} av ${antall}">
          </button>`).join("")}
      </div>` : ""}
    </div>`;
}

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
  const min = erMin(a);
  document.title = `${a.tittel} – Pensumbørs`;

  detaljInnhold.innerHTML = `
    <article class="detalj${status === "Solgt" ? " er-solgt" : ""}" data-id="${trygg(a.id)}">
      ${a.bilder?.length ? lagGalleri(a) : `
      <div class="omslag" style="background:${omslagsfarge(a.emnekode)}" aria-hidden="true">
        <div class="omslag-tittel"><span class="omslag-kode">${trygg(a.emnekode)}</span></div>
      </div>`}

      <div class="detalj-info">
        <div class="detalj-topprad">
          <span id="detalj-status">${statusMerke(status)}</span>
          <button type="button" class="favoritt-knapp${erFavoritt ? " er-favoritt" : ""}" data-favoritt="${trygg(a.id)}">
            ${hjerteIkon}<span class="favoritt-knapp-tekst">${erFavoritt ? "Lagret som favoritt" : "Lagre som favoritt"}</span>
          </button>
        </div>
        <h1 class="detalj-tittel detalj-tittel-fokus" tabindex="-1">${trygg(a.tittel)}</h1>
        <p class="detalj-forfatter">av ${trygg(a.forfatter)}${a.utgave ? ` · ${trygg(a.utgave)}` : ""}</p>
        <div class="detalj-pris">${formaterPris(a.pris)}</div>

        <dl class="detalj-fakta">
          <div><dt>Emnekode</dt><dd>${trygg(a.emnekode)}</dd></div>
          ${a.larested ? `<div><dt>Lærested</dt><dd>${trygg(larestedNavn(a.larested))}</dd></div>` : ""}
          <div><dt>Tilstand</dt><dd>${trygg(a.tilstand)}</dd></div>
          ${a.utgave ? `<div><dt>Utgave</dt><dd>${trygg(a.utgave)}</dd></div>` : ""}
          ${a.isbn ? `<div><dt>ISBN</dt><dd>${trygg(a.isbn)}</dd></div>` : ""}
          <div><dt>Levering</dt><dd>${a.kanSendes ? "Kan sendes" : "Må hentes"}</dd></div>
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

        ${min ? `
        <div class="selgerboks">
          <h2>Din annonse</h2>
          <p class="statusvalg-tittel" id="status-overskrift">Status</p>
          <div class="statusvalg" role="group" aria-labelledby="status-overskrift">
            ${STATUSER.map(s =>
              `<button type="button" data-status="${s}" aria-pressed="${s === status}">${s}</button>`
            ).join("")}
          </div>
          <p class="statushjelp">Solgte bøker vises blekere og havner nederst i listen.</p>
          <div class="selger-handlinger">
            <button type="button" class="knapp knapp-sekundar" data-handling="rediger">Rediger annonsen</button>
            <button type="button" class="knapp knapp-fare" data-handling="slett">Slett annonsen</button>
          </div>
        </div>` : `
        <div class="detalj-seksjon kontakt">
          <button type="button" class="knapp knapp-primar" id="kontakt-knapp"
                  aria-expanded="false" aria-controls="kontakt-boks">Kontakt selger</button>
          <div class="kontakt-boks" id="kontakt-boks" hidden>
            <p>Send en e-post til ${trygg(a.selger)}:</p>
            <a href="mailto:${epost}?subject=${emne}">${epost}</a>
            <p class="liten">Adressen er oppdiktet, fordi Pensumbørs er et studentprosjekt.</p>
          </div>
        </div>`}
      </div>
    </article>`;
  lastBilder(detaljInnhold);
}

// Klikk inne i detaljvisningen: kontaktknapp, og status, redigering og sletting på dine egne annonser
detaljInnhold.addEventListener("click", async e => {
  // Miniatyrene i bildegalleriet bytter det store bildet
  const miniatyr = e.target.closest("[data-vis-bilde]");
  if (miniatyr) {
    const nr = Number(miniatyr.dataset.visBilde);
    const valgt = miniatyr.querySelector("img");
    const hoved = detaljInnhold.querySelector(".galleri-bilde");
    hoved.src = (await bildeUrl(valgt.dataset.bilde)) ?? "";
    hoved.alt = hoved.alt.replace(/^Bilde \d+/, `Bilde ${nr + 1}`);
    detaljInnhold.querySelectorAll("[data-vis-bilde]").forEach(b =>
      b.setAttribute("aria-pressed", String(b === miniatyr)));
    return;
  }

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

  const artikkel = detaljInnhold.querySelector(".detalj");
  const a = artikkel && annonser.find(x => x.id === artikkel.dataset.id);
  if (!a || !erMin(a)) return;

  const handling = e.target.closest("[data-handling]")?.dataset.handling;
  if (handling === "rediger") return apneSkjema(a);
  if (handling === "slett") return slettAnnonse(a);

  // Statusknappene
  const statusKnapp = e.target.closest("button[data-status]");
  if (!statusKnapp || statusFor(a) === statusKnapp.dataset.status) return;
  const nyStatus = statusKnapp.dataset.status;

  // Oppdater detaljvisningen uten å tegne alt på nytt (da blir fokus på knappen)
  document.getElementById("detalj-status").innerHTML = statusMerke(nyStatus);
  artikkel.classList.toggle("er-solgt", nyStatus === "Solgt");
  detaljInnhold.querySelectorAll("button[data-status]").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.status === nyStatus))
  );
  await endreStatus(a, nyStatus);
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

// ========== BEKREFTELSE ==========
// Viser en dialog og gir true hvis brukeren trykker på bekreft-knappen.
// «Avbryt» er først og får fokus, så Enter ikke sletter noe ved et uhell.
const bekreftDialog = document.getElementById("bekreft-dialog");
function bekreft(tittel, tekst, knappetekst) {
  document.getElementById("bekreft-tittel").textContent = tittel;
  document.getElementById("bekreft-tekst").textContent = tekst;
  document.getElementById("bekreft-ja").textContent = knappetekst;
  bekreftDialog.returnValue = "";
  bekreftDialog.showModal();
  return new Promise(svar => bekreftDialog.addEventListener("close",
    () => svar(bekreftDialog.returnValue === "ja"), { once: true }));
}
