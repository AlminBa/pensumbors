// Små hjelpefunksjoner og ikoner som brukes over hele appen.

// ========== IKONER ==========
const hjerteIkon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.5-9.3C1.2 8 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.4 3.5 4.1 6.7-2 4.7-9.5 9.3-9.5 9.3z"/></svg>';
const stedIkon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const kryssIkon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>';

// ========== HJELPEFUNKSJONER ==========
// Gjør tekst trygg å vise i HTML, slik at det brukere skriver ikke kan ødelegge siden
function trygg(tekst) {
  return String(tekst ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Hardt mellomrom (\u00A0) gjør at «350 kr» aldri deles over to linjer
function formaterPris(pris) {
  const tall = Number(pris);
  if (!Number.isFinite(tall)) return "Pris ikke oppgitt";
  return tall.toLocaleString("nb-NO", { maximumFractionDigits: 2 }) + "\u00A0kr";
}

// «2026-10-18» → «18. oktober 2026»
function formaterDato(dato) {
  const d = new Date(String(dato) + "T12:00:00");
  if (isNaN(d)) return String(dato ?? "");
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

// Dagens dato som ÅÅÅÅ-MM-DD etter norsk (lokal) tid
function dagensDato() {
  const d = new Date();
  const mnd = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mnd}-${dag}`;
}

// Lager en unik ID for nye annonser
function nyId() {
  return "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Bynavn sammenlignes uten forskjell på store og små bokstaver («oslo» = «Oslo»)
function bynokkel(by) {
  return String(by ?? "").trim().toLocaleLowerCase("nb");
}

// «bodø» → «Bodø»
function storForbokstav(tekst) {
  const s = String(tekst ?? "");
  return s.charAt(0).toLocaleUpperCase("nb") + s.slice(1);
}

// Gir et tall ut fra en tekst (samme tekst gir alltid samme tall)
function tekstTilTall(tekst) {
  let sum = 0;
  for (const tegn of String(tekst)) sum = (sum * 31 + tegn.charCodeAt(0)) >>> 0;
  return sum;
}

// Samme emnekode får alltid samme omslagsfarge
const OMSLAGSFARGER = ["#2F6B4F", "#7E4E3B", "#35566F", "#6E6232", "#57476B", "#2B6463", "#8A5C2E", "#4A5D3A"];
function omslagsfarge(emnekode) {
  return OMSLAGSFARGER[tekstTilTall(emnekode) % OMSLAGSFARGER.length];
}

// ========== STATUS ==========
const STATUSER = ["Til salgs", "Reservert", "Solgt"];
const STATUSKLASSER = { "Til salgs": "status-til-salgs", "Reservert": "status-reservert", "Solgt": "status-solgt" };

// Gir alltid en gyldig status (eldre eller ødelagte data blir «Til salgs»)
function statusFor(a) {
  return STATUSER.includes(a.status) ? a.status : "Til salgs";
}
function statusMerke(status) {
  return `<span class="status ${STATUSKLASSER[status]}">${trygg(status)}</span>`;
}

// ========== TILSTAND ==========
const TILSTANDER = ["Som ny", "God", "Brukt", "Godt brukt"];

// ========== LÆRESTEDER ==========
// «kort» lagres i annonsen og vises på kortene og i filteret, «navn» vises i skjemaet og detaljene
const LARESTEDER = [
  { kort: "UiO", navn: "Universitetet i Oslo" },
  { kort: "UiB", navn: "Universitetet i Bergen" },
  { kort: "NTNU", navn: "NTNU" },
  { kort: "UiT", navn: "UiT Norges arktiske universitet" },
  { kort: "UiS", navn: "Universitetet i Stavanger" },
  { kort: "UiA", navn: "Universitetet i Agder" },
  { kort: "NMBU", navn: "NMBU" },
  { kort: "OsloMet", navn: "OsloMet" },
  { kort: "Nord", navn: "Nord universitet" },
  { kort: "USN", navn: "Universitetet i Sørøst-Norge" },
  { kort: "HVL", navn: "Høgskulen på Vestlandet" },
  { kort: "INN", navn: "Høgskolen i Innlandet" },
  { kort: "BI", navn: "Handelshøyskolen BI" },
  { kort: "NHH", navn: "Norges Handelshøyskole" },
  { kort: "Kristiania", navn: "Høyskolen Kristiania" },
  { kort: "Annet", navn: "Annet lærested" }
];

// «UiO» → «Universitetet i Oslo (UiO)». Ukjente verdier vises som de er.
function larestedNavn(kort) {
  const larested = LARESTEDER.find(l => l.kort === kort);
  if (!larested) return String(kort ?? "");
  return larested.navn === kort || kort === "Annet" ? larested.navn : `${larested.navn} (${kort})`;
}

// ========== ISBN ==========
// Kontrollsifferet til et ISBN-13, ut fra de tolv første sifrene
function kontrollsiffer13(tolv) {
  const sum = [...tolv].reduce((sum, siffer, i) => sum + Number(siffer) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

// Gir ISBN-13 (bare siffer) for et gyldig ISBN-10 eller ISBN-13, ellers null. Bindestreker og
// mellomrom er lov. ISBN-10 gjøres om til ISBN-13, så samme bok alltid får samme nummer.
function tolkIsbn(tekst) {
  const s = String(tekst ?? "").replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(s)) return kontrollsiffer13(s.slice(0, 12)) === s[12] ? s : null;
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((sum, tegn, i) => sum + (tegn === "X" ? 10 : Number(tegn)) * (10 - i), 0);
    if (sum % 11 !== 0) return null;
    const tolv = "978" + s.slice(0, 9);
    return tolv + kontrollsiffer13(tolv);
  }
  return null;
}

// ========== OPPDIKTET E-POSTADRESSE ==========
// Lager en falsk, men realistisk adresse ut fra selgerens fornavn.
// «.example» er et domene som er reservert for eksempler, så ingen ekte person får e-posten.
function lagEpost(a) {
  let navn = String(a.selger ?? "").trim().split(/\s+/)[0].toLocaleLowerCase("nb")
    .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // fjerner aksenter, f.eks. é → e
    .replace(/[^a-z0-9]/g, "");
  if (!navn) navn = "selger";
  const tall = 100 + (tekstTilTall(a.id) % 900);
  return `${navn}.${tall}@pensumbors.example`;
}
