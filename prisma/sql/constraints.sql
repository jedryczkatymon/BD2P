-- Ograniczenia integralności, których Prisma nie potrafi wyrazić w schema.prisma.
-- Plik jest idempotentny: można go uruchamiać wielokrotnie (`pnpm db:constraints`).
-- Uruchamiany automatycznie po `pnpm db:push` oraz na początku `pnpm db:seed`.

-- 1. Usunięcie dawnej synchronizacji Copy.status <-> Loan ------------------
--   Status egzemplarza opisuje tylko stan techniczny; wypożyczenie wynika z Loan.

DROP TRIGGER IF EXISTS loan_sync_copy_status ON "Loan";
DROP FUNCTION IF EXISTS sync_copy_status_on_loan();

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

-- 3c. Słowniki krajów i języków: kody ISO ----------------------------------

ALTER TABLE "Country" DROP CONSTRAINT IF EXISTS country_code_format;
ALTER TABLE "Country"
  ADD CONSTRAINT country_code_format CHECK ("code" ~ '^[A-Z]{2}$');

ALTER TABLE "Language" DROP CONSTRAINT IF EXISTS language_code_format;
ALTER TABLE "Language"
  ADD CONSTRAINT language_code_format CHECK ("code" ~ '^[a-z]{2}$');

-- 3d. Atrybuty autorów i wydawnictw -----------------------------------------

ALTER TABLE "Author" DROP CONSTRAINT IF EXISTS author_birth_year_range;
ALTER TABLE "Author"
  ADD CONSTRAINT author_birth_year_range
  CHECK ("birthYear" IS NULL OR "birthYear" BETWEEN -3000 AND 2100);

ALTER TABLE "Publisher" DROP CONSTRAINT IF EXISTS publisher_email_format;
ALTER TABLE "Publisher"
  ADD CONSTRAINT publisher_email_format
  CHECK ("email" IS NULL OR "email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

ALTER TABLE "Publisher" DROP CONSTRAINT IF EXISTS publisher_website_format;
ALTER TABLE "Publisher"
  ADD CONSTRAINT publisher_website_format
  CHECK ("website" IS NULL OR "website" ~ '^https?://');

-- 3e. Adresy: polski kod pocztowy NN-NNN --------------------------------------

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_postal_code_format;
ALTER TABLE "user"
  ADD CONSTRAINT user_postal_code_format
  CHECK ("postalCode" ~ '^[0-9]{2}-[0-9]{3}$');

-- Wydawnictwo zagraniczne może mieć kod w innym formacie.
ALTER TABLE "Publisher" DROP CONSTRAINT IF EXISTS publisher_postal_code_format;
ALTER TABLE "Publisher"
  ADD CONSTRAINT publisher_postal_code_format
  CHECK (
    "postalCode" IS NULL
    OR "countryCode" IS DISTINCT FROM 'PL'
    OR "postalCode" ~ '^[0-9]{2}-[0-9]{3}$'
  );

ALTER TABLE "Publisher" DROP CONSTRAINT IF EXISTS publisher_address_needs_city;
ALTER TABLE "Publisher"
  ADD CONSTRAINT publisher_address_needs_city
  CHECK (("street" IS NULL AND "postalCode" IS NULL) OR "city" IS NOT NULL);

-- 3f. Rezerwacja: data zamknięcia <=> status inny niż PENDING ---------------

ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS reservation_closed_at_matches_status;
ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_closed_at_matches_status
  CHECK (("status" = 'PENDING') = ("closedAt" IS NULL));

ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS reservation_closed_after_created;
ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_closed_after_created
  CHECK ("closedAt" IS NULL OR "closedAt" >= "createdAt");

-- 4. Reguły statusu egzemplarza względem wypożyczeń -------------------------
--   * aktywne wypożyczenie wymaga egzemplarza o statusie AVAILABLE
--     (zagubionego ani konserwowanego nie można wypożyczyć);
--   * egzemplarza z aktywnym wypożyczeniem nie można oznaczyć jako LOST
--     ani MAINTENANCE — najpierw trzeba zarejestrować zwrot.

CREATE OR REPLACE FUNCTION check_copy_loanable() RETURNS trigger AS $$
BEGIN
  IF NEW."returnedAt" IS NULL AND EXISTS (
    SELECT 1 FROM "Copy" c
    WHERE c."id" = NEW."copyId" AND c."status" <> 'AVAILABLE'
  ) THEN
    RAISE EXCEPTION 'Egzemplarz % nie ma statusu AVAILABLE', NEW."copyId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS loan_copy_must_be_available ON "Loan";
CREATE TRIGGER loan_copy_must_be_available
  BEFORE INSERT OR UPDATE OF "copyId", "returnedAt" ON "Loan"
  FOR EACH ROW
  EXECUTE FUNCTION check_copy_loanable();

CREATE OR REPLACE FUNCTION check_copy_status_change() RETURNS trigger AS $$
BEGIN
  IF NEW."status" <> 'AVAILABLE' AND EXISTS (
    SELECT 1 FROM "Loan" l
    WHERE l."copyId" = NEW."id" AND l."returnedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'Egzemplarz % ma aktywne wypożyczenie', NEW."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS copy_status_not_while_loaned ON "Copy";
CREATE TRIGGER copy_status_not_while_loaned
  BEFORE UPDATE OF "status" ON "Copy"
  FOR EACH ROW
  EXECUTE FUNCTION check_copy_status_change();
