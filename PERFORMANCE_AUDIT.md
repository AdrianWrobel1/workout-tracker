# Audyt wydajności i architektury — Workout App

**Zakres:** React + IndexedDB, PWA, mobile-first, single user.  
**Cel:** Maksymalna płynność, zero lagów, brak regresji, gotowość na 10k+ treningów.

---

## 1. Architektura — analiza

### 1.1 State management

| Warstwa | Źródło prawdy | Persystencja | Ocena |
|--------|----------------|--------------|--------|
| Workouts, templates, exercisesDB | React state (WorkoutContext) | `useIndexedDBStore` → pełny `setMany` przy każdej zmianie | **Krytyczny bottleneck** |
| UI (view, tabs, selections) | UIContext | brak | OK |
| Settings | SettingsContext | `useIndexedDBSetting` (per-key) | OK |
| activeWorkout | WorkoutContext | `useIndexedDBDirect` + debounce 100ms | OK |
| recordsIndex | useRecordsIndex (Map) | IndexedDB RECORDS_INDEX | Dobra idea, **niespójne użycie** |

**Problemy:**
- Jeden obiekt kontekstu (WorkoutContext) trzyma `workouts`, `templates`, `exercisesDB` — każda zmiana którejkolwiek powoduje re-render wszystkich konsumentów.
- Brak selektorów / split kontekstów — np. `HistoryView` re-renderuje się przy każdej zmianie `activeWorkout`, `pendingSummary`, itd.
- `useIndexedDBStore(STORES.WORKOUTS, workouts, 200)` — **dependency to referencja `workouts`**. Każde `setWorkouts([...])` daje nową referencję → efekt zapisu (debounced) i tak odpala się przy każdej zmianie. Przy 10k treningach: **jedna zmiana = zapis 10k obiektów do IDB** (setMany).

### 1.2 Render flow

```
App (root)
  ├── useWorkouts() → workouts, setWorkouts, activeWorkout, ...
  ├── useUI() → view, setView, ...
  ├── useSettings() → ...
  ├── useRecordsIndex() → recordsIndex, getRecords, ...
  └── useIndexedDBStore x3 (workouts, exercises, templates) → efekt zapisu
```

- **Każda** aktualizacja `workouts`/`templates`/`exercisesDB` powoduje re-render całego `App` i wszystkich dzieci (views, modale, BottomNav).
- Brak `React.memo` na view’ach — np. `HistoryView` dostaje `workouts` i przy każdej zmianie przelicza `prWorkoutIds`, `getWorkoutIntensity`, `filteredWorkouts` (useMemo zależne od `workouts`).

### 1.3 Persistence flow

- **Odczyt:** jeden raz przy starcie — `getAllFromStore(WORKOUTS/EXERCISES/TEMPLATES)` → cała tablica do pamięci. Przy 10k treningach: **~kilka MB JSON** naraz, parsowanie i 3x setState.
- **Zapis:** 
  - `workouts`: każda zmiana state → po 200ms `storage.setMany(STORES.WORKOUTS, value)` — **cała tablica**.
  - `activeWorkout`: po 100ms `storage.set(STORES.WORKOUTS, { ...activeWorkout, id: 'activeWorkout' })` — jeden obiekt.
- **Brak:** zapisu przyrostowego (single workout put), batchowania po konkretnych akcjach (np. „zapisz tylko ten jeden trening”), transakcji „read–modify–write” z blokadą.

---

## 2. Bottlenecky wydajnościowe

### 2.1 I/O (IndexedDB)

| Operacja | Obecne | Przy 10k treningów (szac.) | O() |
|----------|--------|-----------------------------|-----|
| Cold start load | getAllFromStore x3 | ~3–15 ms każdy, łącznie ~10–50 ms + parse | O(N) |
| Zapis po edycji treningu | setMany(workouts) | 50–300 ms (blokuje main thread?) | O(N) |
| Zapis po zakończeniu treningu | setWorkouts([new, ...old]); → setMany | jak wyżej | O(N) |
| Records index update | setRecordsIndex per exercise | wiele małych zapisów, OK | O(1) per exercise |

**Główny problem:** zapis **całej** tablicy `workouts` przy każdej zmianie (dodanie/edycja/usunięcie jednego treningu). Przy 10k rekordów to setMany(10000) zamiast put(1).

