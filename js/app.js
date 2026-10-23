// Tilstanden til appen, bytte mellom visninger og oppstart. Lastes sist.

// ========== TILSTAND ==========
// Annonsene og favorittene slik de vises nå. Hentes fra datalaget (js/data.js) ved oppstart.
let annonser = [];
let favoritter = new Set();
let bruker = { id: null }; // den som bruker appen (se Data.hentBruker)
let lagredeSok = [];       // se js/lagredesok.js
let sistLagtUtId = null; // brukes til å markere annonsen som nettopp ble lagt ut

// Teller bare favoritter som fortsatt finnes som annonser
function antallFavoritter() {
  return annonser.filter(a => favoritter.has(a.id)).length;
}

// ========== BYTTE MELLOM VISNINGER ==========
// Adressen bestemmer hva som vises:
//   (ingenting)     → alle annonser
//   #favoritter     → mine favoritter
//   #min-side       → Min side (dine egne annonser)
//   #annonse-a3     → detaljer for annonse a3
// Søk og filtre står foran, f.eks. ?q=mat1100&by=oslo#favoritter (se js/sok.js).
// Da fungerer også nettleserens tilbakeknapp, og du kan dele lenker.
let listemodus = "alle";    // «alle» eller «favoritter»
let tilbakeTil = null;      // «liste», «min-side» eller «annonse»: hvor brukeren kom fra til en annonse
let listeScroll = 0;        // hvor langt ned i listen brukeren var
let sistApnetId = null;

