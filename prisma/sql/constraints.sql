-- Ograniczenia integralności, których Prisma nie potrafi wyrazić w schema.prisma.
-- Plik jest idempotentny: można go uruchamiać wielokrotnie (`pnpm db:constraints`).
-- Uruchamiany automatycznie po `pnpm db:push` oraz na początku `pnpm db:seed`.

-- 1. Naprawa ewentualnych rozbieżności Copy.status <-> Loan -----------------

-- Egzemplarz oznaczony jako wypożyczony, ale bez aktywnego wypożyczenia.
UPDATE "Copy" c
SET "status" = 'AVAILABLE', "updatedAt" = now()
WHERE c."status" = 'LOANED'
  AND NOT EXISTS (
    SELECT 1 FROM "Loan" l
    WHERE l."copyId" = c."id" AND l."returnedAt" IS NULL
  );

-- Egzemplarz dostępny, ale z aktywnym wypożyczeniem.
UPDATE "Copy" c
SET "status" = 'LOANED', "updatedAt" = now()
WHERE c."status" = 'AVAILABLE'
  AND EXISTS (
    SELECT 1 FROM "Loan" l
    WHERE l."copyId" = c."id" AND l."returnedAt" IS NULL
  );

-- 2. Co najwyżej jedno aktywne wypożyczenie na egzemplarz --------------------

CREATE UNIQUE INDEX IF NOT EXISTS loan_one_active_per_copy
  ON "Loan" ("copyId")
  WHERE "returnedAt" IS NULL;

-- 3. Termin zwrotu musi być po dacie wypożyczenia ---------------------------

ALTER TABLE "Loan" DROP CONSTRAINT IF EXISTS loan_due_after_loaned;
ALTER TABLE "Loan"
  ADD CONSTRAINT loan_due_after_loaned CHECK ("dueAt" > "loanedAt");

-- 3b. PESEL: dokładnie 11 cyfr -----------------------------------------------

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_pesel_format;
ALTER TABLE "user"
  ADD CONSTRAINT user_pesel_format CHECK ("pesel" ~ '^[0-9]{11}$');

-- 4. Synchronizacja Copy.status z wypożyczeniami ----------------------------
--   * nowe aktywne wypożyczenie: AVAILABLE -> LOANED
--   * zwrot: LOANED -> AVAILABLE (o ile nie ma innego aktywnego wypożyczenia)
--   * statusy LOST i MAINTENANCE nigdy nie są zmieniane przez trigger.

CREATE OR REPLACE FUNCTION sync_copy_status_on_loan() RETURNS trigger AS $$
BEGIN
  IF NEW."returnedAt" IS NULL THEN
    UPDATE "Copy"
    SET "status" = 'LOANED', "updatedAt" = now()
    WHERE "id" = NEW."copyId" AND "status" = 'AVAILABLE';
  ELSE
    UPDATE "Copy"
    SET "status" = 'AVAILABLE', "updatedAt" = now()
    WHERE "id" = NEW."copyId"
      AND "status" = 'LOANED'
      AND NOT EXISTS (
        SELECT 1 FROM "Loan" l
        WHERE l."copyId" = NEW."copyId"
          AND l."returnedAt" IS NULL
          AND l."id" <> NEW."id"
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS loan_sync_copy_status ON "Loan";
CREATE TRIGGER loan_sync_copy_status
  AFTER INSERT OR UPDATE OF "returnedAt" ON "Loan"
  FOR EACH ROW
  EXECUTE FUNCTION sync_copy_status_on_loan();
