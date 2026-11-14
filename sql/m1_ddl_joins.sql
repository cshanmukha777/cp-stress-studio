DROP TABLE IF EXISTS problem_notes;

CREATE TABLE problem_notes (
  id         SERIAL PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id),
  note       TEXT NOT NULL,
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
  UNIQUE (problem_id, author_id)
);

ALTER TABLE problem_notes ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE problem_notes ADD CONSTRAINT problem_notes_note_len CHECK (LENGTH(note) <= 500);
ALTER TABLE problem_notes ADD COLUMN reviewer_id INTEGER;
ALTER TABLE problem_notes ADD CONSTRAINT problem_notes_reviewer_fk FOREIGN KEY (reviewer_id) REFERENCES users(id);

INSERT INTO problem_notes (problem_id, author_id, note, rating) VALUES (1, 3, 'Use a hash map', 5);

INSERT INTO problem_notes (problem_id, author_id, note, rating) VALUES (2, 3, 'Bad rating', 9);
INSERT INTO problem_notes (problem_id, author_id, note, rating) VALUES (1, 3, 'Duplicate pair', 4);
INSERT INTO problem_notes (problem_id, author_id, note, rating) VALUES (3, 3, NULL, 4);

SELECT * FROM problem_notes;

DROP TABLE problem_notes;

SELECT u.id, u.email, p.handle, p.display_name
FROM users u
INNER JOIN profiles p ON p.user_id = u.id
ORDER BY u.id;

SELECT u.email
FROM users u
LEFT JOIN problems pr ON pr.created_by_id = u.id
WHERE pr.id IS NULL;

SELECT pr.title, pr.difficulty, p.handle AS author, u.email
FROM problems pr
JOIN users u ON u.id = pr.created_by_id
JOIN profiles p ON p.user_id = u.id
ORDER BY pr.difficulty, pr.id;

SELECT title, difficulty FROM problems WHERE difficulty IN (800, 1000, 1200);

SELECT title FROM problems WHERE title ILIKE '%sum%';

SELECT u.email
FROM users u
WHERE EXISTS (SELECT 1 FROM problems pr WHERE pr.created_by_id = u.id);

SELECT title, difficulty FROM problems ORDER BY difficulty, id LIMIT 3 OFFSET 3;

SELECT
  UPPER(handle)                                      AS handle_upper,
  TRIM(BOTH ' ' FROM '  ' || display_name || '  ')   AS trimmed_name,
  COALESCE(bio, 'No bio yet')                        AS bio,
  NULLIF(language, 'cpp')                            AS non_default_language,
  CONCAT(display_name, ' (@', handle, ')')           AS label
FROM profiles
ORDER BY id;