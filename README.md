# Backgammon API, UI i E2E testovi

Samostalan Playwright Test + TypeScript projekat prema dokumentu `PRD.md`.
Implementirana su tacno 23 scenarija: 10 API (pet pozitivnih i pet negativnih),
12 UI i jedan kompletan E2E za dva igraca. Nazivi testova i `test.step` koraci
su na engleskom; ovo uputstvo je na srpskom.

UI i E2E koriste istih sest Page Objects i zajednicku browser fixture.
Testovi koriste stvarni API bez mockovanja, DB seed-a ili direktnog pristupa bazi.

## Preduslovi

- Node.js verzija koju podrzava instalirani Playwright (preporuka: Node.js 22 ili 24 LTS) i npm.
- Rucno pokrenuti lokalni backend i njegova baza; podrazumevani API je `http://localhost:8080`.
- Aktuelni API ugovori iz PRD-a: novi korisnici imaju rating 1000 i pocetne wins/losses 0.
- Za UI i E2E: rucno pokrenut frontend na `http://localhost:4200`, aktuelni UI za
  predaju, statistiku i leaderboard, kao i lokalno instaliran Playwright Chromium.
- Za tacne zavrsne E2E ratinge: backend K-faktor 40.
- Mirno lokalno okruzenje tokom leaderboard provere: bez paralelnog dodavanja korisnika
  ili menjanja ratinga iz drugih pokretanja/aplikacija izmedju citanja dve strane.

Frontend nije potreban za `test:api`, ali jeste za UI, E2E i ceo skup.
Test runner ne pokrece aplikaciju i ne menja njen source,
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

Za UI/E2E na novom racunaru instalirati Chromium ako nedostaje:

```powershell
npx playwright install chromium
```

## Pokretanje

```powershell
npm run typecheck
npx playwright test --list
npm test
npm run test:api
npm run test:ui
npm run test:ui:headed
npm run test:e2e
npm run test:e2e:headed
npm run report
```

`--list` mora prikazati `23 tests in 10 files`: projekat `api` ima 10 testova,
`ui-chromium` 12, a `e2e-chromium` jedan. `npm test` pokrece sve tri grupe;
`test:api` samo API, a `test:ui` samo UI scenarije.
`test:ui` i `test:e2e` su headless. `test:ui:headed` i `test:e2e:headed` otvaraju
vidljive browsere za prezentaciju, bez dodatnog usporavanja.
Nema zavisnosti izmedju projekata niti preklapanja njihovih spec obrazaca.
Typecheck i listanje rade i bez pokrenutih aplikacija.

Za izdvajanje jednog postojeceg scenarija ili nezavisno ponavljanje cele grupe:

```powershell
npm run test:api -- --grep "API-09"
npm run test:api -- --repeat-each=2
npm run test:ui -- --grep "UI-08"
npm run test:ui -- --repeat-each=2
npm run test:e2e -- --repeat-each=3
```

Ponavljanje ne dodaje nove scenarije u dogovoreni broj i svaki put koristi nove podatke.
Ne sluzi kao retry neuspesnog testa.

Playwright UI alat za pregled i pokretanje svih grupa:

```powershell
npm run test:ui-mode
```

`test:ui-mode` nije isto sto i `test:ui`: otvara interaktivni Playwright alat,
dok `test:ui` izvrsava samo 12 UI scenarija. Sam alat moze zahtevati lokalni Chromium;
to ne vazi za obicno `npm run test:api` ili otvaranje HTML report-a.

### Druga lokalna API adresa

```powershell
$env:API_BASE_URL = 'http://localhost:8081'
npm run test:api
Remove-Item Env:API_BASE_URL
```

Koristi se iskljucivo process environment; `.env` se ne ucitava automatski.
Za uobicajeno izvrsavanje koristiti `localhost` dosledno.
Browser adresu zasebno odredjuje `BASE_URL` (podrazumevano `http://localhost:4200`).
API fixture uvek koristi `API_BASE_URL`, ne frontend adresu browser projekta.
Frontend i dalje mora biti konfigurisan da koristi isti backend; test runner ne
menja njegovu konfiguraciju.

## Arhitektura i API objekti

