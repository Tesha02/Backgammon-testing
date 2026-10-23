# Plan testiranja Backgammon aplikacije

## 1. Cilj, granice i dogovor

Napraviti mali, razumljiv i pouzdan skup automatizovanih testova za prezentaciju. Pokazati smislen izbor scenarija, Playwright API testiranje, Page Object Model i jedan stvaran tok između dva igrača. Cilj nije potpuna pokrivenost aplikacije niti dokaz ispravnosti celog Backgammon engine-a.

**Obim: tačno 10 API testova, 12 UI testova i 1 E2E test, odnosno 23 test slučaja.**

Obavezna ograničenja:

- Svi novi testovi, konfiguracija, pomoćni kod i uputstvo pripadaju isključivo postojećem folderu `C:\Ucenje\BACKGAMEON\Backgammon Tests\tests`.
- Koristiti isključivo Playwright Test i TypeScript za automatizaciju; browser je Chromium na desktopu.
- **Ne menjati backend ili frontend:** ni source, postojeće testove aplikacije, HTML atribute, konfiguraciju, endpoint-e ili DB šemu.
- Ne pristupati bazi direktno, ne koristiti SQL seed, ne dodavati test-only endpoint-e i ne menjati stanje igre kroz Angular interne metode.
- Backend i frontend ostaju zasebno, ručno pokrenute lokalne aplikacije. Test repozitorijum mora biti samostalan i ne sme importovati njihove fajlove.
- Koristiti stvarni lokalni API i stvarni UI. Predloženi skup ne zahteva mockovanje odgovora.
- Nema CI/CD podešavanja, više browsera, mobilnih projekata, dodatnog report sistema, Cucumber-a ili profesionalnog framework-a izvan potreba ovih testova.

Potvrđene odluke korisnika:

| Tema | Odluka |
|---|---|
| Namena | Uravnotežena prezentacija scenarija, POM-a i pouzdanog izvršavanja |
| Okruženje | Isključivo lokalno |
| Podaci | Posebni test korisnici, kreirani kroz postojeći API, osim registracije u E2E koja mora biti kroz UI |
| API obim | 10 testova; pet pozitivnih i pet negativnih |
| UI obim | 10–12 testova; ovim planom odabrano je 12 |
| Browser | Chromium, desktop |
| Rezultati | HTML report, screenshot pri padu, trace sačuvan pri neuspehu i Playwright UI mode |
| Izolacija | Jedinstveni podaci po testu i izvršavanju; ostajanje test naloga u lokalnoj bazi je prihvatljivo |
| E2E akcije | Registracija, login, create/join, start, bacanje, pomeranje i predaja isključivo kroz UI |
| E2E API čitanje | Dozvoljeni direktni GET pozivi za legalne poteze, stanje, rezultat i statistiku |
| Detaljnost | Detaljni scenariji i implementacioni koraci, bez kompletne implementacije testova |

Ovaj dokument je plan. Ne znači da su testovi već napisani ili da je aplikacija proverena njihovim izvršavanjem.

## 2. Šta je potvrđeno pregledom koda

Plan je zasnovan na priloženim `PRD_MVP.md` i `DATABASE_MVP.md`, ali su konkretne rute, selektori i očekivanja provereni u trenutnom kodu. Leaderboard, koji nije deo originalnog MVP obima iz PRD-a, uključen je zato što postoji u aplikaciji i korisnik ga izričito navodi.

### 2.1. Trenutno okruženje i test projekat

- Frontend: Angular aplikacija, lokalno `http://localhost:4200`.
- Backend: Spring aplikacija, lokalno `http://localhost:8080`.
- Frontend API adresu formira iz hostname-a browsera i porta `8080`. Za plan koristiti `localhost` dosledno, ne mešati ga sa `127.0.0.1`.
- U postojećem folderu `tests` već postoje `package.json`, `package-lock.json`, `playwright.config.ts`, `.gitignore` i generički `tests\example.spec.ts`.
- Postojeći manifest sadrži `@playwright/test` i `@types/node`, ali nema npm skripte. Postojeći Playwright config uključuje tri browsera i demonstracione testove za Playwright sajt, što treba zameniti testovima ove aplikacije.
- Samo folder `tests` je predmet GitHub predaje. Spoljašnji workspace nije zajednički Git repozitorijum svih delova aplikacije.

### 2.2. Relevantni ugovori

| Funkcionalnost | Potvrđeno ponašanje |
|---|---|
| Registracija | `POST /auth/register`, uspeh `201`; vraća korisnika, ne token |
| Login | `POST /auth/login`, uspeh `200`; vraća `token`, `username`, `email`, `role` |
| Trenutni korisnik | `GET /auth/me`, uspeh `200`; vraća i `wins`, `losses`, `rating` |
| Početne vrednosti | Novi korisnik: `USER`, aktivan, rating `1000`, wins `0`, losses `0` |
| Validacija registracije | Username 3–50, email do 255, password 6–100 karaktera; obavezna polja |
| Session u browseru | Local storage ključevi `bg_token` i `bg_username` |
| Sobe | `POST /api/rooms` vraća `201`; prijavljeni korisnik automatski postaje host |
| Članstvo | `POST /api/rooms/{roomId}/join` vraća `201`; drugi igrač je guest |
| Aktivna soba | `GET /api/rooms/current`: `200` ako postoji, inače `204` bez JSON tela |
| Waiting room | Drugi igrač ne pokreće igru automatski; host mora da klikne `Start game` |
| Start | `POST /api/games/rooms/{roomId}/start`, uspeh `201` |
| Predaja | `POST /api/games/{gameId}/finish`, uspeh `200`; predavalac gubi, protivnik dobija |
| Završni rezultat | Predaja trenutno daje `FINISHED`, a soba postaje `CLOSED` |
| Statistika | Završetak sada uvećava wins pobedniku i losses poraženom, uz promenu oba ratinga |
| Elo | Početni rating `1000`; podrazumevani K-faktor `40`, moguć override kroz backend okruženje |
| Legalni potezi | `GET /api/games/{gameId}/legal-moves`; polja `fromPosition`, `toPosition`, `diceValue` |
| Tabla u API-ju | `currentState.points` ima 25 elemenata; indeks 0 se ne koristi, polja su 1–24 |
| Leaderboard | `GET /api/leaderboard?page=0&size=20`; `GET /api/leaderboard/me` za trenutnog korisnika |
| Poredak | Aktivni korisnici, rating opadajuće; pri istom ratingu user ID rastuće |
| Rank | Pozicija u tom poretku, sa jedinstvenim uzastopnim rangovima, ne deljeni rang |

### 2.3. Nova predaja kroz UI

Potvrđen je sledeći lanac u trenutnom kodu:

