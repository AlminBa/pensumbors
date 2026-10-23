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
  const BRUKERNOKKEL = "pensumbors_bruker_v1";
  const SOKNOKKEL = "pensumbors_lagrede_sok_v1";

  let brukerId = null;

  // Uten innlogging er «brukeren» denne nettleseren: en tilfeldig ID som huskes.
  // Med en ekte server blir dette ID-en til den som er logget inn.
  function minBrukerId() {
    if (brukerId) return brukerId;
    try {
      brukerId = localStorage.getItem(BRUKERNOKKEL);
    } catch {
      // nettleseren tillater ikke lagring – da får brukeren en ny ID hver gang
    }
    if (!brukerId) {
      brukerId = "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(BRUKERNOKKEL, brukerId); } catch { /* se over */ }
    }
    return brukerId;
  }

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

  // Data lagret av en eldre versjon gjøres oppdatert:
  //  - eksempelannonsene får feltene som har kommet til siden (lærested, «kan sendes» osv.),
  //    mens det brukeren har endret, f.eks. status, beholdes
  //  - annonser lagt ut i denne nettleseren før annonser fikk en eier, blir brukerens egne
  function oppgrader(liste) {
    for (const annonse of liste) {
      const eksempel = EKSEMPELANNONSER.find(e => e.id === annonse.id);
      if (eksempel) for (const felt in eksempel) if (!(felt in annonse)) annonse[felt] = eksempel[felt];
      if (annonse.opprettet && !annonse.eier) annonse.eier = minBrukerId();
    }
    return liste;
  }

  // ========== BILDER (IndexedDB) ==========
  // Bilder er for store for localStorage, så de ligger i nettleserens database (IndexedDB).
  // Med en ekte server legges de i en fillagring (f.eks. Supabase Storage) i stedet.
  let bildeDb = null;

  function apneBildeDb() {
    bildeDb ??= new Promise((ok, feil) => {
      const foresporsel = indexedDB.open("pensumbors", 1);
      foresporsel.onupgradeneeded = () => foresporsel.result.createObjectStore("bilder");
      foresporsel.onsuccess = () => ok(foresporsel.result);
      foresporsel.onerror = () => feil(foresporsel.error);
    });
    return bildeDb;
  }

  // Kjører «handling» på bildelageret og venter til endringen faktisk er lagret
  async function iBildelageret(modus, handling) {
    const db = await apneBildeDb();
    return new Promise((ok, feil) => {
      const transaksjon = db.transaction("bilder", modus);
      const foresporsel = handling(transaksjon.objectStore("bilder"));
      transaksjon.oncomplete = () => ok(foresporsel.result);
      transaksjon.onerror = transaksjon.onabort = () => feil(transaksjon.error);
    });
  }

  async function slettBilde(id) {
    try {
      await iBildelageret("readwrite", lager => lager.delete(id));
      return true;
    } catch (feil) {
      console.warn("Kunne ikke slette bilde:", feil);
      return false;
    }
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

  function lesLagredeSok() {
    const data = les(SOKNOKKEL);
    return Array.isArray(data) ? data : [];
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

    // Sletter annonsen og bildene dens
    async slettAnnonse(id) {
      const liste = lesAnnonser();
      const annonse = liste.find(a => a.id === id);
      const lagret = skriv(ANNONSENOKKEL, liste.filter(a => a.id !== id));
      for (const bildeId of annonse?.bilder ?? []) await slettBilde(bildeId);
      return lagret;
    },

    // Lagrer et bilde (en Blob) og gir ID-en det fikk. Kaster en feil hvis det ikke gikk.
    async lagreBilde(blob) {
      const id = "bilde-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await iBildelageret("readwrite", lager => lager.put(blob, id));
      return id;
    },

    // Gir bildet (en Blob), eller null hvis det ikke finnes
    async hentBilde(id) {
      try {
        return (await iBildelageret("readonly", lager => lager.get(id))) ?? null;
      } catch (feil) {
        console.warn("Kunne ikke hente bilde:", feil);
        return null;
      }
    },

    slettBilde,

    // Den som bruker appen. Annonser med samme «eier» er brukerens egne.
    async hentBruker() {
      return { id: minBrukerId() };
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

    // Lagrede søk: { id, navn, sokedel, opprettet, sistSett }. «sokedel» er søket slik det står
    // i adressen (?q=…), «sistSett» er når brukeren sist så treffene (for å finne nye annonser).
    async hentLagredeSok() {
      return lesLagredeSok();
    },

    async lagreSok(sok) {
      const liste = lesLagredeSok().filter(s => s.id !== sok.id && s.sokedel !== sok.sokedel);
      liste.unshift(sok);
      return skriv(SOKNOKKEL, liste);
    },

    async slettSok(id) {
      return skriv(SOKNOKKEL, lesLagredeSok().filter(s => s.id !== id));
    },

    async merkSokSomSett(id, tidspunkt) {
      const liste = lesLagredeSok();
      const sok = liste.find(s => s.id === id);
      if (!sok) return false;
      sok.sistSett = tidspunkt;
      return skriv(SOKNOKKEL, liste);
    },

    // Kaller «funksjon» med "annonser", "favoritter" eller "lagrede-sok" når en annen fane har lagret noe
    vedEndring(funksjon) {
      window.addEventListener("storage", e => {
        if (e.key === ANNONSENOKKEL) funksjon("annonser");
        else if (e.key === FAVORITTNOKKEL) funksjon("favoritter");
        else if (e.key === SOKNOKKEL) funksjon("lagrede-sok");
      });
    }
  };
})();
