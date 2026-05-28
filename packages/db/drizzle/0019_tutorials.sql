CREATE TABLE "tutorials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"youtube_url" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Seed initial tutorials
INSERT INTO "tutorials" ("title", "description", "youtube_url", "thumbnail_url", "duration_seconds", "sort_order") VALUES
('Como cadastrar novos alunos', 'Aprenda o passo a passo para adicionar alunos, preencher dados e ativar matrículas na sua academia.', 'https://www.youtube.com/watch?v=PLACEHOLDER_1', 'https://img.youtube.com/vi/PLACEHOLDER_1/maxresdefault.jpg', 222, 1),
('Como criar e gerenciar aulas', 'Veja como montar a grade de aulas, definir horários e atribuir instrutores.', 'https://www.youtube.com/watch?v=PLACEHOLDER_2', 'https://img.youtube.com/vi/PLACEHOLDER_2/maxresdefault.jpg', 185, 2),
('Como gerenciar pagamentos', 'Entenda como registrar pagamentos, criar planos e acompanhar o financeiro.', 'https://www.youtube.com/watch?v=PLACEHOLDER_3', 'https://img.youtube.com/vi/PLACEHOLDER_3/maxresdefault.jpg', 310, 3),
('Como promover faixas', 'Saiba como registrar graduações e manter o histórico de faixas dos alunos.', 'https://www.youtube.com/watch?v=PLACEHOLDER_4', 'https://img.youtube.com/vi/PLACEHOLDER_4/maxresdefault.jpg', 148, 4);
