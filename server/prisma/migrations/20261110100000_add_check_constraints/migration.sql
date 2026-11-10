
ALTER TABLE "problems"
  ADD CONSTRAINT "problems_difficulty_check"
  CHECK ("difficulty" BETWEEN 800 AND 3500);

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_check"
  CHECK ("role" IN ('student', 'admin'));