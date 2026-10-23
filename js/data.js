// ========== DATALAG ==========
// All lagring går gjennom «Data». I dag ligger alt i nettleseren (localStorage), men resten
// av appen vet ikke det: den kaller bare funksjonene under og venter på svaret (de er async).
// Får Pensumbørs en ekte server senere (f.eks. Supabase), er det bare denne fila som må
// skrives om – resten av appen kan stå som den er.
//
// Funksjonene som lagrer gir true hvis det gikk bra, og false hvis nettleseren ikke
// tillot lagring (da finnes endringen bare til siden lastes inn på nytt).
const Data = (() => {
  const ANNONSENOKKEL = "pensumbors_annonser_v1";
  const FAVORITTNOKKEL = "pensumbors_favoritter_v1";

  function les(nokkel) {
    try {
      return JSON.parse(localStorage.getItem(nokkel));
    } catch (feil) {
      console.warn("Kunne ikke lese fra nettleseren:", feil);
      return null;
    }
  }

  function skriv(nokkel, verdi) {
    try {
      localStorage.setItem(nokkel, JSON.stringify(verdi));
      return true;
    } catch (feil) {
      console.warn("Kunne ikke lagre i nettleseren:", feil);
      return false;
    }
  }

  // Lagrede annonser, eller eksempelannonsene første gang appen åpnes
  function lesAnnonser() {
    const data = les(ANNONSENOKKEL);
    if (Array.isArray(data)) return oppgrader(data);
    const kopi = EKSEMPELANNONSER.map(a => ({ ...a }));
    skriv(ANNONSENOKKEL, kopi);
    return kopi;
  }

  // Eksempelannonser som ble lagret av en eldre versjon, får feltene som har kommet til
  // siden (lærested, «kan sendes» osv.). Det som er endret, f.eks. status, beholdes.
  function oppgrader(liste) {
    for (const annonse of liste) {
      const eksempel = EKSEMPELANNONSER.find(e => e.id === annonse.id);
      if (eksempel) for (const felt in eksempel) if (!(felt in annonse)) annonse[felt] = eksempel[felt];
    }
    return liste;
  }

  // ["A", "B", "C"] → «A, B og C»
  function ogListe(navn) {
    return navn.length > 1 ? navn.slice(0, -1).join(", ") + " og " + navn[navn.length - 1] : (navn[0] ?? "");
  }

  // Bokdatabasene vi spør om ISBN: Google Books først, Open Library som reserve.
  // Hver gir { tittel, forfatter }, eller null hvis den ikke kjenner boka.
  const BOKKILDER = [
    async isbn => {
      const svar = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, { signal: AbortSignal.timeout?.(8000) });
      if (!svar.ok) throw new Error(`Google Books svarte ${svar.status}`);
      const bok = (await svar.json()).items?.[0]?.volumeInfo;
      return bok?.title ? { tittel: [bok.title, bok.subtitle].filter(Boolean).join(": "), forfatter: ogListe(bok.authors ?? []) } : null;
    },
    async isbn => {
      const svar = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, { signal: AbortSignal.timeout?.(8000) });
      if (!svar.ok) throw new Error(`Open Library svarte ${svar.status}`);
      const bok = (await svar.json())[`ISBN:${isbn}`];
      return bok?.title ? { tittel: [bok.title, bok.subtitle].filter(Boolean).join(": "), forfatter: ogListe((bok.authors ?? []).map(f => f.name)) } : null;
    }
  ];

  function lesFavoritter() {
    const data = les(FAVORITTNOKKEL);
    return Array.isArray(data) ? data.map(String) : [];
  }

  // Endringer leses inn på nytt rett før de lagres, slik at vi ikke skriver over
  // det en annen fane har lagret i mellomtiden.
  return {
    async hentAnnonser() {
      return lesAnnonser();
    },

    async leggTilAnnonse(annonse) {
      const liste = lesAnnonser();
      liste.unshift(annonse);
      return skriv(ANNONSENOKKEL, liste);
    },

    async oppdaterAnnonse(id, endringer) {
      const liste = lesAnnonser();
      const annonse = liste.find(a => a.id === id);
      if (!annonse) return false;
      Object.assign(annonse, endringer);
      return skriv(ANNONSENOKKEL, liste);
    },

    async hentFavoritter() {
      return new Set(lesFavoritter());
    },

    async settFavoritt(id, erFavoritt) {
      const liste = lesFavoritter().filter(f => f !== id);
      if (erFavoritt) liste.push(id);
      return skriv(FAVORITTNOKKEL, liste);
    },

    // Slår opp en bok på ISBN-13. Gir { tittel, forfatter }, eller null hvis ingen kjenner boka.
    // Kaster en feil bare hvis ingen av bokdatabasene kunne nås.
    async finnBok(isbn) {
      let noenSvarte = false;
      for (const kilde of BOKKILDER) {
        try {
          const bok = await kilde(isbn);
          noenSvarte = true;
          if (bok) return bok;
        } catch (feil) {
          console.warn("ISBN-oppslag feilet:", feil);
        }
      }
      if (noenSvarte) return null;
      throw new Error("Fikk ikke kontakt med bokdatabasene");
    },

    // Kaller «funksjon» med "annonser" eller "favoritter" når en annen fane har lagret noe
    vedEndring(funksjon) {
      window.addEventListener("storage", e => {
        if (e.key === ANNONSENOKKEL) funksjon("annonser");
        else if (e.key === FAVORITTNOKKEL) funksjon("favoritter");
      });
    }
  };
})();
