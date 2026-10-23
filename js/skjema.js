// Skjemaet for å legge ut en annonse – og for å redigere en du har lagt ut.

// ========== SKJEMA: ÅPNE OG LUKKE ==========
const dialog = document.getElementById("skjema-dialog");
const skjema = document.getElementById("annonseskjema");
const skjemaOverskrift = document.getElementById("skjema-overskrift");
const sendKnapp = document.getElementById("send-knapp");
const isbnHjelp = document.getElementById("isbn-hjelp");
const hentBokinfoKnapp = document.getElementById("hent-bokinfo");
const ISBN_HJELPETEKST = isbnHjelp.textContent;

let redigererId = null; // id-en til annonsen som redigeres, eller null når en ny legges ut

// Lærestedene i nedtrekkslisten lages ut fra listen i js/hjelpere.js
skjema.elements.larested.insertAdjacentHTML("beforeend", LARESTEDER.map(l =>
  `<option value="${trygg(l.kort)}">${trygg(larestedNavn(l.kort))}</option>`).join(""));

// Åpner skjemaet for en ny annonse, eller for å redigere «annonse»
function apneSkjema(annonse = null) {
  // Et halvferdig utkast til en ny annonse beholdes, men ikke feltene fra en redigering
  if (annonse || redigererId) nullstillSkjema();
  redigererId = annonse ? annonse.id : null;
  if (annonse) fyllSkjema(annonse);
  else fyllUtSelger();
  skjemaOverskrift.textContent = annonse ? "Rediger annonse" : "Legg ut annonse";
  sendKnapp.textContent = annonse ? "Lagre endringer" : "Legg ut annonse";
  fjernAlleFeil();
  isbnHjelp.textContent = ISBN_HJELPETEKST;
  bildeHjelp.textContent = BILDE_HJELPETEKST;
  tegnSkjemaBilder();
  dialog.showModal();
  document.body.classList.add("modal-apen");
  skjema.elements.isbn.focus();
}
function lukkSkjema() {
  dialog.close();
}

// Tømmer alle feltene, også bildene
function nullstillSkjema() {
  skjema.reset();
  tomSkjemaBilder();
}

// Fyller ut skjemaet med en annonse som skal redigeres
function fyllSkjema(a) {
  const felt = skjema.elements;
  for (const navn of ["isbn", "tittel", "forfatter", "utgave", "emnekode", "larested", "tilstand", "by", "beskrivelse", "selger"]) {
    felt[navn].value = a[navn] ?? "";
  }
  felt.pris.value = String(a.pris ?? "").replace(".", ",");
  felt.kanSendes.checked = Boolean(a.kanSendes);
  skjemaBilder = (a.bilder ?? []).map(id => ({ id }));
}

// Navn og by fra din forrige annonse, så du slipper å skrive dem på nytt (som en profil)
function fyllUtSelger() {
  const forrige = sorterTreff(annonser.filter(erMin), "nyeste")[0];
  if (!forrige) return;
  if (!skjema.elements.selger.value) skjema.elements.selger.value = forrige.selger ?? "";
  if (!skjema.elements.by.value) skjema.elements.by.value = forrige.by ?? "";
}

document.getElementById("legg-ut-knapp").addEventListener("click", () => apneSkjema());
document.getElementById("lukk-knapp").addEventListener("click", lukkSkjema);
document.getElementById("avbryt-knapp").addEventListener("click", lukkSkjema);
// Kjøres uansett hvordan skjemaet lukkes (også med Esc-tasten)
dialog.addEventListener("close", () => document.body.classList.remove("modal-apen"));

// ========== SKJEMA: BILDER ==========
const MAKS_BILDER = 4;
const bildeliste = document.getElementById("bildeliste");
const leggTilBilde = document.getElementById("legg-til-bilde");
const bildeInput = document.getElementById("felt-bilder");
const bildeHjelp = document.getElementById("bilder-hjelp");
const BILDE_HJELPETEKST = bildeHjelp.textContent;

// Bildene i skjemaet, i rekkefølge: { id } for bilder som allerede er lagret, og
// { blob, url } for nye bilder som lagres når skjemaet sendes inn.
let skjemaBilder = [];
let bildebehandling = Promise.resolve(); // nye bilder som fortsatt skaleres ned