### 2.2 Obliczenia (CPU)

| Miejsce | Obecne | Złożoność | Przy 10k |
|---------|--------|-----------|----------|
| HistoryView `prWorkoutIds` | Dla każdego treningu, dla każdego ćwiczenia: `getExerciseRecords(exId, workouts)` | O(W² · E) | W=10k, E≈5 → sety wywołań getExerciseRecords, każda O(W) |
| getExerciseRecords | getExerciseHistory (filter + sort) + przejście po history | O(W) | ~10k iteracji |
| getExerciseHistory | filter workouts + map + filter | O(W) | ~10k |
| HistoryView `getWorkoutIntensity` | Obliczenie percentyla 70 (sort wszystkich objętości) | O(W log W) | OK |
| HistoryView `filteredWorkouts` | filter + sort + group | O(W log W) | OK |
| detectPRsInWorkout | Dla każdego ćwiczenia: getExerciseRecords(exId, previousWorkouts) | O(E · W) na trening | OK dla pojedynczego treningu |

**Krytyczne:** `prWorkoutIds` w HistoryView przy 10k treningach to **setki milionów** operacji (W² · E). Filtr „PR” w historii jest w praktyce nieużywalny przy dużej liczbie treningów.

**Uwaga:** Masz `useRecordsIndex` i `getRecords(exerciseId)` (O(1)), ale **HistoryView w ogóle z tego nie korzysta** — wywołuje bezpośrednio `getExerciseRecords(exId, workouts)` w pętli.

### 2.3 Re-renders i pamięć

- **App.jsx** ~2k linii, dziesiątki `useCallback`/`useMemo` — każda zmiana state w kontekstach = pełny re-render App i dzieci.
- **VirtualList** używana tylko gdy `filteredWorkouts.length > 200`. Poniżej 200 — renderowane są **wszystkie** karty (groupElements). Przy 1k treningach bez filtra: 1000 komponentów WorkoutCard.
- **Brak memo:** WorkoutCard, HistoryView, ExerciseDetailView nie są opakowane w `React.memo`. Nowa referencja `workouts` → pełny re-render listy.
- **Pamięć:** cała tablica `workouts` w RAM + w IndexedDB. Przy 10k × ~2KB ≈ 20 MB samych treningów — akceptowalne, ale przy pełnym clone (np. setWorkouts([...workouts])) tymczasowo 2x.

### 2.4 Async / race conditions

1. **useRecordsIndex `updateRecordsForExercises`:**
   - Używa `recordsIndex` z closure: `const newMap = new Map(recordsIndex)`.
   - Dwie szybkie aktualizacje (np. dwa zakończone treningi) — druga może nadpisać wynik pierwszej (stale closure). Powinno być: `setRecordsIndex(prev => { const next = new Map(prev); ... return next; })`.

2. **detectPRsInWorkout — mutacja shared state:**
   - `completedWorkout = { ...activeWorkout, id, date, tags }` — shallow copy; `completedWorkout.exercises` to **ta sama** tablica co `activeWorkout.exercises`.
   - `detectPRsInWorkout(completedWorkout, ...)` ustawia `set.isBest1RM = true` itd. → mutuje **activeWorkout** w state.
   - Skutek: po anulowaniu podsumowania aktywny trening ma już „na stałe” ustawione flagi PR. Powinno się przekazywać **głęboką kopię** albo nie mutować setów (tylko zwracać recordTypes i aplikować w callerze na kopii).

3. **Migracja localStorage → IDB (storageService):**
   - `settingKeys.forEach(key => { ... this.setSetting(key, parsed); })` — `setSetting` jest async, nie ma `await`.
   - Następnie od razu `await this.setSetting('_migratedFromLocalStorage', true)`.
   - Część ustawień może nie zdążyć się zapisać przed oznaczeniem migracji jako wykonanej. Należy zbierać promisy i `await Promise.all([...])` przed flagą migracji.

4. **Init vs persistence:**
   - Init ładuje workouts z IDB i ustawia `setWorkouts(workouts)`.
   - useIndexedDBStore(workouts) przy pierwszym mount widzi ten sam stan i po 200 ms robi setMany(workouts). To redundantny zapis przy starcie (można pominąć pierwszy sync po load).

