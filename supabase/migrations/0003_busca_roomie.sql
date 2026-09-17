-- Cuervo Pass — campo informativo: ¿ya tiene depa y busca compañero de cuarto?
-- No cambia ningún comportamiento todavía; se usará en el matching de roomings
-- (Semana 6/10). Corre esto en el SQL Editor de Supabase, igual que las anteriores.

alter table usuarios add column if not exists busca_roomie boolean default false;
