
# Pensumbørs 📚

Pensumbørs is a marketplace where students in Norway can buy and sell used
textbooks. Students can search by course code, filter by price, condition and
institution, and post their own listings with photos.

**Live:** https://alminba.github.io/pernsumbors/

## Why I built it

Textbooks are expensive, and many students only use a book for one semester.
Selling used books today usually happens in scattered Facebook groups or
general marketplaces, where it is hard to find the right book for a specific
course. Pensumbørs makes it easy to search by course code and find cheap
used books from other students.

## Features

Many of the features are inspired by [FINN.no](https://www.finn.no).

**Finding books**
- Search by course code, title, author, institution or ISBN. Each word matches
  the start of a word, and course codes work with or without a space
  ("tma 4100" finds TMA4100)
- Filter by price, condition, institution and city, show only books that can
  be shipped, and hide sold books
- Every filter option shows how many books it gives, and active filters appear
  as chips you can remove one by one
- The search and filters are part of the address, so a search can be shared as
  a link or bookmarked, and the back button works as expected
- Save a search and see on "Min side" how many new books have been posted since
  you last looked; the menu shows a badge when there are new ones
- 24 books are shown at a time, with "Vis flere" for the rest

**Selling books**
- Post a listing with up to four photos, title, author, edition, ISBN, course
  code, institution, price, condition, city and whether you can ship the book
- Type the ISBN and press "Hent bokinfo" to fill in the title and author
  automatically (from Google Books, with Open Library as a fallback)
- "Min side" lists your own listings, where you can change the status
  (for sale, reserved, sold), edit and delete them
- Only the person who posted a listing can change or delete it

**Each listing**
- Photo gallery, all the facts, and a "Kontakt selger" button
- "Flere bøker for …" shows other books for the same course or the same ISBN
- Share a listing with the phone's share menu, or copy the link
- Save favourites with the heart

**Everywhere**
- Works on mobile and desktop, with a bottom menu on phones like the FINN app
- Built with accessibility in mind: keyboard navigation, screen reader labels,
  focus handling in dialogs and reduced motion
- Favicon and link previews when the site is shared on Messenger or Facebook

## How it was built

This app was made for a university assignment about vibe coding: building an
app by describing it in natural language and letting AI write the code. I
built it with Claude, adding one feature at a time and testing after each step.

## Technical details

- Plain HTML, CSS and JavaScript, with no build step and no dependencies
- Hosted on GitHub Pages, and it also works when `index.html` is opened
  straight from disk
- Listings, favourites and saved searches are stored in the browser's
  `localStorage`; photos are stored in the browser's IndexedDB
- All the sample listings in the app are made up

### Project structure

| File | What it does |
| --- | --- |
| `index.html` | The page itself (markup only) |
| `css/stil.css` | All the styling |
| `js/eksempeldata.js` | The sample listings shown the first time the app opens |
| `js/data.js` | **The data layer.** All saving and loading goes through here |
| `js/hjelpere.js` | Small helpers: formatting, ISBN check, institutions, icons |
| `js/visninger.js` | Draws the list of listings and the detail view |
| `js/sok.js` | Search, filters, sorting and the filter panel on mobile |
| `js/skjema.js` | The form for posting and editing a listing, with photos |
| `js/minside.js` | "Min side": your listings, status, edit and delete |
| `js/lagredesok.js` | Saved searches and the badge for new listings |
| `js/app.js` | App state, switching between views, and start-up |
| `bilder/` | Favicon, home-screen icon and the image used in link previews |

The scripts are loaded in order with `defer` and share variables, so the order
in `index.html` matters.

### Running it locally

Open `index.html` in a browser. To test it the same way GitHub Pages serves it,
run a small local server from the project folder, for example
`npx serve .`, and open the address it prints.

## Limitations and next steps

- **No server yet.** Everything is stored in your own browser, so other people
  cannot see the listings you post. Without user accounts, "the owner" of a
  listing is simply the browser it was posted from.
- **The next step is a backend**, for example [Supabase](https://supabase.com).
  The rest of the app only talks to `js/data.js`, and all its functions are
  already async, so that is the only file that has to be rewritten. The
  checklist for that step:
  - user login, so `Data.hentBruker()` returns the logged-in user
  - tables for listings, favourites and saved searches, and file storage for
    photos
  - Row Level Security, so users can only change and delete their own
    listings (the check in the browser can be bypassed)
  - checking the data on the server as well (price, lengths, course code)
  - in-app messages instead of showing contact details openly
- The link preview image needs a full address. If the site moves (for example
  if the repository is renamed), update `og:url` and `og:image` in
  `index.html`.

## Author

Alminba