---

## 3. Skalowalność (1k / 5k / 10k+ treningów)

| Metryka | 1k | 5k | 10k | Uwagi |
|---------|----|----|-----|--------|
| Cold start (load all) | ~50–100 ms | ~200–500 ms | ~500 ms–2 s | Zależne od urządzenia; główny koszt to parse + setState. |
| Zapis po dodaniu 1 treningu | setMany(1000) ~20–80 ms | setMany(5000) ~80–300 ms | setMany(10000) ~150–500 ms | Blokuje? Zależne od IDB. |
| History view (bez VirtualList) | 1000 kart DOM | — | — | Już przy 1k bez virtualizacji będzie jank. |
| Filtr PR w History | O(10^6) wywołań getExerciseRecords | O(25·10^6) | O(10^9) | Nieakceptowalne; UI się zawiesi. |
| Pamięć (workouts w RAM) | ~2 MB | ~10 MB | ~20 MB | Do zaakceptowania. |

**Wnioski:**  
- 1k: możliwe „na granicy” bez zmian zapisu i bez użycia cache PR w HistoryView.  
- 5k/10k: **konieczne** zapisy przyrostowe (single workout put), **konieczne** użycie `getRecords` (records index) w HistoryView zamiast getExerciseRecords w pętli, **konieczne** virtualizacja listy historii także poniżej 200 (np. próg 50) lub zawsze gdy lista > 50.

---

## 4. Poprawność logiki

### 4.1 PR detection

- **detectPRsInWorkout:** porównuje do `previousWorkouts` (bez bieżącego) — poprawne.
- **getExerciseRecords(exId, workouts):** uwzględnia wszystkie treningi w `workouts`; przy „current workout” w state trzeba przekazywać listę **bez** bieżącego, żeby nie liczyć PR na sobie — w handleFinishWorkout przekazywane jest `workouts` (stary stan bez completed), więc OK.
- **Błąd w workouts.js:** `prDetected[ex.exerciseId].exerciseName = ex.exerciseName` — w obiekcie ćwiczenia w treningu pole to `name`, nie `exerciseName`. Powinno być `ex.name`.

### 4.2 Indeksy i storage

- **storageService rebuildReverseIndexes:** używa `exercise.id` — w `workout.exercises[]` jest `exerciseId`, nie `id`. Powinno być `exercise.exerciseId`.
- **getWorkoutsWithExercise (fallback):** `w.exercises.some(e => e.id === exerciseId)` — to samo: `e.exerciseId === exerciseId`.
- **RECORDS_INDEX:** useRecordsIndex ładuje z `getAllFromStore('recordsIndex')` — nazwa zgodna z STORES.RECORDS_INDEX. Dla spójności lepiej użyć stałej z storageService.

### 4.3 Agregacje / filtrowanie

- **filteredWorkouts:** filter (PR/heavy/light) + tagi + sort po dacie + grupowanie po miesiącu — spójne.
- **Sort:** `new Date(b.date) - new Date(a.date)` — najnowsze pierwsze, OK.
- **getWorkoutIntensity:** percentyl 70 objętości — poprawne.

---

## 5. Ryzyka utraty danych i edge case’y

1. **Zapis tylko w useEffect (debounced):**  
   Zamknięcie karty/przeglądarki w ciągu 200 ms od ostatniej zmiany → ostatnia zmiana może nie zostać zapisana. Dla „Save Workout” można dodać jawny await zapisu przed zamknięciem podsumowania (już jest zapis przed setPendingSummary(null), ale setWorkouts jest synchroniczne — IDB zapis jest async; przy kill procesu i tak może być strata).

