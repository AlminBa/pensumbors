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
    if (Array.isArray(data)) return data;
    const kopi = EKSEMPELANNONSER.map(a => ({ ...a }));
    skriv(ANNONSENOKKEL, kopi);
    return kopi;
  }

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

    // Kaller «funksjon» med "annonser" eller "favoritter" når en annen fane har lagret noe
    vedEndring(funksjon) {
      window.addEventListener("storage", e => {
        if (e.key === ANNONSENOKKEL) funksjon("annonser");
        else if (e.key === FAVORITTNOKKEL) funksjon("favoritter");
      });
    }
  };
})();
