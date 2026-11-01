# The Skyn Room - plan novog sajta

## 1. Polazište

**Referenca stila:** ogakidigital.com
- topla svetla pozadina, puno praznog prostora
- veliki tanki serif naslovi + sitne grotesk VERZAL oznake u zagradama, npr. `(WE ARE)`
- hero sa ogromnim "razbacanim" slovima
- centralna slika koja se zaustavi (pin) dok male slike prolaze pored nje
- tekst-linkovi sa strelicom (`ABOUT US →`), studije slučaja u 3 kolone, footer sa velikim serif naslovom

**Sadržaj:** theskynroom.com (Wix). Preuzeto:
- svi tekstovi (Home, About, Treatment Menu)
- 8 tretmana: Signature Custom Facial, Botox Facial, Ultimate Glass Skin Facial, Dermaplane Facial, RDS Chemical Peel, Acne Relief Facial, Growth Factor Microneedling, PDRN Microneedling
- 19 slika (portret, 8 fotografija tretmana, 6 before/after, 4 ambijentalne), konvertovane u WebP
- linkovi: Instagram @skynbymelissa, TikTok @theskynroom, Amazon storefront
- vlasnica: Melissa Wohl, osnovano 2025

**Booking:** svako "Book Now" dugme vodi na https://www.vagaro.com/theskynroom1/services

**Brend:** logo.png (braon Skyn ROOM) + paleta
| Token | Boja | Upotreba |
|---|---|---|
| `--cream` | #FFFBF0 | pozadina |
| `--brown` | #422306 | tekst, logo, dugmad |
| `--taupe` | #735E4B | sekundarni tekst, linije, akcenat |

Dark mode (sistemski): tamno braon pozadina, krem tekst, logo se automatski boji (CSS mask).

## 2. Dizajn sistem

- **Fontovi (lokalno hostovani):** Newsreader (serif, light 300, sa italikom) za naslove i velike paragrafe, kao zamena za OGAKI "Reckless". Geist za sitne verzal oznake, navigaciju i dugmad, kao zamena za "GT America".
- **Oblici:** slike i površine imaju oštre ivice (0 radius), interaktivna dugmad su "pill". Jedno pravilo za ceo sajt.
- **Tonovi sekcija:** pozadina se smenjuje po sekcijama preko klasa koje lokalno menjaju boje (tekst, linije i dugmad se sami prilagode):
  | Klasa | Svetli režim | Tamni režim | Gde |
  |---|---|---|---|
  | `tone-sand` | bež #F3E6D4 | karamel braon #33210F | stubovi, rezultati, indeks tretmana, priča, FAQ |
  | `tone-invert` | braon #422306 | pergament #F2E7D5 | meni (horizontalni), citat, manifest |
  | `tone-taupe` | taupe #735E4B | taupe #735E4B | Instagram CTA, kartice tretmana |
  | `tone-cocoa` | braon #422306 | braon #422306 | footer na svim stranicama |
  Kartice tretmana se smenjuju sand → invert → taupe.
- **Detalji u pozadini:** blago zrno (SVG šum) na svim površinama, topli odsjaji (kao lampe u sali) na vrhu stranica i u footeru, i koncentrični talasi (`assets/img/ripple.svg`, klasa `has-ripple`) koji se šire na skrol.
- **Ritam:** sekcije 120-200px vertikalno na desktopu, max širina 1440px, margine 36px (mobilni 18px).
- **Bez:** custom kursora, em-crtica, "scroll" indikatora, lažnih brojki.

## 3. Mapa sajta (6 stranica + studio)

```
index.html        Home
treatments.html   Treatment Menu (meni po kategorijama + kartice sa slikom)
shop.html         Shop (proizvodi)
about.html        About Melissa + The Skyn Room Approach
results.html      Before & After portfolio
contact.html      Kontakt forma + FAQ
studio/           tajni admin panel (vidi odeljak 8)
```
Zajedničko za sve: header (logo levo, meni u sredini, Book Now desno), mobilni meni preko celog ekrana, footer sa velikim naslovom, prelaz između stranica (braon zavesa sa logom).

## 4. Stranice i GSAP "stop scroll" animacije