2. **activeWorkout w IDB pod kluczem `id: 'activeWorkout'`:**  
   W tym samym store co treningi. **Obecnie** getAllFromStore(STORES.WORKOUTS) zwraca wszystko, w tym dokument z id 'activeWorkout', więc tablica `workouts` w state go zawiera i setMany(workouts) go zapisuje — utraty dziś nie ma. **Ryzyko:** jeśli kiedykolwiek stan workouts będzie filtrowany (np. bez activeWorkout) przed zapisem, wpis activeWorkout zniknie ze store. **Rekomendacja:** zapis przyrostowy (put/delete pojedynczego treningu) zamiast setMany(workouts) — eliminuje ryzyko i daje O(1) zamiast O(N) przy każdej zmianie.

   Najprostsze bezpieczne podejście: **nie używać setMany(STORES.WORKOUTS, value)** do zapisu całej listy. Zamiast tego:  
   - przy dodaniu treningu: put(workout);  
   - przy edycji: put(workout);  
   - przy usunięciu: delete(id);  
   - stan workouts w React: ładowany z getAll na start; po każdej operacji aktualizować lokalnie i ewentualnie jednorazowo put/delete.  
   W ten sposób wpis 'activeWorkout' w store nie jest nadpisywany przez setMany.

3. **Import:** importAll czyści records index; po imporcie rebuildIndex nie jest wywoływany automatycznie w kodzie (trzeba to sprawdzić w App/Import). Jeśli po imporcie nie ma rebuildIndex, cache PR jest pusty aż do następnego zakończenia treningu.

4. **Workout.id:** używane Date.now() — teoretycznie kolizje przy dwóch zapisach w tej samej ms. Dla single user niskie ryzyko; można przejść na uuid lub id+timestamp.

---

## 6. Propozycje optymalizacji

### 6.1 Rendering

- **React.memo na listach:**  
  WorkoutCard, ExerciseCard (jeśli jest) — memo z custom compare po id (i ewentualnie date).  
  HistoryView, ExerciseDetailView — memo po props (workouts / exerciseId / workouts).

- **Virtualizacja historii:**  
  Użyć VirtualList zawsze gdy `filteredWorkouts.length > 50` (nie 200). Dla widoku „grouped by month” można zrobić wirtualizację po „group” (każda grupa = jeden blok) z dynamiczną wysokością.

- **Konteksty:**  
  Rozdzielić np. WorkoutDataContext (workouts, templates, exercisesDB) od WorkoutUIContext (activeWorkout, pendingSummary, timer). Views które tylko czytają listę nie będą re-renderować się przy zmianie activeWorkout.

- **Batching:**  
  React 18 domyślnie batchuje; upewnić się, że nie ma flushSync. Przy zapisie do IDB nie wywoływać setState w środku request.onsuccess (żeby nie wymuszać sync render w środku callbacku IDB).

- **Suspense:**  
  Na start można opakować „content below header” w Suspense z fallback (skeleton), a ładowanie danych (init IDB + getAll) w „loader” zwracającym promise. To poprawi postrzeganą płynność startu.

### 6.2 Storage (IndexedDB)

- **Zapis przyrostowy zamiast setMany(workouts):**
  - Dodanie treningu: `await storage.set(STORES.WORKOUTS, newWorkout);` + `setWorkouts(prev => [newWorkout, ...prev]);`.
  - Edycja: `await storage.set(STORES.WORKOUTS, updatedWorkout);` + setWorkouts(prev => prev.map(...)).
  - Usunięcie: `await storage.delete(STORES.WORKOUTS, id);` + setWorkouts(prev => prev.filter(...)).
  - **Nie** wywoływać setMany(STORES.WORKOUTS, workouts) w useIndexedDBStore dla tablicy. Albo: useIndexedDBStore tylko dla „initial load”; mutacje przez jawne akcje (addWorkout, updateWorkout, deleteWorkout) które robią put/delete i aktualizują state.

- **Ochrona wpisu activeWorkout:**  
  Jeśli nadal zapisujesz listę treningów do tego samego store: przed setMany odczytać `activeWorkout = await storage.get(STORES.WORKOUTS, 'activeWorkout')`, po setMany jeśli activeWorkout != null wykonać `storage.set(STORES.WORKOUTS, activeWorkout)`.

- **Indeks na dacie:**  
  Masz index na `date`. Wykorzystać do „load last N” zamiast getAll: openCursor na index 'date', direction 'prev', limit 500. Na start ładować np. ostatnie 500 treningów, resztę lazy (np. „Load more” lub przy scrollu).

- **Records index:**  
  Utrzymywać jak teraz; po każdej zmianie treningów (add/update/delete) aktualizować tylko affected exerciseIds (już robione). Upewnić się, że updateRecordsForExercises używa functional setState (prev => ...), żeby uniknąć race.