// Gjør et bilde mindre (maks 1200 px på den lengste siden) og lagrer det som JPEG,
// så det tar lite plass og lastes fort
async function skalerBilde(fil, maks = 1200) {
  const url = URL.createObjectURL(fil);
  try {
    const bilde = new Image();
    bilde.src = url;
    await bilde.decode();
    const skala = Math.min(1, maks / Math.max(bilde.naturalWidth, bilde.naturalHeight));
    const lerret = document.createElement("canvas");
    lerret.width = Math.round(bilde.naturalWidth * skala);
    lerret.height = Math.round(bilde.naturalHeight * skala);
    const tegning = lerret.getContext("2d");
    tegning.fillStyle = "#fff"; // gjennomsiktige PNG-er får hvit bakgrunn i stedet for svart
    tegning.fillRect(0, 0, lerret.width, lerret.height);
    tegning.drawImage(bilde, 0, 0, lerret.width, lerret.height);
    return await new Promise((ok, feil) =>
      lerret.toBlob(blob => (blob ? ok(blob) : feil(new Error("Kunne ikke lage bildet"))), "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function tegnSkjemaBilder() {
  bildeliste.innerHTML = skjemaBilder.map((b, i) => `
    <li class="skjemabilde">
      <img ${b.url ? `src="${b.url}"` : `data-bilde="${trygg(b.id)}"`} alt="Bilde ${i + 1}">
      ${i === 0 ? '<span class="forsidebilde-merke">Forsidebilde</span>' : ""}
      <button type="button" class="fjern-bilde" data-fjern-bilde="${i}" aria-label="Fjern bilde ${i + 1}">${kryssIkon}</button>
    </li>`).join("");
  lastBilder(bildeliste);
  leggTilBilde.hidden = skjemaBilder.length >= MAKS_BILDER;
}

// Fjerner bildene fra skjemaet. Forhåndsvisninger av nye, ulagrede bilder frigjøres.
function tomSkjemaBilder() {
  for (const b of skjemaBilder) if (b.blob) URL.revokeObjectURL(b.url);
  skjemaBilder = [];
}

bildeInput.addEventListener("change", () => {
  const filer = [...bildeInput.files];
  bildeInput.value = ""; // så samme bilde kan velges igjen senere
  bildebehandling = (async () => {
    const plass = MAKS_BILDER - skjemaBilder.length;
    const ulesbare = [];
    for (const fil of filer.slice(0, plass)) {
      try {
        const blob = await skalerBilde(fil);
        skjemaBilder.push({ blob, url: URL.createObjectURL(blob) });
      } catch {
        ulesbare.push(`«${fil.name}»`);
      }
    }
    tegnSkjemaBilder();
    const forMange = filer.length - plass;
    if (forMange > 0) {
      bildeHjelp.textContent = `Du kan ha opptil ${MAKS_BILDER} bilder, så ${forMange === 1 ? "ett bilde" : `${forMange} bilder`} ble ikke lagt til.`;
    } else if (ulesbare.length) {
      bildeHjelp.textContent = `Kunne ikke lese ${ulesbare.join(", ")}. Prøv et JPG- eller PNG-bilde.`;
    } else {
      bildeHjelp.textContent = `${filer.length === 1 ? "Bildet" : "Bildene"} er lagt til. Det første bildet blir forsidebildet.`;
    }
  })();
});

bildeliste.addEventListener("click", e => {
  const knapp = e.target.closest("[data-fjern-bilde]");
  if (!knapp) return;
  const nr = Number(knapp.dataset.fjernBilde);
  const [fjernet] = skjemaBilder.splice(nr, 1);
  if (fjernet.blob) URL.revokeObjectURL(fjernet.url);
  tegnSkjemaBilder();
  bildeHjelp.textContent = `Bilde ${nr + 1} er fjernet.`;
  // Fokus til «Fjern» på bildet som nå står på samme plass, eller til «Legg til bilder»
  const knapper = bildeliste.querySelectorAll("[data-fjern-bilde]");
  (knapper[Math.min(nr, knapper.length - 1)] ?? bildeInput).focus();
});

// Lagrer de nye bildene i datalaget og gir ID-ene til alle bildene i skjemaet, i rekkefølge.
// Kaster en feil hvis et bilde ikke kunne lagres.
async function lagreSkjemaBilder() {
  const ider = [];
  for (const b of skjemaBilder) {
    if (!b.id) {
      b.id = await Data.lagreBilde(b.blob);
      bildeUrler.set(b.id, b.url); // forhåndsvisningen brukes videre som bildets adresse
      delete b.blob;
    }
    ider.push(b.id);
  }
  return ider;
}

// ========== SKJEMA: VALIDERING ==========
// Gjør om tekst som «1 200», «350,50» eller «350 kr» til et tall. Gir null hvis ugyldig.
function tolkPris(tekst) {
  const renset = String(tekst)
    .replace(/\s/g, "")
    .replace(/kr\.?$/i, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(renset)) return null;
  const tall = Number(renset);
  return tall > 0 ? tall : null;
}

const MAKSPRIS = 10000; // en høyere pris er nesten alltid en skrivefeil

// «mat 1100» → «MAT1100»
function rensEmnekode(tekst) {
  return String(tekst).toUpperCase().replace(/\s+/g, "");
}

// Én regel per felt, i samme rekkefølge som i skjemaet. Hver regel gir en feilmelding,
// eller tom tekst hvis alt er i orden.
const REGLER = {
  isbn:      v => !v || tolkIsbn(v) ? "" : "Sjekk ISBN-et. Det skal ha 10 eller 13 siffer.",
  tittel:    v => v ? "" : "Skriv inn tittelen på boken.",
  forfatter: v => v ? "" : "Skriv inn hvem som har skrevet boken.",
  emnekode:  v => {
    if (!v) return "Skriv inn emnekoden, for eksempel MAT1100.";
    if (!/^[A-ZÆØÅ0-9-]+$/.test(rensEmnekode(v))) return "Emnekoden kan bare inneholde bokstaver, tall og bindestrek.";
    return "";
  },
  larested:  v => v ? "" : "Velg hvilket lærested emnet hører til.",
  pris:      v => {
    if (!v) return "Skriv inn en pris.";
    const tall = tolkPris(v);
    if (tall === null) return "Prisen må være et tall større enn 0, for eksempel 350.";
    if (tall > MAKSPRIS) return `Prisen kan ikke være høyere enn ${formaterPris(MAKSPRIS)}.`;
    return "";
  },
  tilstand:  v => v ? "" : "Velg hvilken tilstand boken er i.",
  by:        v => v ? "" : "Skriv inn hvilken by du selger fra.",
  selger:    v => v ? "" : "Skriv inn navnet ditt."
};

function verdi(navn) {
  return skjema.elements[navn].value.trim();
}

function visFeil(navn, tekst) {
  const felt = skjema.elements[navn];
  document.getElementById("feil-" + navn).textContent = tekst;
  if (tekst) felt.setAttribute("aria-invalid", "true");
  else felt.removeAttribute("aria-invalid");
}

function fjernAlleFeil() {
  Object.keys(REGLER).forEach(navn => visFeil(navn, ""));
}

// Sjekker et felt på nytt hvis det er merket med feil (feilmeldingen forsvinner når det er rettet)
function sjekkPaNytt(navn) {
  if (skjema.elements[navn].getAttribute("aria-invalid") === "true") visFeil(navn, REGLER[navn](verdi(navn)));
}

Object.keys(REGLER).forEach(navn => {
  skjema.elements[navn].addEventListener("input", () => sjekkPaNytt(navn));
  skjema.elements[navn].addEventListener("change", () => sjekkPaNytt(navn));
});

// Feltene i skjemaet, slik de lagres i annonsen
function lesSkjema() {
  return {
    tittel: verdi("tittel"),
    forfatter: verdi("forfatter"),
    utgave: verdi("utgave"),
    isbn: tolkIsbn(verdi("isbn")) ?? "",
    emnekode: rensEmnekode(verdi("emnekode")),
    larested: verdi("larested"),
    pris: tolkPris(verdi("pris")),
    tilstand: verdi("tilstand"),
    by: verdi("by"),
    kanSendes: skjema.elements.kanSendes.checked,
    beskrivelse: verdi("beskrivelse"),
    selger: verdi("selger")
  };
}

// ========== SKJEMA: HENT BOKINFO FRA ISBN ==========
// Fyller ut tittel og forfatter fra en bokdatabase (se Data.finnBok i js/data.js)
let henterBokinfo = false;

async function hentBokinfo() {
  if (henterBokinfo) return;
  const isbn = tolkIsbn(verdi("isbn"));
  if (!isbn) {
    visFeil("isbn", verdi("isbn") ? REGLER.isbn(verdi("isbn")) : "Skriv inn ISBN-et først.");
    skjema.elements.isbn.focus();
    return;
  }
  visFeil("isbn", "");
  henterBokinfo = true;
  isbnHjelp.textContent = "Henter bokinfo …";
  try {
    const bok = await Data.finnBok(isbn);
    if (bok) {
      skjema.elements.tittel.value = bok.tittel;
      if (bok.forfatter) skjema.elements.forfatter.value = bok.forfatter;
      sjekkPaNytt("tittel");
      sjekkPaNytt("forfatter");
      isbnHjelp.textContent = `Fant «${bok.tittel}». Sjekk at tittel og forfatter stemmer.`;
    } else {
      isbnHjelp.textContent = "Fant ikke boka. Fyll inn tittel og forfatter selv.";
    }
  } catch {
    isbnHjelp.textContent = "Fikk ikke kontakt med bokdatabasen. Fyll inn tittel og forfatter selv.";
  } finally {
    henterBokinfo = false;
  }
}

hentBokinfoKnapp.addEventListener("click", hentBokinfo);
// Enter i ISBN-feltet henter bokinfo i stedet for å sende skjemaet
skjema.elements.isbn.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    hentBokinfo();
  }
});