1. Na tabli postoji dugme **`Forfeit Game`**. Naziv u kodu nije `Forfeit match`.
2. Otvara native `<dialog>` sa naslovom **`Forfeit game?`**.
3. `Cancel` zatvara potvrdu bez završetka igre.
4. Potvrdno dugme `Forfeit Game` poziva frontend `GameService.finishGame()`.
5. Poziva se pravi `POST /api/games/{gameId}/finish`.
6. Backend upisuje pobednika, `FINISHED`, završni datum, `CLOSED`, oba ratinga i odgovarajuće wins/losses brojače.
7. Poraženi dobija `YOU LOST!`, kao i UI prikaz novih `Rating` i `Losses`; protivnik dobija `YOU WON!`.
8. Postoje `View Leaderboard` i povratak preko `Exit Game`.

Zato je sada izvodljiv traženi E2E bez direktnog API poziva za predaju i bez odigravanja cele partije. Direktni GET pozivi ostaju pomoć za izbor legalnog poteza i proveru podataka, ne zamena za UI akcije.

### 2.4. Važna ograničenja i razlike u odnosu na PRD

Ovo nisu zadaci za izmenu aplikacije:

- **`Exit Game` nije predaja.** Njegovo ponašanje ne koristiti za dokaz da je meč završen. Za to služi novo `Forfeit Game`.
- **Opening roll se radi ručno:** svaki igrač klikne `Roll dice`; nerešeno početno bacanje se ponavlja. Host, boja i početni igrač nisu ista stvar.
- Trenutni `resolveOpening()` određuje početnog igrača, ali ne prenosi početne vrednosti u `currentState.dice`. Zato trenutni UI traži još jedno bacanje od početnog igrača pre pomeranja. PRD predviđa korišćenje početnih vrednosti za prvi potez. E2E će pratiti postojeći tok i ovo jasno označiti kao odstupanje, ne kao potvrdu svih standardnih pravila.
- Tabla kombinuje WebSocket ažuriranja i periodični GET refresh. `finishGame()` u pregledanom kodu ne emituje sam završni broadcast, pa protivnik rezultat može dobiti polling-om. Test proverava da oba UI-ja dobiju ispravno stanje bez ručnog reload-a; ne tvrdi da je time zasebno dokazan WebSocket transport.
- Lobby osvežava podatke periodično, waiting room takođe; `Start game` hostu sa jednim igračem trenutno nije prikazan, nije samo disabled.
- PRD opisuje timer, automatsku igru pri timeout-u i gubitak zbog diskonekcije, ali takav kompletan tok nije potvrđen u pregledanom source-u. Ne stavljati ga među testove koji navodno imaju pouzdan, prolazan očekivani rezultat.
- Ne postoji posebno polje za „poene” pored Elo ratinga. Plan pod proverom poena podrazumeva rating.
- Winner modal trenutno ne prikazuje wins i rating kao loser modal. Za pobednikove brojke koristiti stvarni `/auth/me` i leaderboard; ne očekivati UI elemente koji ne postoje.
- Ne postoji korisnički DELETE endpoint u pregledanim kontrolerima. Ne planirati automatsko brisanje naloga.

Ako se kod još promeni pre implementacije, ponovo proveriti ove konkretne ugovore. Ne oslabljivati test samo da bi ostao zelen.

Relevantni izvori: backend `AuthController`, `RoomController`, `RoomPlayerController`, `GameController`, `LeaderboardController`, `GameService`, `MoveService`, `EloRatingService`, `LeaderboardService`, `UserRepository` i DTO klase; frontend `app.routes.ts`, auth forme, lobby, waiting room, leaderboard, board template i `BoardComponent`.

## 3. Strategija izbora testova

Tri sloja imaju različitu svrhu:

| Sloj | Čemu služi | Šta izbegavamo |
|---|---|---|
| API: 10 | Precizni HTTP ugovori, identitet i nekoliko važnih negativnih pravila | Proveru svega što backend može da uradi |
| UI: 12 | Validacije, navigacija, modalni dijalozi, uloge i prikaz podataka | Ponovnu kompletnu registraciju i partiju u svakom testu |
| E2E: 1 | Integracija dva korisnika od registracije do rezultata i leaderboard-a | Igranje cele partije i simuliranje cele logike pravila u testovima |

Jedan `test()` predstavlja jedan scenario iz ovog plana. API pozivi u pripremi, teardown-u i E2E proverama nisu dodatni API test slučajevi. E2E ima više `test.step()` celina, ali je i dalje jedan test. Ne koristiti parametrizaciju da se neprimetno poveća dogovoreni broj slučajeva.

Prioriteti: **P1** su ključni tokovi i pravila; **P2** su jednostavne, korisne prezentacione provere. Prioritet ne znači međusobnu zavisnost testova.

## 4. Arhitektura i POM

### 4.1. Predložena struktura

Spoljašnji `tests` je postojeći test repozitorijum. Njegov unutrašnji folder `tests` ostaje folder za spec fajlove, da se zadrži postojeći `testDir`.

```text
tests\
  package.json
  package-lock.json
  playwright.config.ts
  tsconfig.json
  .gitignore
  README.md
  api\
    AuthApi.ts
    RoomsApi.ts
    GamesApi.ts
    LeaderboardApi.ts
  pages\
    RegisterPage.ts
    LoginPage.ts
    LobbyPage.ts
    WaitingRoomPage.ts
    BoardPage.ts
    LeaderboardPage.ts
  fixtures\
    test.ts
  helpers\
    test-data.ts
  types\
    api.ts
  tests\
    api\
      auth.api.spec.ts
      rooms.api.spec.ts
      games.api.spec.ts
      leaderboard.api.spec.ts
    ui\
      auth.ui.spec.ts
      lobby.ui.spec.ts
      waiting-room.ui.spec.ts
      board.ui.spec.ts
      leaderboard.ui.spec.ts
    e2e\
      match.e2e.spec.ts
```

Ne praviti `BasePage`, generički framework za sve ekrane, složenu hijerarhiju ili poseban fajl za svaki modal. `LobbyPage` poseduje svoje create/join dijaloge, a `BoardPage` potvrdu predaje i rezultat.

### 4.2. Odgovornosti

| Komponenta | Odgovornost |
|---|---|
| Spec fajl | Preduslovi, scenario i poslovna očekivanja; čitljivi koraci za prezentaciju |
| Page Object | Lokatori i UI akcije; ne zna o drugim testovima |
| API klijent | HTTP pozivi i tipovi odgovora; nikad browser klikovi |
| Fixtures | Životni ciklus korisnika, request/browser konteksta i resursa, kao i cleanup |
| `test-data.ts` | Generisanje jedinstvenih podataka, bez kreiranja naloga kao sporednog efekta |
| `types\api.ts` | Samostalni TypeScript ugovori koje testovi koriste, bez importovanja aplikacije |

