# Changelog

Alla ändringar i projektet dokumenteras här.

## [0.8.1] - 2025-01-XX

### Ändrat
- Förbättrad visuell koppling mellan agendapunkter och möte
- Tydligare visning av vilket möte agendapunkterna tillhör
- Visuella indikatorer (badge och accent-färger) för att visa att punkterna hänger ihop med ett specifikt möte
- Rubriken ändrad till "Agendapunkter för detta möte" för tydlighet

## [0.8.0] - 2025-01-XX

### Tillagt
- Redigera agendapunkter i mötesfunktionen
- Diskret redigera-knapp istället för rött kryss på mötespunkter
- Möjlighet att radera agendapunkter från redigeringsläget
- Bekräftelsedialog vid radering av agendapunkt

### Ändrat
- Förbättrad layout för mötesfunktionen som matchar resten av sidan
- Konsistent styling mellan användar- och admin-vyer för möten

## [0.7.8] - 2025-01-XX

### Ändrat
- Förbättrad prestanda: Inaktiverade julanimationer i bakgrunden
- Förbättrad prestanda: Tog bort backdrop-filter blur för bättre scroll-prestanda
- Fixat: Signatur-tooltip visar nu alla personer som signerat utan begränsning
- Fixat: Modal stängs inte längre när man markerar text i formulärfält

## [0.7.7] - 2025-01-XX

### Ändrat
- Prestandaoptimeringar för att minska latency och lagg vid scrollning och skrivande
- Memoized utility-funktioner (formatDate, getAvatarColor) för att undvika onödiga beräkningar
- React.memo på CommentItem-komponenter för att förhindra onödiga re-renders
- useMemo för sorterade loggar och kommentarsräkningar
- Debouncing på RichTextEditor input (100ms) för smidigare skrivning
- CSS-optimeringar med will-change och GPU-acceleration för animationer
- Förbättrad scroll-prestanda med contain och transform optimeringar

## [0.7.6] - 2025-01-XX

### Tillagt
- Navigationsmeny med tre alternativ: Logg, Förslagslåda, Mötespunkter
- Undermeny för "Logg" med "Arkiv"-alternativ (visas vid hover)
- Professionell meny-design med dropdown-animationer och hover-effekter

### Ändrat
- Arkiv-funktionen flyttad från header till undermeny under "Logg"
- Förbättrad header-design med mer professionell styling
- Menyn är nu alltid synlig (tidigare dold vid scroll)

## [0.7.5] - 2025-11-29

### Tillagt
- Delat lösenord för att komma åt sidan (SHARED_PASSWORD miljövariabel)
- Inloggningsskärm som kräver lösenord innan man kan se inlägg

## [0.7.4] - 2025-11-29

### Ändrat
- "Reagera"-knappen flyttad upp över dividern, bredvid emojis

## [0.7.3] - 2025-11-29

### Ändrat
- Mindre thumbnails för bilder i inlägg (max 200px istället för 300px)
- Mindre thumbnails i admin-panelens bildöversikt (120px höjd, 150px minsta kolumnbredd)
- Förbättrad layout för bildkort i admin-panel

## [0.7.2] - 2025-11-29

### Tillagt
- Admin-länk i headern som länkar till /admin

## [0.7.1] - 2025-11-29

### Tillagt
- Admin-inloggning med JWT-autentisering
- Admin-panel med databasöversikt (inlägg, kommentarer, signaturer, reaktioner, bilder)
- Admin-sida för att hantera bilder på servern
- Admin-sida för att redigera och ta bort inlägg
- Admin-routes på /admin

## [0.6.3] - 2025-11-29

### Tillagt
- Bilder i inlägg är thumbnails som kan klickas för fullskärm
- Redigera inlägg stöder nu även bilder (ladda upp/ändra/ta bort)

## [0.6.2] - 2025-11-29

### Ändrat
- Bilduppladdning har två alternativ: ladda upp ny eller välja från tidigare
- Punktlista är nu indragen (mindre utskjutande)

## [0.6.1] - 2025-11-29

### Tillagt
- Punktlista i textredigeraren
- Länk i textredigeraren
- Bilduppladdning med förhandsvisning
- Bilder visas i inlägg

## [0.5.3] - 2025-11-29

### Ändrat
- Radera-knapp är nu en papperskorgsikon
- Bekräftelsedialog i samma tema som sidan (istället för browser confirm)

## [0.5.2] - 2025-11-29

### Ändrat
- Radera-knapp visas endast i redigeringsläge

## [0.5.1] - 2025-11-29

### Tillagt
- Ta bort inlägg — radera-knapp med bekräftelse

## [0.4.3] - 2025-11-29

### Ändrat
- Borttagen manuell arkiv-knapp på inlägg (arkivering sker automatiskt eller via avnålning)
- Arkivsidan sorteras och filtreras per månad med antal inlägg
- Fixad tooltip för "och X till" i läst av-listan

## [0.4.1] - 2025-11-29

### Tillagt
- Automatisk arkivering efter 30 dagar (pinnade undantagna)
- Arkiv-sektion i headern för att se arkiverade inlägg
- Återställ arkiverade inlägg
- Popup vid avnålning av gammalt inlägg — välj arkivera eller behåll 30 dagar till

## [0.3.2] - 2025-11-29

### Ändrat
- Reaktioner kräver inte längre namn — klicka direkt på emoji
- Klicka på befintlig reaktion för att lägga till fler

## [0.3.1] - 2025-11-29

### Tillagt
- Reaktions-emojis på inlägg (👍 ❤️ 😊 🎉 👀 🙏)

## [0.2.5] - 2025-11-29

### Ändrat
- Redigeringsknapp flyttad till headern (vänster om nåla)
- WYSIWYG-editor — formateringen visas direkt i texten
- Frågor raderas nu helt (inklusive svar) istället för att markeras som borttagna

## [0.2.4] - 2025-11-29

### Tillagt
- Textformatering — fet, kursiv, understruken
- Formateringsverktyg med knappar B, I, U
- Tangentbordsgenvägar Ctrl+B, Ctrl+I, Ctrl+U

### Ändrat
- Större modal för att skapa inlägg

## [0.2.3] - 2025-11-29

### Tillagt
- Rubrik på inlägg med redigeringsikon bredvid

### Ändrat
- Divider mellan inlägg och kommentarer
- "Ställ en fråga" och "Visa kommentarer" separerade
- Läst av och Signera som läst på samma rad (vänster/höger)

## [0.2.1] - 2025-11-29

### Tillagt
- Redigera inlägg
- Ta bort frågor/svar (visas som "Fråga borttagen" i kursiv)
- Fäll in/ut kommentarer — visar antal istället för hela listan

## [0.2.0] - 2025-11-29

### Tillagt
- Kommentarer och svar — ställ frågor på inlägg och svara i trådar

## [0.1.4] - 2025-11-29

### Ändrat
- Snyggare ändringslogg med formaterade versioner och datum

## [0.1.3] - 2025-11-29

### Tillagt
- Nåla inlägg — förhindrar framtida arkivering

## [0.1.2] - 2025-11-29

### Tillagt
- Signera som läst — personal kan signera att de läst ett inlägg

## [0.1.1] - 2025-11-29

### Ändrat
- Facebook-inspirerad design med avatarer
- Modal för att skapa inlägg
- Ljust tema

## [0.1.0] - 2025-11-29

### Tillagt
- Initial release av Loggen
- Skapa och visa loggmeddelanden
- PostgreSQL-databas med Prisma