### 6.3 Obliczenia

- **HistoryView prWorkoutIds:**  
  Użyć cache: `getRecords = useRecordsIndex().getRecords`. Dla każdego workout, dla każdego exercise: `const records = getRecords(ex.exerciseId); if (!records) continue;` i sprawdzić czy w tym treningu jest set z 1RM >= records.best1RM (i ewent. heaviest, volume). Jeśli cache miss — opcjonalnie fallback getExerciseRecords tylko dla tego jednego exId (lub przeliczyć tylko ten exId i wstawić do cache). Złożoność: O(W · E) zamiast O(W² · E).

- **Memoization:**  
  getExerciseRecords w ExerciseDetailView już w useMemo(..., [exerciseId, workouts]). HistoryView: getWorkoutIntensity i filteredWorkouts w useMemo — OK. Dodać memo dla prWorkoutIds z użyciem getRecords (cache).

- **Web Worker (opcjonalnie):**  
  Przy 10k treningów getExerciseHistory/getExerciseRecords dla jednego ćwiczenia to ~10k iteracji. Można przenieść do workera: `getExerciseRecordsInWorker(exerciseId, workouts)` → postMessage, worker zwraca records. To odciąży main thread przy otwieraniu ExerciseDetail lub przy filtrze PR. Priorytet niższy niż naprawa użycia cache w HistoryView.

### 6.4 Pamięć

- Unikać niepotrzebnych kopii całej tablicy: np. `setWorkouts(prev => prev.map(...))` zamiast `setWorkouts(workouts.map(...))` (już w wielu miejscach).
- VirtualList ogranicza liczbę węzłów DOM — to ogranicza też zużycie pamięci przez layout.
- Records index w pamięci: Map(exerciseId -> records). Przy ~200 ćwiczeniach to rząd kilkudziesięciu KB — OK.

### 6.5 UX (60fps, brak layout shift, brak jank)

- **Skeleton / placeholder:**  
  Już jest firstLoad ~350 ms. Rozważyć skeleton dla listy historii (szare bloki) zamiast pustego ekranu.

- **content-visibility:**  
  Dla kart poza viewportem: `content-visibility: auto` na sekcjach miesięcy (przy nie-virtualized list) — przeglądarka może pominąć layout/paint.

- **Stale closure w scroll:**  
  handleScroll w VirtualList: setScrollTop(e.target.scrollTop). Przy 60fps może być dużo setState. Rozważyć requestAnimationFrame + throttle (np. 1 update na frame) albo useRef dla scrollTop i wymuszenie re-render tylko gdy zmieni się visibleRange (np. Math.floor(scrollTop / itemHeight)).

- **Layout shift:**  
  Zarezerwować min-height dla listy (np. 80vh) albo skeleton o stałej wysokości, żeby po załadowaniu nie skakało.

---

## 7. Refaktoryzacje strukturalne

- **Rozdzielenie zapisu od „sync whole array”:**  
  Warstwa danych: `useWorkouts()` zwraca workouts + `addWorkout(w)`, `updateWorkout(w)`, `deleteWorkout(id)`. Wewnątrz: setState + storage.set/delete (bez setMany całej tablicy). useIndexedDBStore(workouts) **wyłączyć** dla WORKOUTS (albo używać tylko do „hydrate on load”).

- **Osobny store na activeWorkout (opcjonalnie):**  
  Np. STORES.ACTIVE_WORKOUT = 'activeWorkout'. Wtedy setMany(workouts) nigdy go nie nadpisze. Mniej specjalnych przypadków w kodzie.

- **Loader / data layer:**  
  Jeden moduł `workoutStore`: init(), getWorkouts(), addWorkout(), updateWorkout(), deleteWorkout(), getActiveWorkout(), setActiveWorkout(). React korzysta z tego przez context lub hook. Łatwiej testować i wymienić persystencję.

- **App.jsx:**  
  Podzielić na mniejsze komponenty (np. ViewRouter, SummaryModal, Toast) i przenieść handlery do custom hooks (useWorkoutActions, useExerciseActions). Zmniejszy rozmiar jednego pliku i zakres re-renderów przy zmianie stanu.

---

## 8. Bundle, tree-shaking, zależności