| Putanja | Odgovornost |
|---|---|
| `api\AuthApi.ts` | Register, login i me zahtevi |
| `api\RoomsApi.ts` | List, create, details, current, join i leave |
| `api\GamesApi.ts` | Start, GET stanje/igraci/legalni potezi/istorija i finish za cleanup |
| `api\LeaderboardApi.ts` | Paginirani leaderboard i sopstveni rank |
| `types\api.ts` | Lokalni TypeScript ugovori bez importovanja aplikacije |
| `helpers\test-data.ts` | Generisanje jedinstvenih podataka bez HTTP sporednih efekata |
| `fixtures\test.ts` | Test-scoped scenario, priprema naloga, request konteksti i cleanup |
| `tests\api\*.api.spec.ts` | Scenariji, engleski koraci i poslovna ocekivanja |
| `fixtures\browser.ts` | Zajednicka fabrika guest/prijavljenih igraca, E2E players, screenshots i zatvaranje konteksta |
| `pages\*.ts` | Register, Login, Lobby, WaitingRoom, Board i Leaderboard Page Objects |
| `helpers\ui-response.ts` | Tacno filtriranje odgovora po API origin-u, metodi i putanji |
| `tests\ui\*.ui.spec.ts` | Dvanaest nezavisnih UI scenarija u pet fajlova |
| `tests\e2e\match.e2e.spec.ts` | Jedan kompletan scenario sa igracima A i B |

Cetiri **API service/request objekta** odvojena su od browser Page Objects:
oni enkapsuliraju endpoint-e i vracaju `APIResponse`, bez browser klikova i skrivenih
poslovnih assertions. Spec proverava konkretan HTTP status pre citanja tipizovanog tela.
Fixture zasebno proverava da je njegova priprema uspela.

`scenario.api` je uvek neautentifikovan. `scenario.createUser()` registruje sopstveni
nalog, prijavljuje ga i vraca njegove podatke, profil, token u memoriji i zasebne
autentifikovane API objekte.
`scenario.registerUser()` samo registruje korisnika, sto omogucava da login ostane
stvarna akcija testa. `scenario.apiForToken()` pravi novi kontekst za token dobijen u scenariju.
Tokeni se ne dele globalno niti se cuvaju u fajlovima.
E2E ne koristi API registraciju ili login: token dobija iz stvarnog UI login
odgovora, a `scenario.apiForToken()` koristi samo za GET provere i moguci teardown.

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
| UI-01 | UI | Prazna registraciona forma zahteva sva polja | `auth.ui.spec.ts` |
| UI-02 | UI | Razlicite lozinke ne dozvoljavaju registraciju | `auth.ui.spec.ts` |
| UI-03 | UI | Login sa pogresnom lozinkom prikazuje stvarnu serversku gresku | `auth.ui.spec.ts` |
| UI-04 | UI | Neprijavljen posetilac ne otvara lobby direktno | `auth.ui.spec.ts` |
| UI-05 | UI | Logout onemogucava ponovni direktan pristup lobby-ju | `auth.ui.spec.ts` |
| UI-06 | UI | Naziv sobe sastavljen samo od razmaka se odbija | `lobby.ui.spec.ts` |
| UI-07 | UI | UI kreiranje vodi u sobu sa ispravnim nazivom i hostom | `lobby.ui.spec.ts` |
| UI-08 | UI | Start je prikazan samo hostu, tek kada postoje dva igraca | `waiting-room.ui.spec.ts` |
| UI-09 | UI | Guest napusta sobu, host ostaje i vidi promenu bez reload-a | `waiting-room.ui.spec.ts` |
| UI-10 | UI | Host otkazuje sobu i oba browsera odlaze u lobby | `waiting-room.ui.spec.ts` |
| UI-11 | UI | Cancel predaje cuva aktivnu igru, oba clanstva i statistiku | `board.ui.spec.ts` |
| UI-12 | UI | Leaderboard tabela i licni rang odgovaraju stvarnim podacima | `leaderboard.ui.spec.ts` |
| E2E-01 | E2E | Dva igraca od UI registracije do poteza, predaje i novih ratinga | `match.e2e.spec.ts` |