POM se primenjuje na UI i E2E. API klijenti su service/request objects, ne veštački Page Objects za endpoint-e.

Predložene POM operacije:

| POM | Primeri operacija i lokatora |
|---|---|
| `RegisterPage` | Otvaranje, popunjavanje četiri polja, submit, poruka o grešci, link za login |
| `LoginPage` | Login, potvrda uspešne registracije, greška, hvatanje stvarnog login odgovora |
| `LobbyPage` | Otvaranje create/join modal-a, kreiranje sobe, izbor tačno imenovane sobe, logout, leaderboard, aktivna soba |
| `WaitingRoomPage` | Naziv i popunjenost, spisak igrača, host oznaka, Start game, Leave room |
| `BoardPage` | Imena i boje, Roll dice, čitanje prikaza table, legalan UI potez, Forfeit dialog, rezultat, prikazana statistika |
| `LeaderboardPage` | Tabela, Your rank, rating trenutnog igrača, Prev/Next, povratak u lobby |

Assertions koji objašnjavaju poslovnu svrhu ostaju u spec-u. POM može imati male metode za čekanje spremnosti i čitanje strukturiranih UI podataka, ali ne sme sakriti kompletan scenario iza jedne nejasne metode.

### 4.3. Selektori bez izmena frontend-a

- Dugmad i linkovi: `getByRole` sa tačnim nazivom gde je potrebno.
- Auth inputi: `getByPlaceholder`, jer postoje placeholder-i, ali ne i zasebni povezani label elementi. `Password` razlikovati od `Confirm Password` pomoću exact pretrage.
- Create/join modal-i u lobby-ju nemaju semantičku dialog ulogu. Ograničiti `.modal-content` preko naslova `Create Room` ili `Available Rooms`, umesto da se pretpostavi nepostojeći `role=dialog`.
- Soba u join listi: `.room-item` sa jedinstvenim generisanim nazivom, pa dugme `Join` unutar tog reda. Ne uzimati prvi `Join` na stranici.
- Waiting room: čitljiv naziv, usernames i host tekst; očekivati odsustvo Start dugmeta kada uslov nije ispunjen.
- Predaja: `getByRole('dialog', { name: 'Forfeit game?' })`, zatim potvrda unutar tog dijaloga. Toolbar i dijalog imaju dugmad sa istim nazivom.
- Rezultat: zasebno scope-ovati result dialog, a tekstove `YOU WON!` i `YOU LOST!` tražiti bez zavisnosti od emoji znaka.
- Tabela: `getByRole('table')`, redovi i ćelije; ne oslanjati se na styling kao glavni dokaz podataka.
- SVG tabla: postojeći `svg.board`, `g.checker`, `text.num`, `circle.ghost` i boja preko `<use href>`. Klasa `.movable` nije dovoljan dokaz da je potez stvarno dostupan; osloniti se na stvarne legalne poteze i highlight.

Ne dodavati `data-testid` u source i ne koristiti XPath ili dugačke pozicione CSS lance kada postoji čitljiviji izbor.

## 5. Podaci, autentifikacija i izolacija

### 5.1. Korisnici

- Svaki test dobija svoje korisnike i sobe. Nema zavisnosti od redosleda, ručno pripremljenih naloga ili ishoda prethodnog testa.
- Generator koristi kratak prefiks i random UUID deo, tako da username ostane unutar 50 karaktera, a naziv sobe unutar 100.
- Email je validan, jedinstven i namenjen testiranju, npr. na domenu `example.test`.
- Lozinka je validan test podatak, nije lična lozinka ili postojeća tajna.
- U UI testovima koji ne testiraju auth tok, nalog i token pripremiti preko stvarnog API-ja.
- U E2E se generišu samo tekstualni podaci; oba naloga se zaista registruju i prijavljuju kroz browser.

### 5.2. Browser i request konteksti

- Za uobičajene autentifikovane UI testove napraviti in-memory `storageState` sa stvarnim tokenom i username-om, vezan za tačan frontend origin.
- Ne održavati jedan zajednički nalog niti jedan mutabilan globalni token za sve testove.
- API klijenti šalju token tačno određenog korisnika po pozivu ili kroz njegov odvojeni request kontekst.
- Request fixture ima backend base URL. Ne slati API zahteve na frontend port samo zato što browser koristi taj `baseURL`.
- E2E ima **dva nezavisna `BrowserContext` objekta**, svaki sa svojom stranicom. Dva taba u istom kontekstu nisu dovoljan dokaz izolacije jer dele session podatke.
- Token za E2E GET provere preuzeti iz stvarnog UI login odgovora i zadržati samo u memoriji.
- Svaki ručno napravljen kontekst i request kontekst mora biti zatvoren kroz fixture teardown.

### 5.3. Cleanup

Test korisnici mogu ostati u lokalnoj bazi, kako je dogovoreno. Ipak, ostavljanje aktivnih soba nije potrebno:

- WAITING sobu ukloniti kroz postojeći host `leave` endpoint.
- Ako test padne nakon starta, fixture sme u teardown-u završiti baš svoju još aktivnu igru kroz postojeći finish endpoint.
- Završenu E2E igru ne završavati ponovo.
- Cleanup poziv nikada nije zamena za UI predaju u uspešnom E2E toku i nikada se ne računa kao dokaz da je scenario prošao.
- Čuvati identifikatore resursa koje je test kreirao. Ne tražiti i ne čistiti tuđe sobe po opštem prefiksu.
- Greške u pripremi ili čišćenju prijaviti sa kontekstom. Ne koristiti prazne catch blokove. Ako se očekuje `409` jer je igra već završena, proveriti to ponovnim čitanjem konkretne igre, ne prihvatati svaki `409` bez objašnjenja.

Ne očekivati praznu bazu, praznu listu soba, ukupan broj korisnika jednak broju test korisnika ili rank `1` za novog korisnika.

## 6. API scenariji: tačno 10

Raspodela: pet pozitivnih (`API-01`, `03`, `06`, `07`, `10`) i pet negativnih (`API-02`, `04`, `05`, `08`, `09`).

### API-01 — Uspešna registracija i početne vrednosti

**P1 | Pozitivan | `auth.api.spec.ts`**

- Preduslov: jedinstven username/email i validna lozinka.
- Akcija: `POST /auth/register` sa validnim telom.
- Očekivanja: `201`; pozitivan ID; očekivani username/email; `role=USER`; `active=true`; `wins=0`, `losses=0`, `rating=1000`; postoji `createdAt`.
- Odgovor ne sme da izloži password/passwordHash.
- Implementacija: `AuthApi.register()` vraća HTTP odgovor; test proverava status pre čitanja tipizovanog tela.

### API-02 — Odbijena registracija već registrovanog email-a

**P1 | Negativan | `auth.api.spec.ts`**