function annonseIdFraAdresse() {
  const treff = location.hash.match(/^#annonse-(.+)$/);
  if (!treff) return null;
  try { return decodeURIComponent(treff[1]); } catch { return null; }
}

function erMinSide() {
  return location.hash === "#min-side";
}

function modusFraAdresse() {
  return location.hash === "#favoritter" ? "favoritter" : "alle";
}

function adresseFor(visning) {
  const hash = { alle: "", favoritter: "#favoritter", "min-side": "#min-side" }[visning];
  return location.pathname + sokedelFor(lesKriterier()) + hash;
}

// Markerer hvor i menyen brukeren er («alle», «favoritter», «min-side» eller null)
function oppdaterMeny(aktiv) {
  const lenker = { alle: forsideLenke, favoritter: favorittLenke, "min-side": minSideLenke };
  for (const [navn, lenke] of Object.entries(lenker)) {
    if (navn === aktiv) lenke.setAttribute("aria-current", "page");
    else lenke.removeAttribute("aria-current");
  }
}

function oppdaterListeoverskrift() {
  const favorittmodus = listemodus === "favoritter";
  sidetittel.textContent = favorittmodus ? "Mine favoritter" : "Brukte pensumbøker";
  visAlleLenke.hidden = !favorittmodus;
  document.title = favorittmodus ? "Mine favoritter – Pensumbørs" : STANDARDTITTEL;
  oppdaterMeny(listemodus);
}

// Viser én visning og skjuler de andre
function visBare(visning) {
  listevisning.hidden = visning !== listevisning;
  detaljvisning.hidden = visning !== detaljvisning;
  minsideVisning.hidden = visning !== minsideVisning;
}

function visRiktigVisning() {
  const id = annonseIdFraAdresse();
  if (id) {
    lukkFilter(false);
    sistApnetId = id;
    visBare(detaljvisning);
    oppdaterMeny(null);
    document.getElementById("tilbake-tekst").textContent =
      tilbakeTil === "annonse" ? "Tilbake"
      : tilbakeTil === "min-side" ? "Tilbake til Min side"
      : listemodus === "favoritter" ? "Tilbake til favorittene" : "Tilbake til annonsene";
    tegnDetalj(id);
    window.scrollTo(0, 0);
    const overskrift = detaljInnhold.querySelector(".detalj-tittel-fokus");
    if (overskrift) overskrift.focus({ preventScroll: true });
  } else if (erMinSide()) {
    lukkFilter(false);
    const fraAnnonse = !detaljvisning.hidden;
    visBare(minsideVisning);
    oppdaterMeny("min-side");
    document.title = "Min side – Pensumbørs";
    tegnMinSide();
    window.scrollTo(0, 0);
    // Tilbake fra en annonse: fokus på den annonsen i listen, ellers på overskriften
    const rad = fraAnnonse && sistApnetId &&
      mineAnnonserListe.querySelector(`[data-id="${CSS.escape(sistApnetId)}"] .min-tittel`);
    (rad || minSideOverskrift).focus({ preventScroll: true });
    tilbakeTil = null;
  } else {
    const varIDetaljer = !detaljvisning.hidden;
    const varPaMinSide = !minsideVisning.hidden;
    const nyModus = modusFraAdresse();
    const byttetModus = nyModus !== listemodus;
    listemodus = nyModus;
    visBare(listevisning);
    oppdaterListeoverskrift();
    visAnnonser();
    if (byttetModus || varPaMinSide) {
      window.scrollTo(0, 0);
    } else if (varIDetaljer) {
      window.scrollTo(0, listeScroll);
      // Sett fokus tilbake på kortet brukeren åpnet (nyttig for tastaturbrukere)
      const kort = sistApnetId && rutenett.querySelector(`a[href="#annonse-${CSS.escape(encodeURIComponent(sistApnetId))}"]`);
      if (kort) kort.focus({ preventScroll: true });
    }
    tilbakeTil = null;
  }
}

// Tegner visningen som vises nå på nytt, f.eks. etter at en annonse er endret
function tegnPaNytt() {
  const id = annonseIdFraAdresse();
  if (id) tegnDetalj(id);
  else if (erMinSide()) tegnMinSide();
  else visAnnonser();
}

window.addEventListener("hashchange", () => {
  // Husk hvor brukeren kom fra når en annonse åpnes, så «Tilbake» går dit
  if (annonseIdFraAdresse()) {
    if (!listevisning.hidden) {
      tilbakeTil = "liste";
      listeScroll = window.scrollY;
    } else if (!minsideVisning.hidden) {
      tilbakeTil = "min-side";
    } else if (!detaljvisning.hidden) {
      tilbakeTil = "annonse"; // fra «Flere bøker for …» under en annen annonse
    }
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

// Fra en annonse eller Min side: gå rett til listen (uten et nytt steg i historikken)
function visListeDirekte(tilToppen = true) {
  if (annonseIdFraAdresse() || erMinSide()) {
    if (tilToppen) listeScroll = 0;
    gaTilListe(erMinSide() ? "alle" : listemodus, true);
  }
}

function tilbakeTilListe() {
  if (tilbakeTil) history.back();   // som å trykke på nettleserens tilbakeknapp
  else visListeDirekte(false);      // åpnet via lenke: gå rett til listen
}

document.getElementById("tilbake-knapp").addEventListener("click", tilbakeTilListe);

visAlleLenke.addEventListener("click", e => {
  e.preventDefault();
  gaTilListe("alle");
});

// «Annonser» i bunnmenyen på mobil går til listen med alle annonser
forsideLenke.addEventListener("click", e => {
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
    nyttSok();
  }
  if (e.target.closest("#tomt-alle")) gaTilListe("alle");
});

// Klikk på logoen tømmer søket og går til toppen av alle annonser
document.querySelector(".logo").addEventListener("click", e => {
  e.preventDefault();
  sokefelt.value = "";
  listeScroll = 0;
  visesAntall = SIDESTORRELSE;
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
    byggValg();
  } else if (hva === "favoritter") {
    favoritter = await Data.hentFavoritter();
  } else {
    lagredeSok = await Data.hentLagredeSok();
  }
  oppdaterFavorittTeller();
  oppdaterSokVarsel();
  tegnPaNytt();
});

// ========== START ==========
async function start() {
  bruker = await Data.hentBruker();
  annonser = await Data.hentAnnonser();
  favoritter = await Data.hentFavoritter();
  lagredeSok = await Data.hentLagredeSok();
  settKriterier(kriterierFraAdresse()); // søk og filtre fra adressen (?q=…)
  oppdaterFavorittTeller();
  oppdaterSokVarsel();
  visRiktigVisning(); // viser riktig visning ut fra adressen (alle, favoritter, Min side eller én annonse)
}

start();