// ========== SKJEMA: SENDE INN ==========
let senderInn = false; // hindrer at et dobbeltklikk legger ut annonsen to ganger

skjema.addEventListener("submit", async e => {
  e.preventDefault();
  if (senderInn) return;

  // Sjekk alle felt og husk det første med feil
  let forsteFeil = null;
  for (const navn of Object.keys(REGLER)) {
    const feiltekst = REGLER[navn](verdi(navn));
    visFeil(navn, feiltekst);
    if (feiltekst && !forsteFeil) forsteFeil = navn;
  }
  if (forsteFeil) {
    skjema.elements[forsteFeil].focus();
    return;
  }

  senderInn = true;
  try {
    await sendInn();
  } finally {
    senderInn = false;
  }
});

async function sendInn() {
  // Bildene lagres først, så annonsen aldri peker på bilder som ikke finnes
  await bildebehandling;
  let bilder;
  let bildefeil = false;
  try {
    bilder = await lagreSkjemaBilder();
  } catch (feil) {
    console.warn("Kunne ikke lagre bilder:", feil);
    bildefeil = true;
    bilder = skjemaBilder.filter(b => b.id).map(b => b.id);
  }

  if (redigererId) {
    await lagreEndringer(bilder, bildefeil);
    return;
  }

  const nyAnnonse = {
    id: nyId(),
    ...lesSkjema(),
    bilder,
    eier: bruker.id,
    dato: dagensDato(),
    opprettet: Date.now(),
    status: "Til salgs"
  };

  annonser.unshift(nyAnnonse);

  nullstillSkjema();
  lukkSkjema();

  // Gå til alle annonser, tøm søk og filtre og sorter på nyeste, slik at den nye annonsen synes øverst
  listeScroll = 0;
  nullstillSokOgFiltre();
  sorteringValg.value = "nyeste";
  visesAntall = SIDESTORRELSE;
  byggValg(); // en ny by eller et nytt lærested kan ha kommet til
  sistLagtUtId = nyAnnonse.id;
  gaTilListe("alle", Boolean(annonseIdFraAdresse()));
  sistLagtUtId = null;
  window.scrollTo({ top: 0, behavior: "smooth" });

  const lagret = await Data.leggTilAnnonse(nyAnnonse);
  if (!lagret) {
    visMelding("Annonsen er lagt ut, men kunne ikke lagres i nettleseren. Den forsvinner hvis du laster inn siden på nytt.", 6000);
  } else if (bildefeil) {
    visMelding("Annonsen er lagt ut, men bildene kunne ikke lagres i nettleseren.", 6000);
  } else {
    visMelding("Annonsen din er lagt ut.");
  }
}