### Home (index.html)
1. **Hero "Strata" (PIN):** fotografija kože sa kapi seruma (`droplet-skin.webp`) isečena je na vertikalne trake (7 na desktopu, 5 na telefonu) koje stoje van registra, kao neravna tekstura. Ogroman naslov *Custom facials.* prelazi preko slike: van slike je braon h1, a u svakoj traci je krem kopija koja se pomera sa trakom, pa je i naslov "polomljen". Pri učitavanju trake izlaze odozdo jedna za drugom. Na skrol se sekcija zaustavi i trake se poravnaju u jednu mirnu sliku (priča: neravno → ujednačeno), reči se primaknu, talasi se šire, a na kraju se pojavi potpis "(Fig. 01) Skin, up close". Na desktopu trake blago reaguju na pokret miša, sve manje kako se poravnavaju. Okolo: (The Skyn Room), indeks tretmana, opis + Book Online, potpis Melisse. Raspored je u `cqw/cqh` jedinicama (stage je size container), pa se kompozicija skalira sa ekranom. Bez JS-a i uz reduced motion: jedna cela slika.
2. **Uvod:** veliki serif paragraf (Melissin glas) koji se "osvetljava" reč po reč dok se skroluje, desno njen portret sa parallax efektom, link "About Melissa →".
3. **Pristup:** 4 stuba (Consultation first / Results-driven / Treated as my own / Honest guidance), u stilu OGAKI reda sa nagradama.
4. **Kolaž (PIN):** centralna slika tretmana stoji, 4 manje slike prolaze pored nje različitom brzinom, ispod tekst i link "Treatment Menu →".
5. **Meni (PIN, horizontalni skrol):** vertikalni skrol pomera 8 kartica tretmana bočno. Svaka ima Book Now.
6. **Citat (PIN):** slika spa prostora se širi od malog okvira do celog ekrana, preko nje citat "I treat your skin as if it were my own."
7. **Rezultati:** 3 before/after slike u pomerenoj (stepenastoj) mreži, link "All Results →".
8. **Footer CTA:** "Your skin, truly yours." + Book Now.

### Treatments (treatments.html)
1. Hero naslov "Treatment Menu" (slova se otkrivaju liniju po liniju).
2. Uvodni tekst sa originalnog sajta + napomena da novi klijenti počinju sa Signature Custom Facial.
3. **Indeks:** 8 velikih naziva; na hover slika tretmana prati miš, klik skroluje do detalja.
4. **Sticky stack (PIN):** svaki tretman je kartica preko celog ekrana (slika + opis + "Good for" + Book Now). Sledeća kartica klizi preko prethodne, a prethodna se smanjuje i bledi.
5. CTA traka.

### About (about.html)
1. Hero: "About me." + portret koji se otkriva clip-path animacijom.
2. **Priča (PIN):** slika levo stoji, tri pasusa njene priče desno se redom osvetljavaju.
3. Veliki citat sa scrub efektom reč po reč.
4. **The Skyn Room Approach (PIN):** naslov stoji levo, 4 koraka se smenjuju desno sa linijom napretka.
5. CTA.

### Results (results.html)
1. Hero "Working with the best clients."
2. **Špil (PIN):** 6 before/after slika kreće kao naslagan špil u centru, skrol ih raspoređuje u mrežu.
3. Klik na sliku otvara lightbox.
4. CTA za Instagram.

### Contact (contact.html)
1. Levo: "Let's talk about your skin." + Book Now + Instagram/TikTok.
2. Desno: forma sa istim poljima kao original (First name*, Last name, Message, Phone*, Email*), validacija i poruke o greškama ispod polja.
3. FAQ harmonika (odgovori zasnovani na tekstu sa originalnog sajta).

## 5. Tehnika