- Preduslov: kroz fixture registrovan jedan korisnik.
- Akcija: novi registracioni zahtev sa drugim jedinstvenim username-om, ali istim email-om.
- Očekivanja: `409`; `message` označava već registrovan email; ne dobija se novi korisnik.
- Implementacija: razlikovanje username-a sprečava da test slučajno proverava pogrešno pravilo jedinstvenosti.

### API-03 — Uspešan login i korišćenje dobijenog tokena

**P1 | Pozitivan | `auth.api.spec.ts`**

- Preduslov: sopstveni registrovan korisnik.
- Akcija: `POST /auth/login`, zatim `GET /auth/me` sa vraćenim bearer tokenom.
- Očekivanja: oba odgovora `200`; token je neprazan string; login identitet je tačan; `/me` vraća baš ID i identitet tog korisnika.
- Implementacija: ne koristiti samo dekodiranje JWT-a kao dokaz da autentifikacija funkcioniše. Stvarni zaštićeni zahtev potvrđuje upotrebljivost tokena.

### API-04 — Login sa pogrešnom lozinkom

**P1 | Negativan | `auth.api.spec.ts`**

- Preduslov: postoji sopstveni registrovan korisnik.
- Akcija: login sa njegovim email-om i drugačijom, nepraznom lozinkom.
- Očekivanja: `401`; poruka `Invalid email or password`; nema tokena u odgovoru.
- Implementacija: validan oblik payload-a, da se zaista testira odbijanje kredencijala, a ne `400` validacija forme.

### API-05 — Zaštićeni endpoint odbija zahtev bez tokena

**P1 | Negativan | `auth.api.spec.ts`**

- Preduslov: request bez Authorization header-a.
- Akcija: `GET /api/rooms`.
- Očekivanja: tačno `401`, bez podataka o sobama.
- Implementacija: koristiti zaista neautentifikovan kontekst. Ne zahtevati JSON error šemu ako Spring security odgovor nema takvo telo.

### API-06 — Kreiranje sobe automatski dodaje hosta

**P1 | Pozitivan | `rooms.api.spec.ts`**

- Preduslov: nov autentifikovan korisnik bez aktivne sobe.
- Akcija: `POST /api/rooms` sa jedinstvenim validnim nazivom.
- Očekivanja: `201`; ID; tačan naziv; `WAITING`; `playerCount=1`; `gameId=null`.
- Dodatna provera istog ugovora: članov `GET /api/rooms/{id}` prikazuje tačno jednog igrača, odgovarajući user ID i `host=true`; `/current` vraća istu sobu.
- Implementacija: `RoomsApi`; host leave u teardown-u.

### API-07 — Drugi igrač se pridružuje kao guest, bez automatskog starta

**P1 | Pozitivan | `rooms.api.spec.ts`**

- Preduslov: dva nova korisnika, WAITING soba prvog.
- Akcija: drugi korisnik šalje `POST /api/rooms/{id}/join`, bez izmišljenog user ID-a u telu.
- Očekivanja: `201`; članstvo drugog korisnika, `host=false`; detalji sobe prikazuju dva različita igrača i jednog hosta.
- Soba ostaje `WAITING`, `playerCount=2`, `gameId=null`; `/current` gosta vodi na istu sobu.
- Implementacija: validirati članstvo ID-jevima, ne samo nazivima.

### API-08 — Treći igrač ne može da uđe u punu sobu

**P1 | Negativan | `rooms.api.spec.ts`**

- Preduslov: WAITING soba sa dva igrača; treći korisnik nema drugo aktivno članstvo.
- Akcija: treći korisnik poziva join za tu sobu.
- Očekivanja: `409`, poruka `Room is full`; soba ostaje sa prvobitna dva igrača; `/current` trećeg korisnika vraća `204`.
- Implementacija: ne startovati igru pre pokušaja, inače bi se proveravalo pravilo statusa PLAYING umesto kapaciteta.

### API-09 — Guest ne može da startuje igru

**P1 | Negativan | `games.api.spec.ts`**

- Preduslov: WAITING soba sa dva igrača.
- Akcija: guest šalje `POST /api/games/rooms/{roomId}/start`.
- Očekivanja: `403`, poruka `Only the host can start the game`; soba ostaje `WAITING`, bez `gameId`.
- Implementacija: dva igrača su već prisutna, tako da jedini namerni razlog odbijanja bude uloga.

### API-10 — Leaderboard vraća pravilno sortirane i paginirane podatke

**P2 | Pozitivan | `leaderboard.api.spec.ts`**

- Preduslov: kroz postojeći API obezbediti najmanje tri sopstvena aktivna korisnika, bez pretpostavke o drugim korisnicima u bazi.
- Akcija: autentifikovan `GET /api/leaderboard?page=0&size=2`, zatim page `1` sa istim size.
- Očekivanja: `200`; struktura `entries`, `page`, `size`, `totalElements`, `totalPages`; dužina stranice odgovara dostupnim podacima.
- Proveriti da je rating opadajući, a kod jednakog ratinga `userId` rastući, i unutar stranica i na njihovoj granici.
- Rankovi počinju od 1 na prvoj strani i nastavljaju se od 3 na drugoj; nema preklapanja user ID-jeva te dve strane.
- Metadata je konzistentna sa istim ukupnim brojem korisnika u ovom mirnom lokalnom izvršavanju.
- Implementacija: ne zahtevati da baš novi test korisnici budu na prvoj strani. Size `2` omogućava stvarnu paginaciju bez kreiranja 21 naloga.

**Zašto nema još API slučajeva:** uspešan start, legalan potez, predaja, pobednik, statistika i zatvaranje sobe temeljno se proveravaju u E2E. Sa ograničenjem od 10 API testova, ovaj raspored daje širi demonstracioni uzorak i dogovoreni odnos pozitivnih i negativnih slučajeva.

## 7. UI scenariji: tačno 12

Priprema kroz API je dozvoljena i poželjna kada sama priprema nije predmet UI testa. Nijedan od ovih testova ne zavisi od E2E.

### UI-01 — Registraciona forma traži sva obavezna polja

**P2 | `auth.ui.spec.ts`**

- Preduslov: guest browser context, otvoren `/register`.
- Koraci: ostaviti polja prazna i kliknuti `Register`.
- Očekivanja: `All fields are required.`; korisnik ostaje na registraciji; forma je i dalje dostupna.
- Implementacija: `RegisterPage`; ovaj scenario ne zahteva API kreiranje korisnika.

### UI-02 — Registracija odbija različite lozinke

**P1 | `auth.ui.spec.ts`**

- Preduslov: guest context, jedinstveni validni podaci.
- Koraci: popuniti username, validan email i dve različite lozinke; submit.
- Očekivanja: `Passwords do not match.`; nema prelaska na login niti potvrde uspešne registracije.
- Implementacija: `RegisterPage`; obavezno razlikovati input `Password` od `Confirm Password`.