Svaki red je jedan `test()`. Pozivi u pripremi i cleanup-u nisu dodatni test slucajevi.
Leaderboard koristi page 0 i 1 sa size 2 i najmanje tri sopstvena aktivna korisnika.
Ne pretpostavlja praznu bazu, rang 1 ili da su bas novi korisnici na prvim stranama.

## UI priprema i deljeni Page Objects

`actors.guest(label)` pravi potpuno cist browser kontekst bez nasledjenog login-a.
`actors.authenticated(label, user)` koristi korisnika iz `scenario.createUser()`:
token i username postavlja kroz in-memory `storageState` za tacan frontend origin.
Koriste se `bg_token` i `bg_username`, bez auth fajlova ili ponovnog UI login-a
u scenarijima ciji predmet nije autentifikacija.

Svaki UI test priprema svoje korisnike i resurse. UI-03 koristi samo API registraciju,
pa stvaran neuspesni login izvrsava kroz formu. UI-08/09/10/11 imaju dva nezavisna
BrowserContext objekta; promena drugog UI-ja proverava se bez reload-a.
UI-11 priprema igru kroz API, a zatim proverava iskljucivo otvaranje i Cancel
stvarne potvrde predaje. Tek posle poslovnih provera teardown zavrsava tu igru.

UI-12 poredi svaki prikazani leaderboard red sa odgovorom za page 0 i size 20.
Licni `Your rank` i rating porede se sa `/api/leaderboard/me` i `/auth/me`.
Ne zahteva se da nov korisnik bude medju prvih 20.

`fixtures\browser.ts` je prosirena i preimenovana postojeca E2E fixture, ne
njen paralelni duplikat. E2E i dalje dobija `players.a` i `players.b` kao guest
kontekste i registruje/prijavljuje ih iskljucivo kroz UI.
Svi scenariji koriste iste Page Objects. Male fill/submit akcije ne cekaju
nepostojeci API odgovor kod lokalnih validacija; uspesni register/create tokovi
i dalje cekaju stvarne odgovore. `BoardPage` deli otvaranje potvrde izmedju
Cancel UI scenarija i postojece E2E predaje.

## E2E-01: dva igraca, potez, predaja i novi rating

Jedan test u `tests\e2e\match.e2e.spec.ts` prolazi sledece celine:

1. A i B se registruju i prijavljuju kroz UI u razlicitim browser kontekstima.
2. A kreira sobu, B bira bas tu sobu, a A rucno pokrece istu igru.
3. Oboje bacaju pocetne kockice; neresen opening se legalno ponavlja najvise 10 puta.
4. Stvarni pocetni igrac odigra jedan GET legal-moves ponudjeni potez kroz SVG UI.
5. Proveravaju se move zahtev i istorija, kao i promenjeni broj/boja figura na obe
   prikazane table bez reload-a i ocuvanje svih 30 figura.
6. B otvara i potvrdjuje UI predaju: A vidi YOU WON!, B YOU LOST!.
7. Odmah se proveravaju upisani wins/losses i rating: A=1/0/1020, B=0/1/980,
   uz FINISHED igru, datum zavrsetka, winner flags i CLOSED sobu.
8. B-ov rezultat prikazuje rating 980 i losses 1; oboje vide svoj tacan rating
   i stvarni rang na leaderboard-u, pa se vracaju u lobby bez aktivne sobe.

Uspeo scenario nema direktne POST pozive iz test koda. Sve mutacije izvrsava
aplikacija posle stvarnih UI akcija; GET pozivi pomazu izboru poteza i proverama.
Ne ocekuju se odredjena boja, pocetni igrac, kockice ili globalni leaderboard rank.
Ocekivani ratingi nisu izvedeni iz odgovora koji se proverava.

Trenutni opening ne prenosi pocetne kockice u playable dice, pa pocetni igrac
dodatno baca kroz UI ako je potrebno. To je razlika trenutne aplikacije od
standardnog toka iz PRD-a, ne dokaz svih backgammon pravila.
Sinhronizacija proverava oba prikazana UI-ja; ne dokazuje posebno WebSocket
transport, jer aplikacija koristi i polling.