- **Vite:** domyślnie tree-shaking (ESM). Sprawdzić `vite build` + `npx vite-bundle-visualizer` (lub rollup-plugin-visualizer) — czy lucide-react jest importowany per-icon (np. `import { ChevronLeft } from 'lucide-react'`) czy cała biblioteka.
- **React 19:** OK.
- **@dnd-kit:** używany w SortableExerciseList — duży kawałek bundle; jeśli drag-and-drop tylko w jednym widoku, lazy load: `const SortableExerciseList = React.lazy(() => import(...))`.
- **Dead code:** useDebouncedLocalStorage / useDebouncedLocalStorageManual — w App są importy; jeśli nigdzie nieużywane, usunąć.
- **Stała STORES w useRecordsIndex:** użyć `STORES.RECORDS_INDEX` z storageService zamiast stringa `'recordsIndex'`.

---

## 9. Monitoring i benchmarki

- **Metryki w dev:**  
  - Czas od init() do pierwszego renderu listy (performance.mark/measure).  
  - Czas pierwszego getExerciseRecords (lub getRecords) po otwarciu History.  
  - Liczba re-renderów App przy jednej akcji (React DevTools Profiler / why-did-you-render).

- **Production (opcjonalnie):**  
  - Performance API: navigation timing, LCP dla głównego widoku.  
  - Custom event: `workout_saved` z czasem zapisu (Date.now() przed/po storage.set).  
  - W PWA: periodic sync / background sync nie są wymagane dla single user; focus na szybkość przy otwarciu i po zapisie.

- **Benchmark 10k:**  
  - Plik z 10k treningów (np. testData); mierzyć: getAllFromStore czas, parse czas, czas do „list visible”, czas filtra PR (przed i po optymalizacji cache).

---

## 10. Priorytety (P1 / P2 / P3)

### P1 — Krytyczne (stabilność + skalowalność)

| # | Zadanie | Effort | Impact | Uwagi |
|---|---------|--------|--------|--------|
| 1 | Zapis przyrostowy treningów (put/delete zamiast setMany) + ochrona wpisu activeWorkout przy ewentualnym setMany | 1–2 d | Duży | Eliminuje ryzyko utraty activeWorkout i skraca zapis z O(N) do O(1) przy pojedynczej zmianie. |
| 2 | HistoryView: użycie getRecords (cache) zamiast getExerciseRecords w pętli dla prWorkoutIds | 0.5 d | Duży | Zmniejsza złożoność filtra PR z O(W²·E) do O(W·E); bez tego filtr PR przy 5k+ się wiesza. |
| 3 | Naprawa mutacji w detectPRsInWorkout (deep clone przed wywołaniem lub brak mutacji setów) | 0.5 d | Średni | Zapobiega mutacji activeWorkout i potencjalnym bugom przy anulowaniu podsumowania. |
| 4 | Poprawka race w useRecordsIndex (setRecordsIndex(prev => ...)) | 0.25 d | Średni | Zapobiega nadpisywaniu cache przy szybkich kolejnych aktualizacjach. |
| 5 | Poprawka migracji ustawień (await wszystkich setSetting przed flagą) | 0.25 d | Średni | Gwarantuje pełną migrację ustawień. |

### P2 — Ważne (wydajność + długoterminowo)

| # | Zadanie | Effort | Impact |
|---|---------|--------|--------|
| 6 | Bug w storageService: exercise.id → exercise.exerciseId, e.id → e.exerciseId w reverse index | 0.25 d | Poprawność reverse index |
| 7 | exerciseName → name w detectPRsInWorkout (prDetected[...].exerciseName = ex.name) | 0.1 d | Poprawność etykiet PR |
| 8 | React.memo na WorkoutCard i na view’ach (HistoryView, ExerciseDetailView) z sensownymi dependency | 0.5 d | Mniej re-renderów |
| 9 | Virtualizacja historii od 50 elementów (lub zawsze dla flat list) | 0.5 d | Płynny scroll przy 1k+ |
| 10 | Wyłączenie auto-sync setMany(workouts) w useIndexedDBStore; sync tylko przez add/update/delete | 1 d | Spójne z P1#1 |
| 11 | Optional: ładowanie „ostatnie 500” z IDB po indeksie date zamiast getAll | 1 d | Szybszy cold start przy 10k |