### UI-03 — Pogrešna lozinka prikazuje grešku pri login-u

**P1 | `auth.ui.spec.ts`**

- Preduslov: korisnik pripremljen API-jem, browser nije prijavljen.
- Koraci: otvoriti login, uneti njegov email i pogrešnu lozinku, submit.
- Očekivanja: vidljiva poruka `Invalid email or password`; ostaje `/login`; nema lobby prikaza; submit je ponovo dostupan.
- Implementacija: stvarni backend odgovor, bez `route.fulfill` simulacije.

### UI-04 — Neprijavljen korisnik ne može direktno da otvori lobby

**P1 | `auth.ui.spec.ts`**

- Preduslov: potpuno čist browser context.
- Koraci: direktan odlazak na `/lobby`.
- Očekivanja: redirect na `/login`; vidljiva login forma; nema sadržaja autentifikovanog lobby-ja.
- Implementacija: `LoginPage` i navigacija; ne ubacivati nevažeći token, jer je to drugi scenario.

### UI-05 — Logout uklanja pristup zaštićenom ekranu

**P1 | `auth.ui.spec.ts`**

- Preduslov: svoj korisnik autentifikovan kroz fixture, otvoren lobby.
- Koraci: proveriti prikaz username-a, kliknuti `Logout`, ponovo pokušati direktan odlazak na `/lobby`.
- Očekivanja: oba puta završava na login-u; ponovni pristup lobby-ju bez login-a nije moguć.
- Implementacija: `LobbyPage.logout()`; glavni dokaz je ponašanje aplikacije, ne samo čitanje local storage-a.

### UI-06 — Kreiranje sobe odbija naziv sastavljen od razmaka

**P2 | `lobby.ui.spec.ts`**

- Preduslov: autentifikovan nov korisnik bez aktivne sobe.
- Koraci: `Create Room`, upisati samo razmake u `Room name`, kliknuti `Create`.
- Očekivanja: `Room name is required.`; ostaje lobby, soba nije napravljena, `/current` ostaje `204`.
- Implementacija: `LobbyPage`; provera razmaka je korisnija od samog praznog inputa jer pokazuje trim validaciju.

### UI-07 — Kreirana soba vodi hosta u waiting room

**P1 | `lobby.ui.spec.ts`**

- Preduslov: autentifikovan korisnik bez aktivne sobe.
- Koraci: kroz create modal kreirati jedinstveno imenovanu sobu.
- Očekivanja: `/room/{id}`; tačan naziv; `1/2 players`; username kreatora i oznaka `(host)`; poruka `Waiting for a second player...`.
- Implementacija: `LobbyPage` i `WaitingRoomPage`; sačekati stvarni `201` i ispravnu rutu; cleanup sopstvene sobe.

### UI-08 — Start je dostupan samo hostu kada postoje dva igrača

**P1 | `waiting-room.ui.spec.ts`**

- Preduslov: dva odvojena autentifikovana konteksta; soba inicijalno ima samo hosta.
- Koraci: host otvara waiting room i nema Start dugme; guest se pridružuje kroz API pripremu; oba UI-ja prikazuju istu sobu.
- Očekivanja: host vidi `2/2 players` i aktivno `Start game`; guest vidi oba username-a, poruku čekanja na hosta i nema Start dugme.
- Implementacija: dva `WaitingRoomPage` objekta; ne klikće se start jer je predmet ovog testa uslov prikaza i uloga. Klik i pokretanje obuhvaćeni su E2E testom.

### UI-09 — Guest napušta waiting room, host ostaje

**P1 | `waiting-room.ui.spec.ts`**

- Preduslov: sopstvena WAITING soba sa dva korisnika; guest UI otvoren.
- Koraci: guest klikne `Leave room`; host ostaje u svom kontekstu.
- Očekivanja: guest je u lobby-ju; host ponovo vidi `1/2 players`, bez gosta i bez Start dugmeta; soba i dalje postoji i `WAITING` je.
- Dodatno: guest `/current` je `204`; nijedna igra nije napravljena.
- Implementacija: `WaitingRoomPage`; ne zameniti ovaj slučaj predajom iz već aktivne igre.

### UI-10 — Host otkazuje waiting room

**P1 | `waiting-room.ui.spec.ts`**

- Preduslov: sopstvena WAITING soba sa hostom i gostom, oba UI-ja otvorena.
- Koraci: host klikne `Leave room`.
- Očekivanja: host odlazi u lobby; guest se posle osvežavanja podataka takođe vraća u lobby; oboje više nemaju aktivnu sobu.
- Proveriti da ID te sobe ne postoji u waiting listi, a direktan GET detalja daje `404`.
- Implementacija: odvojeni konteksti i čekanje stvarne UI promene, bez ručnog reload-a gosta.

### UI-11 — Otkazivanje predaje ne završava meč

**P1 | `board.ui.spec.ts`**

- Preduslov: API priprema dva svoja korisnika, sobu, join i start; oba browsera mogu prikazati tu aktivnu igru.
- Koraci: u jednom UI-ju kliknuti toolbar `Forfeit Game`; pročitati upozorenje; kliknuti `Cancel`.
- Očekivanja: potvrda je zatvorena, nema result modal-a, tabla ostaje dostupna i igra je i dalje `IN_PROGRESS`; oba korisnika i dalje imaju tu PLAYING sobu.
- Proveriti da su rating i wins/losses ostali jednaki početnom snapshot-u.
- Implementacija: `BoardPage`; legalno je pripremiti igru kroz API, jer je predmet testa isključivo otkazivanje UI potvrde. Cleanup završava tu igru tek nakon provera.

### UI-12 — Leaderboard prikazuje podatke i rang prijavljenog korisnika

**P2 | `leaderboard.ui.spec.ts`**

- Preduslov: sopstveni autentifikovan korisnik bez aktivne sobe.
- Koraci: iz lobby-ja kliknuti `Leaderboard`; sačekati tabelu i `Your rank`; zatim koristiti `Back to lobby`.
- Očekivanja: `/leaderboard`; kolone `#`, `Player`, `Rating`; prikazani redovi odgovaraju stvarnom leaderboard odgovoru za page `0`, size `20`.
- `Your rank` i pripadajući rating odgovaraju `/api/leaderboard/me`; rating je konzistentan sa `/auth/me`.
- Ako se korisnik nalazi među prikazanim redovima, njegov red mora imati tačan identitet i rating. Njegovo odsustvo sa prve strane nije greška ako mu je rank veći od 20.
- Na kraju povratak u lobby.
- Implementacija: `LeaderboardPage`; glavni dokaz sopstvenog ranga je vidljivi `Your rank`, nezavisno od toga na kojoj strani tabele korisnik pripada.