`BoardPage` cita samo DOM/SVG brojeve, boje, highlight i geometriju. Ne importuje
frontend geometriju, ne pristupa Angular internim instancama i ne koristi
hardkodovane screen koordinate. Poslovna ocekivanja ostaju u spec-u.

## Izolacija i cleanup

- Svaki test pravi svoje korisnike i sobe; UUID podaci ne zavise od redosleda izvrsavanja.
- Username i naziv sobe ostaju unutar granica iz PRD-a. Email koristi domen `example.test`.
- Korisnicki nalozi smeju ostati u lokalnoj bazi; ne postoji korisnicki DELETE endpoint za ovaj tok.
- WAITING soba se uklanja kroz host leave endpoint i zatim se proverava da ne postoji.
- Ako je pracena soba vec obrisana kroz UI host leave, cleanup prihvata njen
  konkretan `404` samo uz proveru da host nema aktivnu sobu (`204`).
- Ako test padne nakon starta sopstvene igre, ili je aplikacija neocekivano pokrene,
  teardown proverava njeno stanje i zavrsava je kroz postojeci finish endpoint.
  Vec zavrsenu igru ne zavrsava ponovo.
- Cleanup koristi iskljucivo evidentirane room ID-jeve i njihove vlasnike. Ne pretrazuje
  i ne brise tudje resurse po prefiksu.
- Greske cleanup-a su vidljive, ne predstavljaju uspeh scenarija i ne zamenjuju njegove provere.
  Svi napravljeni request konteksti zatvaraju se i pri padu.
- UI-kreirana soba evidentira se kroz `scenario.trackRoom()` odmah posle
  uspesnog odgovora, pre narednih poslovnih provera. Njen cleanup ne zamenjuje UI predaju.

## Report i analiza pada

Konfiguracija koristi jedan worker, bez fully-parallel rezima i bez retry-ja.
API test timeout je 45 sekundi, request timeout 10 sekundi, a assertion timeout 5 sekundi.
UI ima test timeout 60 sekundi, E2E 180 sekundi, a oba browser projekta koriste
assertion timeout 15 sekundi zbog dva UI-ja, polling-a i animacija.
To su zastitne granice, ne fiksne pauze.

HTML i terminal report prikazuju imenovane korake i konkretna ocekivanja.
Nema custom JSON priloga, videa ili dodatnog report sistema.
Pri UI/E2E padu fixture prilaze posebno oznacene screenshots svih kreiranih
igraca pre API cleanup-a, ukljucujuci oba browsera u scenarijima sa dva igraca.
Standardni Playwright trace se zadrzava samo pri neuspehu (`retain-on-failure`),
obuhvatajuci oba browser konteksta. API testovi ne otvaraju browser.
`playwright-report`, `test-results` i zavisnosti su ignorisani u Git-u.

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

## Zavrsna provera kompletnog skupa

Sa rucno pokrenutim lokalnim aplikacijama:

```powershell
npm run typecheck
npx playwright test --list
npm run test:ui -- --repeat-each=2
npm test
```

Ocekuju se 23 registrovana slucaja, zatim 24 uspesna UI izvrsavanja
(svaki od 12 scenarija dva puta sa novim podacima) i 23 uspesna izvrsavanja
celog skupa. Izvrsavati redom, ne paralelno sa drugim test pokretanjem koje
menja korisnike ili ratinge. Ponovno izvrsavanje ne zahteva praznjenje baze.
Potvrdjeni aplikacioni problemi ostaju vidljivi kao padovi, bez oslabljivanja
provera; nedostupna aplikacija ne smatra se uspesno izvrsenim testom.

Pri ovoj implementaciji typecheck je prosao, listanje je potvrdilo tacno 23 testa
u 10 fajlova, UI ponavljanje je zavrseno sa `24 passed`, a ceo skup sa `23 passed`.
Kontrolisanim padom UI-08 dodatno su potvrdjeni odvojeni Host/Guest screenshot
prilozi i prisustvo oba browser konteksta/stranice u trace-u. Privremeni uzrok
pada je uklonjen, a vraceni UI-08 je zatim ponovo prosao. Dijagnosticki artefakti
su sacuvani odvojeno od HTML report-a uspesnog celog skupa i nisu deo Git predaje.
