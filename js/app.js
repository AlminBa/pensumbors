// Tilstanden til appen, bytte mellom visninger og oppstart. Lastes sist.

// ========== TILSTAND ==========
// Annonsene og favorittene slik de vises nå. Hentes fra datalaget (js/data.js) ved oppstart.
let annonser = [];
let favoritter = new Set();
let sistLagtUtId = null; // brukes til å markere annonsen som nettopp ble lagt ut

// Teller bare favoritter som fortsatt finnes som annonser
function antallFavoritter() {
  return annonser.filter(a => favoritter.has(a.id)).length;
}

// ========== BYTTE MELLOM VISNINGER ==========
// Adressen bestemmer hva som vises:
//   (ingenting)     → alle annonser
//   #favoritter     → mine favoritter
//   #annonse-a3     → detaljer for annonse a3
// Da fungerer også nettleserens tilbakeknapp, og du kan dele lenker.
let listemodus = "alle";    // «alle» eller «favoritter»
let kommerFraListe = false; // true hvis brukeren klikket seg inn fra en liste
let listeScroll = 0;        // hvor langt ned i listen brukeren var
let sistApnetId = null;

function annonseIdFraAdresse() {
  const treff = location.hash.match(/^#annonse-(.+)$/);
  if (!treff) return null;
  try { return decodeURIComponent(treff[1]); } catch { return null; }
}

function modusFraAdresse() {
  return location.hash === "#favoritter" ? "favoritter" : "alle";
}

function adresseFor(modus) {
  return location.pathname + location.search + (modus === "favoritter" ? "#favoritter" : "");
}

function oppdaterListeoverskrift() {
  const favorittmodus = listemodus === "favoritter";
  sidetittel.textContent = favorittmodus ? "Mine favoritter" : "Brukte pensumbøker";
  visAlleLenke.hidden = !favorittmodus;
  document.title = favorittmodus ? "Mine favoritter – Pensumbørs" : STANDARDTITTEL;
  if (favorittmodus) favorittLenke.setAttribute("aria-current", "page");
  else favorittLenke.removeAttribute("aria-current");
}

function visRiktigVisning() {
  const id = annonseIdFraAdresse();
  if (id) {
    lukkFilter(false);
    sistApnetId = id;
    listevisning.hidden = true;
    detaljvisning.hidden = false;
    favorittLenke.removeAttribute("aria-current");
    document.getElementById("tilbake-tekst").textContent =
      listemodus === "favoritter" ? "Tilbake til favorittene" : "Tilbake til annonsene";
    tegnDetalj(id);
    window.scrollTo(0, 0);
    const overskrift = detaljInnhold.querySelector(".detalj-tittel-fokus");
    if (overskrift) overskrift.focus({ preventScroll: true });
  } else {
    const varIDetaljer = !detaljvisning.hidden;
    const nyModus = modusFraAdresse();
    const byttetModus = nyModus !== listemodus;
    listemodus = nyModus;
    detaljvisning.hidden = true;
    listevisning.hidden = false;
    oppdaterListeoverskrift();
    visAnnonser();
    if (byttetModus) {
      window.scrollTo(0, 0);
    } else if (varIDetaljer) {
      window.scrollTo(0, listeScroll);
      // Sett fokus tilbake på kortet brukeren åpnet (nyttig for tastaturbrukere)
      const kort = sistApnetId && rutenett.querySelector(`a[href="#annonse-${CSS.escape(encodeURIComponent(sistApnetId))}"]`);
      if (kort) kort.focus({ preventScroll: true });
    }
    kommerFraListe = false;
  }
}

window.addEventListener("hashchange", () => {
  // Hvis en liste var synlig og vi går til en annonse, husk hvor i listen vi var
  if (annonseIdFraAdresse() && !listevisning.hidden) {
    kommerFraListe = true;
    listeScroll = window.scrollY;
  }
  visRiktigVisning();
});

// Gå til en liste. «erstatt» betyr: ikke legg til et nytt steg i nettleserhistorikken.
function gaTilListe(modus, erstatt = false) {
  const url = adresseFor(modus);
  if (url !== location.pathname + location.search + location.hash) {
    if (erstatt) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
  }
  visRiktigVisning();
}

// Fra detaljvisningen: gå rett til listen du kom fra
function visListeDirekte(tilToppen = true) {
  if (annonseIdFraAdresse()) {
    if (tilToppen) listeScroll = 0;
    gaTilListe(listemodus, true);
  }
}

function tilbakeTilListe() {
  if (kommerFraListe) history.back();   // som å trykke på nettleserens tilbakeknapp
  else visListeDirekte(false);          // åpnet via lenke: gå rett til listen
}

document.getElementById("tilbake-knapp").addEventListener("click", tilbakeTilListe);

visAlleLenke.addEventListener("click", e => {
  e.preventDefault();
  gaTilListe("alle");
});

// Klikk på et hjerte (på et kort eller i detaljvisningen)
document.addEventListener("click", async e => {
  const knapp = e.target.closest("[data-favoritt]");
  if (!knapp) return;
  const id = knapp.dataset.favoritt;
  if (!annonser.some(a => a.id === id)) return;

  const blirFavoritt = !favoritter.has(id);
  if (blirFavoritt) favoritter.add(id);
  else favoritter.delete(id);

  oppdaterFavorittKnapper(id);
  oppdaterFavorittTeller();

  // Lite «hopp» på hjertet
  knapp.classList.remove("pop");
  void knapp.offsetWidth; // starter animasjonen på nytt
  knapp.classList.add("pop");

  // I «Mine favoritter» må listen tegnes på nytt (annonsen skal forsvinne eller dukke opp)
  if (listemodus === "favoritter") {
    const varIRutenettet = rutenett.contains(knapp);
    visAnnonser();
    if (varIRutenettet) sidetittel.focus({ preventScroll: true });
  }

  const lagret = await Data.settFavoritt(id, blirFavoritt);
  visMelding(!lagret
    ? "Favoritten ble endret, men kunne ikke lagres i nettleseren."
    : blirFavoritt ? "Lagt til i favoritter." : "Fjernet fra favoritter.");
});

// Knappen i «ingen treff»-meldingen
rutenett.addEventListener("click", e => {
  if (e.target.closest("#tomt-nullstill")) {
    nullstillSokOgFiltre();
    visAnnonser();
  }
  if (e.target.closest("#tomt-alle")) gaTilListe("alle");
});

// Klikk på logoen tømmer søket og går til toppen av alle annonser
document.querySelector(".logo").addEventListener("click", e => {
  e.preventDefault();
  sokefelt.value = "";
  listeScroll = 0;
  gaTilListe("alle");
  visAnnonser();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ========== FLERE FANER ==========
// Hver fane har sin egen kopi av annonsene og favorittene. Når en annen fane lagrer,
// henter vi dataene på nytt, så denne fanen viser det samme.
Data.vedEndring(async hva => {
  if (hva === "annonser") {
    annonser = await Data.hentAnnonser();
    byggByvalg();
  } else {
    favoritter = await Data.hentFavoritter();
  }
  oppdaterFavorittTeller();
  const id = annonseIdFraAdresse();
  if (id) tegnDetalj(id);
  else visAnnonser();
});

// ========== START ==========
async function start() {
  annonser = await Data.hentAnnonser();
  favoritter = await Data.hentFavoritter();
  byggByvalg();
  oppdaterFavorittTeller();
  visRiktigVisning(); // viser riktig visning ut fra adressen (alle, favoritter eller én annonse)
}

start();