### Zašto baš ovi UI testovi

Oni pokazuju više vrsta automatizacije, a ne dvanaest varijacija istog login-a: lokalnu validaciju, prikaz server greške, route guard, session, modal, kreiranje resursa, host/guest uloge, asinhrono osvežavanje drugog browsera, odustajanje od destruktivne akcije i tabelarni prikaz.

Namerno nisu dodati svi auth boundary slučajevi, svi modal cancel tasteri, visual snapshots i poseban UI pagination test. Za determinističnu drugu UI stranu trebalo bi obezbediti više od 20 aktivnih naloga; u ovoj maloj prezentacionoj kolekciji paginacija ima bolji odnos koristi i pripreme kroz `API-10`.

## 8. E2E-01 — Dva igrača od registracije do predaje i novih ratinga

**P1 | `match.e2e.spec.ts` | Jedan `test()` sa jasno imenovanim `test.step()` celinama**

### 8.1. Svrha

Dokazati da dva stvarna korisnika mogu preko UI-ja napraviti naloge, prijaviti se, napraviti i popuniti sobu, pokrenuti istu partiju, odigrati legalan potez, videti sinhronizovanu tablu i završiti meč predajom, uz pravog pobednika i sačuvane nove ratinge i wins/losses.

Ne pokušava se regularno iznošenje svih 15 figura.

### 8.2. Preduslovi

- Backend i frontend su pokrenuti sa aktuelnim izmenama predaje i statistike.
- Backend koristi dogovoreni početni rating `1000` i podrazumevani K-faktor `40`. Ako je K namerno promenjen u njegovom okruženju, očekivanja se moraju svesno uskladiti pre izvršavanja; ne zaključivati očekivani rating iz samog dobijenog rezultata.
- Dva nova jedinstvena identiteta A i B; nema unapred kreiranih korisnika za ovaj test.
- Dva čista browser konteksta. A je host, B je guest. Za konačni ishod **B predaje, A dobija**, bez obzira na boju ili početni potez.

### 8.3. Koraci i očekivanja

| Korak | UI akcija | Ključna očekivanja i dozvoljene GET provere |
|---|---|---|
| 1 | A popunjava registraciju | `201`, redirect na login i poruka `Account created. You can log in now.` |
| 2 | A se prijavljuje | Stvarni login `200`, lobby prikazuje A; GET `/me` beleži njegov ID i početnu statistiku |
| 3 | B se registruje i prijavljuje u drugom kontekstu | Iste provere za B; identiteti i session-i su odvojeni |
| 4 | A kreira jedinstvenu sobu | Waiting room, A je host, `1/2`; stvarni room ID čuva se iz odgovora/rute |
| 5 | B otvara Join Room i pridružuje se baš toj sobi | Oboje vide isti room ID, oba imena, `2/2`; igra još nije sama startovala |
| 6 | A klikne Start game | `201`, oba browsera prelaze na `/board?gameId=...` za isti game ID |
| 7 | Oboje otvaraju početno bacanje kroz Roll dice | API stanje i UI se usklađuju; dobijene boje i početni igrač čitaju se iz stvarnog rezultata |
| 8 | Početni igrač kroz UI baca ako nema playable dice, pa pomera jednu figuru | Pravi move zahtev uspeva; prikaz table je promenjen prema vraćenom stanju |
| 9 | Protivnik ostaje na svojoj otvorenoj tabli | Bez reload-a dobija iste promene na source/destination poljima |
| 10 | B otvara Forfeit Game i potvrđuje predaju | Stvarni finish `200`; B vidi `YOU LOST!`, A vidi `YOU WON!` |
| 11 | Čitanje rezultata i statistike | Jedan pobednik A, jedan poraženi B; `FINISHED`, `finishedAt` postoji, soba `CLOSED`; proveriti tačne brojke ispod |
| 12 | Oboje iz rezultata odlaze na View Leaderboard | Svako vidi svoj ažuriran rating u `Your rank`; poređenje sa svojim GET leaderboard/me |
| 13 | Back to lobby kod oba igrača | Nema aktivne sobe, oba `/rooms/current` daju `204`; Create/Join su ponovo dostupni |

Uspešni E2E tok nema direktne POST pozive iz test koda. Browser aplikacija ih prirodno šalje kao posledicu klikova; test ih može posmatrati i proveravati.

### 8.4. Tačne završne provere

| Podatak | A: pobednik | B: predavalac |
|---|---|---|
| `wins` preko sopstvenog `/auth/me` | `1` | `0` |
| `losses` preko sopstvenog `/auth/me` | `0` | `1` |
| `rating`, uz potvrđeni K=40 | `1020` | `980` |
| Game player winner flag | `true` | `false` |
| UI poruka | `YOU WON!` | `YOU LOST!` |
| Loser UI statistika | Ne zahtevati nepostojeći prikaz | `Rating: 980`, `Losses: 1` |
| Aktivna soba posle završetka | Nema, HTTP `204` | Nema, HTTP `204` |

Proveravati i početne snapshot-e, tako da je jasno od kojih vrednosti se promena meri. Novi korisnici omogućavaju tačna numerička očekivanja, umesto nedovoljnih provera poput „rating se nekako promenio”.

Posle uspešnog finish odgovora, `/auth/me` treba odmah da vrati commit-ovane vrednosti. Ne uvoditi polling koji bi sakrio pogrešno sačuvane brojke; polling/auto-wait je namenjen asinhronom prikazu drugog UI-ja. Nije potreban novi login.

Leaderboard redosled zavisi od svih postojećih korisnika. Ne očekivati unapred zadat rank, garantovan rast/pad ranka ili da su A i B na prvoj strani. Tačan rating proveriti u ličnom rank prikazu, a stvarni rank uporediti sa endpoint-om `/api/leaderboard/me`.

### 8.5. Opening roll i slučajnost

- Ne pretpostavljati boju hosta, početnog igrača, vrednost kockica ili prvi legalan potez.
- Svaki opening krug: oba igrača koji još nemaju svoj opening die kliknu Roll dice; posmatrati tačan odgovor svakog zahteva.
- Pri nerešenom opening-u backend briše oba opening die polja. Ponoviti samo taj legalni deo toka.
- Uvesti konačnu granicu, npr. 10 opening krugova. Ako se prekorači, test eksplicitno pada sa poslednjim stanjem i razlogom; ne raditi beskonačan loop, `skip` ili prećutni prolaz.
- Kada postoji početni igrač, on se određuje iz `currentTurnUserId` i liste game players, ne iz redosleda browsera.
- U sadašnjoj implementaciji opening ne daje playable dice. Ako je `currentState.dice` prazno, aktivni igrač još jednom klikne Roll dice kroz UI. To je dokumentovana razlika od PRD-a.
- Za standardnu početnu tablu posle tog bacanja očekuje se dostupan potez. Prazan rezultat legal-moves u tom trenutku nije razlog da se preskoči pomeranje i nastavi kao da je E2E ispunjen.
- Test ne koristi kontrolisane kockice, mocking ili pisanje u bazu.