### P3 — Opcjonalne (nice-to-have)

| # | Zadanie | Effort | Impact |
|---|---------|--------|--------|
| 12 | Rozdzielenie WorkoutDataContext vs WorkoutUIContext | 1 d | Mniej re-renderów |
| 13 | Lazy load dla @dnd-kit (SortableExerciseList) | 0.5 d | Mniejszy initial bundle |
| 14 | content-visibility na sekcje listy | 0.25 d | Lekki zysk paint |
| 15 | Throttle/RAF dla scroll w VirtualList | 0.25 d | Mniej setState przy scrollu |
| 16 | Web Worker dla getExerciseRecords (ExerciseDetail) | 1 d | Gładkość przy 10k |
| 17 | Bundle analyzer + usunięcie dead code (useDebouncedLocalStorage jeśli nieużywane) | 0.5 d | Rozmiar bundle |

---

## 11. Podsumowanie

- **Największe ryzyka:** (1) zapis całej tablicy workouts przez setMany przy każdej zmianie i możliwość nadpisania wpisu activeWorkout w tym samym store, (2) złożoność O(W²·E) w filtrze PR w HistoryView przy braku użycia cache, (3) mutacja shared state w detectPRsInWorkout.
- **Największe zyski:** zapis przyrostowy + ochrona activeWorkout (P1), użycie getRecords w HistoryView (P1), memo i virtualizacja (P2). Po tych krokach aplikacja będzie gotowa na 10k+ treningów przy zachowaniu płynności i braku regresji.
- **Estymacja:** P1 łącznie ~2–3 dni, P2 ~2–3 dni. Razem ~5–6 dni roboczych na krytyczne i ważne punkty.

---

## 12. Ocena aplikacji (po wdrożeniu P1 i P2)

**Ocena: 8/10**

**Opis:**

Aplikacja po wdrożeniu poprawek P1 i P2 jest **solidna, przewidywalna i gotowa na długoterminowe użytkowanie** (w tym 10k+ treningów) przy zachowaniu płynności i stabilności.

**Mocne strony (dlaczego 8, a nie mniej):**
- **Architektura:** Jednolity stack (React + IndexedDB, PWA), czytelny podział na domain / hooks / views. Cache rekordów PR (records index) i zapis przyrostowy treningów usuwają główne bottlenecky I/O i CPU.
- **Skalowalność:** Filtr PR w historii korzysta z cache O(1), zapis to put/delete zamiast setMany, virtualizacja od 50 elementów — aplikacja nie „wysadza” się przy dużej liczbie danych.
- **Stabilność:** Brak mutacji shared state (deep clone przed detectPRsInWorkout), functional setState w useRecordsIndex (brak race), pełna migracja ustawień przed flagą, poprawne pola w reverse index i etykietach PR.
- **UX:** Memo na WorkoutCard, HistoryView i ExerciseDetailView ogranicza zbędne re-rendery; użytkownik ma płynny scroll i szybsze reakcje na akcje.

**Dlaczego nie 9–10:**
- **Struktura:** App.jsx nadal bardzo duży (~2k linii); rozbicie na mniejsze komponenty i hooki (np. useWorkoutActions) poprawiłoby utrzymanie i testowanie.
- **Konteksty:** Jeden WorkoutContext łączy dane i UI treningu; rozdzielenie na WorkoutData i WorkoutUI (P3) dałoby mniej re-renderów przy zmianie tylko activeWorkout lub pendingSummary.
- **Cold start przy 10k:** Ładowanie nadal getAll (cała tablica); opcjonalne „ostatnie 500” po indeksie date (P2#11) poprawiłoby czas pierwszego rysowania na słabszym sprzęcie.
- **Monitoring:** Brak wbudowanych metryk (czas zapisu, LCP); przydałoby się minimum (np. performance.mark) pod przyszłe optymalizacje.

**Podsumowanie:** Aplikacja jest **gotowa na wersję 1.0** pod kątem wydajności i niezawodności. Ocena 8/10 odzwierciedla bardzo dobry poziom po P1/P2 z jasno zdefiniowanym kierunkiem na 9–10 (P3 + lekki refaktor + opcjonalne ładowanie fragmentów danych i monitoring).
