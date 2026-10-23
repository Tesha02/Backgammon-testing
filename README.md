# Backgammon API testovi

Samostalan Playwright Test + TypeScript projekat za API fazu dokumenta `PRD.md`.
Implementirano je tacno 10 scenarija: pet pozitivnih i pet negativnih. Nazivi testova
i `test.step` koraci su na engleskom; ovo uputstvo je na srpskom.

UI testovi, E2E tok i browser Page Objects iz sireg PRD-a nisu deo ove faze.
Testovi koriste stvarni API bez mockovanja, DB seed-a ili direktnog pristupa bazi.

## Preduslovi

- Node.js verzija koju podrzava instalirani Playwright (preporuka: Node.js 22 ili 24 LTS) i npm.
- Rucno pokrenuti lokalni backend i njegova baza; podrazumevani API je `http://localhost:8080`.
- Aktuelni API ugovori iz PRD-a: novi korisnici imaju rating 1000 i pocetne wins/losses 0.
- Mirno lokalno okruzenje tokom leaderboard provere: bez paralelnog dodavanja korisnika
  ili menjanja ratinga iz drugih pokretanja/aplikacija izmedju citanja dve strane.

Frontend nije potreban. Test runner ne pokrece aplikaciju i ne menja njen source,
konfiguraciju ili DB semu. Za API izvrsavanje nije potrebna instalacija Chromium-a
ili drugih browsera.

Sve naredne komande pokrecu se iz korena ovog test projekta:

```powershell
Set-Location 'C:\Ucenje\BACKGAMEON\Backgammon Tests\tests'
```

Pri novom checkout-u instalirati zakljucane zavisnosti:

```powershell
npm ci
```

Ako su zavisnosti vec instalirane i uskladjene sa lockfile-om, nije ih potrebno ponovo instalirati.

## Pokretanje

```powershell
npm run typecheck
npx playwright test --project=api --list
npm run test:api
npm run report
```

`--list` mora prikazati `10 tests in 4 files`. `npm test` je alias za istu API grupu.
Typecheck i listanje rade i kada backend nije pokrenut; stvarno izvrsavanje zahteva backend i bazu.

Za izdvajanje jednog postojeceg scenarija ili nezavisno ponavljanje cele grupe:

```powershell
npm run test:api -- --grep "API-09"
npm run test:api -- --repeat-each=2
```

Ponavljanje ne dodaje nove scenarije u dogovoreni broj i svaki put koristi nove podatke.
Ne sluzi kao retry neuspesnog testa.

Playwright UI alat za pregled i pokretanje API testova:

```powershell
npm run test:ui-mode
```

Ovo nije UI test grupa. Sam Playwright UI alat moze zahtevati lokalni Chromium;
to ne vazi za obicno `npm run test:api` ili otvaranje HTML report-a.

### Druga lokalna API adresa

```powershell
$env:API_BASE_URL = 'http://localhost:8081'
npm run test:api
Remove-Item Env:API_BASE_URL
```

Koristi se iskljucivo process environment; `.env` se ne ucitava automatski.
Za uobicajeno izvrsavanje koristiti `localhost` dosledno.

## Arhitektura i API objekti

| Putanja | Odgovornost |
|---|---|
| `api\AuthApi.ts` | Register, login i me zahtevi |
| `api\RoomsApi.ts` | List, create, details, current, join i leave |
| `api\GamesApi.ts` | Start i ogranicene get/finish operacije za cleanup |
| `api\LeaderboardApi.ts` | Citljiv paginirani leaderboard zahtev |
| `types\api.ts` | Lokalni TypeScript ugovori bez importovanja aplikacije |
| `helpers\test-data.ts` | Generisanje jedinstvenih podataka bez HTTP sporednih efekata |
| `fixtures\test.ts` | Test-scoped scenario, priprema naloga, request konteksti i cleanup |
| `tests\api\*.api.spec.ts` | Scenariji, engleski koraci i poslovna ocekivanja |

Prema PRD-u, POM za browser stranice pripada buducoj UI/E2E fazi. U ovoj fazi
isti princip razdvajanja odgovornosti primenjuju cetiri **API service/request objekta**:
oni enkapsuliraju endpoint-e i vracaju `APIResponse`, bez browser klikova i skrivenih
poslovnih assertions. Spec proverava konkretan HTTP status pre citanja tipizovanog tela.
Fixture zasebno proverava da je njegova priprema uspela.

`scenario.api` je uvek neautentifikovan. `scenario.createUser()` registruje sopstveni
nalog, prijavljuje ga i vraca njegove podatke, profil i zasebne autentifikovane API objekte.
`scenario.registerUser()` samo registruje korisnika, sto omogucava da login ostane
stvarna akcija testa. `scenario.apiForToken()` pravi novi kontekst za token dobijen u scenariju.
Tokeni se ne dele globalno niti se cuvaju u fajlovima.