// ========== SKJEMA: LAGRE ENDRINGER ==========
async function lagreEndringer(bilder, bildefeil) {
  const a = annonser.find(x => x.id === redigererId);
  redigererId = null;
  if (!a || !erMin(a)) {
    lukkSkjema();
    return;
  }
  const fjernedeBilder = (a.bilder ?? []).filter(id => !bilder.includes(id));
  const endringer = { ...lesSkjema(), bilder, endret: Date.now() };
  Object.assign(a, endringer);
  nullstillSkjema();
  lukkSkjema();
  byggValg(); // byen eller lærestedet kan være endret
  tegnPaNytt();

  // «Rediger»-knappen ble tegnet på nytt – sett fokus på den nye
  const rediger = annonseIdFraAdresse()
    ? detaljInnhold.querySelector('[data-handling="rediger"]')
    : mineAnnonserListe.querySelector(`[data-id="${CSS.escape(a.id)}"] [data-handling="rediger"]`);
  if (rediger) rediger.focus();

  const lagret = await Data.oppdaterAnnonse(a.id, endringer);
  if (lagret) {
    for (const id of fjernedeBilder) {
      await Data.slettBilde(id);
      glemBilde(id);
    }
  }
  visMelding(!lagret ? "Endringene ble gjort, men kunne ikke lagres i nettleseren."
    : bildefeil ? "Endringene er lagret, men nye bilder kunne ikke lagres." : "Endringene er lagret.");
}