### 8.6. Kako implementirati pouzdan potez na SVG tabli

Ovo je tehnički najosetljiviji deo plana i treba ga rešiti u `BoardPage`, ne ad hoc koordinatama u spec-u:

1. GET legal-moves pozvati kao trenutno aktivni igrač i odabrati jedan konkretan ponuđen potez.
2. Pročitati trenutno stanje i sačuvati source/destination pre poteza. Za prvi potez sa standardne table nema potrebe za kompletnim algoritmom za bar ili bearing-off.
3. Source polje identifikovati prema broju u `svg.board text.num`, odgovarajućoj polovini table i boji figurenog `<use href>`.
4. Izabrati stvarnu gornju/highlighted figuru na tom polju, ne proizvoljan `.nth()` i ne opštu `.movable` klasu.
5. Kliknuti figuru i sačekati selection i legalne target/ghost elemente. Izabrati target koji odgovara destination polju.
6. Koordinate izvlačiti iz stvarnog DOM/SVG prikaza, preko bounding box-a ili SVG screen transformacije, prilagođene renderovanom SVG-u. Ne hardkodovati screen piksele.
7. Kliknuti stvarni UI target, ne slati POST moves iz testa i ne pozivati Angular metode kroz `evaluate`.
8. Unapred započeti čekanje tačnog `POST /api/games/{gameId}/moves` odgovora; proveriti `200` i da poslati source/destination odgovaraju odabranom legalnom potezu.
9. Proveriti da se authoritative stanje zaista promenilo i da je potez zabeležen u GET moves za tog igrača.
10. Na obe stranice sačekati završetak animacije i pročitati broj/boju figura na relevantnim source/destination poljima. Uporediti sa dobijenim novim stanjem, uz očuvanje ukupnog broja figura.

Nije dovoljno samo da se SVG vidi, da HTTP poziv bude uspešan ili da drugi browser vrati istu JSON vrednost. Mora postojati dokaz promene u oba prikazana UI-ja.

Čitanje DOM geometrije kroz `evaluate` je dozvoljeno; čitanje/menjanje Angular interne instance, importovanje frontend geometry fajla ili pokretanje njegovih service metoda nije. Ne kopirati engine pravila u test projekat. Legal-moves služi kao izbor test ulaza; ovaj test ne dokazuje sve njegove algoritamske odluke.

## 9. Konfiguracija, čekanja i dijagnostika

### 9.1. Playwright projekti

Planirati tri jasno odvojena projekta:

| Projekat | Testovi | Napomena |
|---|---|---|
| `api` | `tests\api\*.api.spec.ts` | Samo request fixture-i, bez otvaranja browsera |
| `ui-chromium` | `tests\ui\*.ui.spec.ts` | Desktop Chromium |
| `e2e-chromium` | `tests\e2e\*.e2e.spec.ts` | Desktop Chromium, dva konteksta |

`testMatch` mora biti nepreklapajući: isti spec ne sme da se izvrši i kao UI i kao E2E. Ne praviti project dependencies između ove tri grupe; svaka mora samostalno da radi.

Ostala podešavanja:

- Zadržati postojeći Playwright paket i lockfile; ne raditi nepovezan upgrade.
- Dodati TypeScript kao dev dependency test projekta ako compiler nije već direktno deklarisan, zbog zasebnog `typecheck` koraka.
- `tsconfig.json`: strict i noEmit; bez `any` za poznate response ugovore. Sačuvati postojeći CommonJS pristup umesto nepotrebnog prelaska na drugi module sistem.
- Podrazumevani frontend i API URL-ovi su lokalni. Po potrebi dozvoliti `BASE_URL` i `API_BASE_URL` iz process environment-a, bez dodatne dotenv zavisnosti i bez obećavanja da se `.env` automatski čita.
- Jedan worker, bez fully parallel režima, za preglednu lokalnu demonstraciju. Podaci i dalje ostaju nezavisni; jedan worker nije zamena za izolaciju.
- Bez retry-ja u osnovnom lokalnom izvršavanju. Ne sakrivati nestabilnost ponavljanjem neuspelog testa.
- HTML i sažet terminal reporter; screenshot `only-on-failure`; trace `retain-on-failure`; video nije deo dogovorenog obima.
- Ne zadržavati postojeće `on-first-retry` kao jedini trace uslov, jer sa nula retry-ja ne daje traženi trag pri prvom neuspehu.
- Desktop viewport, npr. 1440×1000; SVG interakcija i dalje ne zavisi od hardkodovanih screen koordinata.
- Posebno definisati ograničene timeout-e za E2E i asinhrone UI promene. To su zaštitne granice izvršavanja, ne očekivano trajanje prezentacije.

Za dva ručno kreirana E2E konteksta centralni fixture treba da obezbedi screenshot oba igrača pri padu i njihovo prilaganje report-u. Proveriti da trace obuhvata oba konteksta; ne pretpostaviti da je screenshot standardnog `page` fixture-a dovoljan.

### 9.2. Pravila čekanja

- Koristiti Playwright auto-wait i web-first assertions.
- `waitForResponse` registrovati pre klika i filtrirati po metodi i tačnoj putanji/ID-u, posebno kada polling šalje dodatne GET zahteve.
- Za drugo UI stanje koristiti očekivanja koja čekaju prikaz, sa granicom koja uzima u obzir postojeći polling i animacije.
- `expect.poll` koristiti za read-only dijagnostičke provere kada to ima smisla, ne za ponavljanje akcija koje menjaju stanje.
- Ne koristiti `waitForTimeout` kao sinhronizaciju.
- Ne koristiti `networkidle` kao kriterijum spremnosti; aplikacija ima periodično osvežavanje i socket.
- Ne koristiti `force: true` da se prikrije da je UI zauzet, prekriven dijalogom ili da odabrani element nije stvarna meta.
- Ne koristiti `test.skip`, `fixme` ili očekivani pad da se nedovršen obavezni scenario prikaže kao gotov.

### 9.3. Greške i report

Pri neuspehu treba razlikovati:

- neuspeh pripreme naloga/sobe;
- pogrešan HTTP status ili payload;
- neuspešnu navigaciju/selector;
- problem sinhronizacije ili prikaza table;
- pogrešnog pobednika/statistiku;
- neuspešno čišćenje resursa.

Poruke uključuju scenario, endpoint i relevantne room/game ID-jeve. Dijagnostički podaci ne smeju nekontrolisano da objave bearer token ili lozinku. Report, trace, screenshots, `test-results`, `node_modules` i eventualni auth state ne idu u Git.