`scenario.createRoom(host, name)` koristi hostov `RoomsApi` i evidentira ID uspesno
kreirane sobe pre poslovnih provera. Vraceni HTTP odgovor ostaje dostupan spec-u.

## Scenariji

| ID | Tip | Provera | Spec |
|---|---|---|---|
| API-01 | Pozitivan | Registracija, pocetne vrednosti i neizlaganje lozinke | `auth.api.spec.ts` |
| API-02 | Negativan | Isti email uz drugi username vraca 409 | `auth.api.spec.ts` |
| API-03 | Pozitivan | Login token zaista radi na `/auth/me` za istog korisnika | `auth.api.spec.ts` |
| API-04 | Negativan | Pogresna lozinka vraca 401 bez tokena | `auth.api.spec.ts` |
| API-05 | Negativan | Rooms bez Authorization header-a vraca tacno 401 | `auth.api.spec.ts` |
| API-06 | Pozitivan | Kreiranje WAITING sobe automatski dodaje hosta | `rooms.api.spec.ts` |
| API-07 | Pozitivan | Guest join ne startuje igru automatski | `rooms.api.spec.ts` |
| API-08 | Negativan | Treci igrac ne ulazi u punu WAITING sobu | `rooms.api.spec.ts` |
| API-09 | Negativan | Guest ne moze da startuje igru | `games.api.spec.ts` |
| API-10 | Pozitivan | Paginacija, metadata, rangovi i rating DESC/userId ASC | `leaderboard.api.spec.ts` |

Svaki red je jedan `test()`. Pozivi u pripremi i cleanup-u nisu dodatni test slucajevi.
Leaderboard koristi page 0 i 1 sa size 2 i najmanje tri sopstvena aktivna korisnika.
Ne pretpostavlja praznu bazu, rang 1 ili da su bas novi korisnici na prvim stranama.

## Izolacija i cleanup

- Svaki test pravi svoje korisnike i sobe; UUID podaci ne zavise od redosleda izvrsavanja.
- Username i naziv sobe ostaju unutar granica iz PRD-a. Email koristi domen `example.test`.
- Korisnicki nalozi smeju ostati u lokalnoj bazi; ne postoji korisnicki DELETE endpoint za ovaj tok.
- WAITING soba se uklanja kroz host leave endpoint i zatim se proverava da ne postoji.
- Ako odstupanje aplikacije neocekivano pokrene sopstvenu igru, teardown proverava njeno
  stanje i zavrsava je kroz postojeci finish endpoint. Vec zavrsenu igru ne zavrsava ponovo.
- Cleanup koristi iskljucivo evidentirane room ID-jeve i njihove vlasnike. Ne pretrazuje
  i ne brise tudje resurse po prefiksu.
- Greske cleanup-a su vidljive, ne predstavljaju uspeh scenarija i ne zamenjuju njegove provere.
  Svi napravljeni request konteksti zatvaraju se i pri padu.

## Report i analiza pada

Konfiguracija koristi jedan worker, bez fully-parallel rezima i bez retry-ja.
Test timeout je 45 sekundi, request timeout 10 sekundi, a assertion timeout 5 sekundi.
To su zastitne granice, ne fiksne pauze.

HTML i terminal report prikazuju imenovane korake i konkretna ocekivanja.
Nema custom JSON priloga, screenshot-a, videa ili dodatnog report sistema.
Standardni Playwright trace se zadrzava samo pri neuspehu (`retain-on-failure`),
kao sto PRD zahteva. `playwright-report`, `test-results` i zavisnosti su ignorisani u Git-u.

**Lokalni trace moze sadrzati osetljive HTTP podatke, ukljucujuci test lozinke i tokene.**
Ne objavljivati ga ili slati drugima bez prethodnog pregleda i uklanjanja osetljivih podataka.
Spec i fixture ne ispisuju same lozinke ili tokene u svojim assertion porukama.

Za analizu koristiti korak u kome je doslo do pada:

- `ECONNREFUSED` ili timeout pre HTTP odgovora oznacava problem dostupnosti backend-a/baze.
- Pad pripreme naloga ili sobe nije dokaz da je glavno poslovno pravilo provereno.
- Dobijeni pogresan HTTP status, poruka ili stanje predstavlja odstupanje od PRD-a.
- Cleanup greska navodi konkretan resurs; originalni pad ostaje vidljiv u report-u.

Ne menjati ocekivanja samo da bi test prosao. Nema `skip`, `fixme`, mockovanih odgovora,
kontrolisanih kockica, ponavljanja mutirajucih zahteva ili izmene aplikacije.
