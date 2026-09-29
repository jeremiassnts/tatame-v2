--> Renames the `payment_method` value, it does not replace it: existing rows
--> keep pointing at the same enum member and no data is rewritten. Written by
--> hand because drizzle-kit models an enum change as drop-and-recreate, which
--> would need the column dropped and every row rebuilt for a name.
ALTER TYPE "public"."payment_method" RENAME VALUE 'stripe' TO 'card';