## 10. Redosled implementacije i todos

Ovo su budući implementacioni zadaci, ne izmene koje su već urađene:

| Todo | Rezultat | Preduslov |
|---|---|---|
| T1: Postavljanje test osnove | Prilagođen config, tri projekta, scripts, strict TypeScript; uklonjeni generički example testovi | Odobren plan |
| T2: API podrška i podaci | Četiri klijenta, tipovi, generator, izolovani korisnici i cleanup fixture-i | T1 |
| T3: POM sloj | Šest Page Objects, modal scope-ovanje i ograničena SVG DOM podrška | T1 |
| T4: Deset API testova | API-01 do API-10, svaki sa sopstvenom pripremom | T2 |
| T5: Dvanaest UI testova | UI-01 do UI-12, nezavisni i sa API pripremom gde je primereno | T2, T3 |
| T6: Jedan E2E | UI tok oba korisnika, legalan potez, predaja, tačne brojke i leaderboard | T2, T3 |
| T7: Provera kompletnog skupa | Tačan broj, typecheck, izvršavanje i ponovljiv E2E, dijagnostika oba browsera | T4, T5, T6 |
| T8: Uputstvo i priprema prezentacije | README samo u test repozitorijumu, komande, preduslovi, ograničenja i tok demonstracije | T7 |

API podrška i POM su razdvojene odgovornosti; API scenariji ne zavise od napisanih UI scenarija. E2E takođe ne zavisi od toga da su drugi testovi prethodno pokrenuti.

U praktičnom radu prvo osposobiti mali vertikalni deo sa jednim API i jednim UI slučajem, pa popuniti ostatak dogovorenih scenarija. SVG potez rešiti pre nego što se ceo E2E proglasi završenim.

## 11. Pokretanje i provera gotovosti

### 11.1. Preduslovi

Backend, baza i frontend se pokreću postojećim načinom korisnika, izvan test runner-a. README test projekta samo navodi da moraju biti dostupni i da backend mora koristiti aktuelne izmene i očekivani Elo K-faktor. Ne uređuje njihove konfiguracije i ne dodaje automatski webServer koji traži njihove foldere.

Za nov checkout test repozitorijuma: instalirati njegove zaključane zavisnosti pomoću `npm ci` i Chromium pomoću `npx playwright install chromium`. Ako zavisnosti već postoje, ne reinstalirati ih bez potrebe.

Planirane npm komande, iz korena postojećeg test repozitorijuma:

```powershell
Set-Location 'C:\Ucenje\BACKGAMEON\Backgammon Tests\tests'
npm run typecheck
npx playwright test --list
npm run test:api
npm run test:ui
npm run test:e2e -- --headed
npm run test:ui-mode
npm run report
```

Skripte treba da odgovaraju projektima iz odeljka 9: `test` za ceo skup, `test:api`, `test:ui`, `test:e2e`, `test:ui-mode`, `typecheck` i `report`. `test:ui` znači grupu UI scenarija; `test:ui-mode` otvara sam Playwright UI mode.

Navedene komande su plan buduće konfiguracije; ne tvrde da su skripte već dodate.

### 11.2. Kriterijumi prihvatanja implementacije

1. `--list` pokazuje tačno 10 API, 12 UI i 1 E2E slučaj, bez generičkih Playwright primeraka, duplih projekata i skrivenog proširenja broja parametrizacijom.
2. Typecheck prolazi i svaki projekat može samostalno da se izvrši.
3. Ceo skup prolazi sa jednim worker-om i bez retry-ja, sa novim podacima.
4. E2E zatim prolazi u tri nezavisna ponavljanja, npr. `npx playwright test --project=e2e-chromium --repeat-each=3`, svaki put sa novim nalozima. To su ponavljanja istog slučaja, ne tri dodatna E2E scenarija.
5. E2E zaista izvršava UI potez i UI predaju; GET provere ne prikrivaju odsustvo tih koraka.
6. U E2E su potvrđeni i pobednik i poraženi, oba ratinga i oba para wins/losses brojača; loser UI brojke i oba lična leaderboard prikaza su tačni.
7. Provera sinhronizacije uključuje vidljivo novo stanje obe table, ne samo uspešan API odgovor.
8. HTML report jasno prikazuje korake; pri kontrolisanoj proveri neuspeha postoje korisni screenshots oba E2E igrača i trace. Eventualnu privremenu promenu očekivanja vratiti pre predaje.
9. Testovi ponovo rade iako su nalozi i završene igre iz prethodnog izvršavanja ostali u bazi.
10. U Git predaju ulaze samo test fajlovi, njihova konfiguracija, manifest/lockfile i README iz test repozitorijuma. Backend i frontend nisu izmenjeni, niti su njihovi postojeći testovi prisvojeni kao deo dogovorenog broja.

## 12. Predlog toka prezentacije

1. Pokazati strukturu: spec, POM, API klijenti i fixtures; objasniti zašto testovi nisu jedna velika skripta.
2. Prikazati API grupu, uz jedan pozitivan i jedan negativan primer, npr. kreiranje sobe i odbijanje starta gosta.
3. Prikazati odabrane UI primere: mismatch lozinki, host/guest razliku i Cancel pri predaji.
4. Pokrenuti jedini E2E u vidljivom Chromium režimu: jasno označiti A i B, stvarni potez, B predaju, oba rezultata i ratinge.
5. Otvoriti HTML report i objasniti kako se kroz trace analizira neuspeh.

Prezentacija ne treba da tvrdi da je ovo potpuna verifikacija pravila igre, opterećenja ili real-time infrastrukture.

## 13. Šta svesno ostaje van ovog skupa

- Sve kombinacije Backgammon pravila: bar, hit, doubles, obavezna upotreba kockica, bearing-off i overshoot.
- Regularna pobeda iznošenjem svih 15 figura.
- Iscrpna Elo matematika za različite ratinge, donja granica nula i svi rounding slučajevi.
- Konkurentni join/start/finish zahtevi, dupli klikovi i race condition-i.
- Timeout auto-play, prekid mreže, zatvaranje browsera i reconnect ponašanje.
- Poseban STOMP/WebSocket protokol test; provera UI usklađivanja nije zamena za njega.
- Sve kombinacije API validacije, nepostojeći ID-jevi i svaka grana autorizacije.
- Username i email normalization edge slučajevi izvan osnovnih ugovora.
- Svi leaderboard boundary parametri, neaktivni korisnici i UI druga strana tabele.
- Mobilni prikaz, Firefox/WebKit, performance/load, vizuelna regresija i audit pristupačnosti.

Ovo su namerne granice prezentacionog obima. Ako se kasnije zatraži proširenje, novi slučaj treba dodati svesno ili zameniti manje vredan postojeći, a ne neprimetno povećavati dogovoreni broj.
