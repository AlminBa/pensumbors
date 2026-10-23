// Skjemaet for å legge ut en annonse.

// ========== SKJEMA: ÅPNE OG LUKKE ==========
const dialog = document.getElementById("skjema-dialog");
const skjema = document.getElementById("annonseskjema");
const isbnHjelp = document.getElementById("isbn-hjelp");
const hentBokinfoKnapp = document.getElementById("hent-bokinfo");
const ISBN_HJELPETEKST = isbnHjelp.textContent;

// Lærestedene i nedtrekkslisten lages ut fra listen i js/hjelpere.js
skjema.elements.larested.insertAdjacentHTML("beforeend", LARESTEDER.map(l =>
  `<option value="${trygg(l.kort)}">${trygg(larestedNavn(l.kort))}</option>`).join(""));

function apneSkjema() {
  fjernAlleFeil();
  isbnHjelp.textContent = ISBN_HJELPETEKST;
  dialog.showModal();
  document.body.classList.add("modal-apen");
  skjema.elements.isbn.focus();
}
function lukkSkjema() {
  dialog.close();
}

document.getElementById("legg-ut-knapp").addEventListener("click", apneSkjema);
document.getElementById("lukk-knapp").addEventListener("click", lukkSkjema);
document.getElementById("avbryt-knapp").addEventListener("click", lukkSkjema);
// Kjøres uansett hvordan skjemaet lukkes (også med Esc-tasten)
dialog.addEventListener("close", () => document.body.classList.remove("modal-apen"));

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
skjema.addEventListener("submit", async e => {
  e.preventDefault();

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

  const nyAnnonse = {
    id: nyId(),
    ...lesSkjema(),
    dato: dagensDato(),
    opprettet: Date.now(),
    status: "Til salgs"
  };

  annonser.unshift(nyAnnonse);

  skjema.reset();
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
  if (lagret) {
    visMelding("Annonsen din er lagt ut.");
  } else {
    visMelding("Annonsen er lagt ut, men kunne ikke lagres i nettleseren. Den forsvinner hvis du laster inn siden på nytt.", 6000);
  }
});