- Čist HTML/CSS/JS, bez build koraka, radi na bilo kom hostingu (Netlify, Vercel, cPanel).
- GSAP 3.15 + ScrollTrigger + SplitText, Lenis smooth scroll, sve lokalno u `assets/vendor/`.
- `gsap.matchMedia()`: sve pin animacije rade i na desktopu (≥ 900px širine, ≥ 520px visine) i na telefonu (< 900px širine, ≥ 500px visine), svaka sa svojim rasporedom (blok "PHONE" na kraju `style.css`). Telefon u landscape-u i reduced motion dobijaju statičan raspored.
- Telefon: pinovane sekcije su visoke `100lvh`, a sadržaj je u `100svh`, pa traka browsera ne otkriva sledeću sekciju; `ScrollTrigger.config({ ignoreMobileResize: true })` sprečava skok pinova kad se traka sakrije; `anticipatePin` i kraći scrub (0.5) za native touch skrol; snap bez inercije u scenama sa koracima; bez `backdrop-filter` na headeru. Mereno sa CPU usporenim 4×: medijana 16,6 ms po frejmu, bez frejmova dužih od 50 ms.
- Na telefonu: kolaž, horizontalni meni, citat, špil rezultata i oba about pina rade kao na desktopu; About priča i pristup se smenjuju u mestu (slika gore, tekst dole); tretmani su sticky špil u kome se visoka kartica prvo doskroluje do kraja pa tek onda zastane.
- `prefers-reduced-motion`: sve animacije se gase, sadržaj je odmah vidljiv.
- Slike: WebP, `loading="lazy"` osim hero slika, eksplicitne dimenzije (bez CLS).
- SEO: title/description po stranici, Open Graph, `BeautySalon` JSON-LD na početnoj.

## 6. Status i pokretanje

Sve stranice iz plana su napravljene i testirane u Chromium-u (desktop 1440px, telefon 390×664, telefon landscape, dark mode, reduced motion, promena veličine desktop ↔ telefon): bez JS grešaka i bez horizontalnog skrola.

Pregled lokalno (preporučeno, zbog fontova i animacija):
```
cd skynroom
python -m http.server 8000
```
pa otvoriti http://localhost:8000. Direktno otvaranje `index.html` takođe radi.

Za objavu: ceo folder `skynroom/` se kači kao statički sajt (Netlify drag & drop, Vercel, cPanel...).

## 7. Šta treba dopuniti pre objave

- Forma: upisati Formspree (ili drugi) endpoint u `contact.html`.
- Opisi tretmana su napisani na osnovu naziva i fotografija; Melissa treba da ih potvrdi.
- Adresa/telefon: nisu javno navedeni na starom sajtu, dodati ako postoje.
- Slike sa prefiksom Wix stock biblioteke (tekstura kože, kap, spa enterijer, spa soba) proveriti licencu van Wix-a.

## 8. Supabase i studio (admin panel)

Meni tretmana i proizvodi se uređuju bez koda, preko tajnog linka.

**Kako radi**
- Supabase projekat `skynroom` (`sbtseghoaxglhaaanirs`, us-east-1). Tabele `categories`, `treatments`, `products`; slike u bucket-u `media`. Šema: `supabase/migrations/`.
- Sajt (`assets/js/content.js`) čita samo vidljive redove javnim (publishable) ključem i iscrta meni, kartice i shop dok zavesa još stoji. `main.js` čeka taj promise pa tek onda pravi GSAP scene.
- U HTML-u ostaje sačuvana kopija menija (fallback): ako Supabase ne odgovori za 3 s, ostaje ona. Ako se meni mnogo promeni, kopiju treba osvežiti.
- Studio: `studio/#<ključ>`. Ključ iz linka je lozinka; svaki zahtev ide na Edge Function `admin` (`supabase/functions/admin`), koja proverava sha256 ključa u tabeli `admin_keys` i tek onda menja bazu servisnim ključem. Javni ključ ne može ništa da upiše (RLS + revoke).
- U studiju (Help → Make a new link) se pravi novi link; stari prestaje da radi odmah.
- Vercel cron (`vercel.json` → `api/keepalive.js`) jednom dnevno pinguje Supabase da se besplatan projekat ne bi pauzirao posle 7 dana bez saobraćaja.

**Polja tretmana:** naziv, kategorija, cena i trajanje (slobodan tekst, kao na Vageru), opis, slika, "photo card" (velika kartica na Treatments + slajder na Home), kratka linija, "Good for", mala oznaka, poseban Vagaro link (prazno = ceo Vagaro meni), vidljivost.

**Polja proizvoda:** naziv, brend, kategorija (2+ kategorije = filteri na shop strani), cena, opis, slika, link za kupovinu (prazno = "Available in the studio"), sold out, vidljivost.

**Edge Function deploy** (posle izmene `supabase/functions/admin/index.ts`): preko Supabase MCP-a ili `supabase functions deploy admin --no-verify-jwt`.
