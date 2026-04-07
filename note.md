**Giai đoạn 3 — Category**

7. Tạo `src/modules/category/` với đầy đủ module, service, controller, dto
8. GET `/categories` — list active với pagination
9. GET `/categories/:slug` — get by slug
10. POST `/categories` — create, admin only
11. PATCH `/categories/:id` — update, admin only
12. DELETE `/categories/:id` — soft delete, admin only

---

**Giai đoạn 4 — Tag**

13. Tạo `src/modules/tag/` với đầy đủ module, service, controller, dto
14. GET `/tags` — list active với pagination
15. GET `/tags/:slug` — get by slug
16. POST `/tags` — create, admin only
17. PATCH `/tags/:id` — update, admin only
18. DELETE `/tags/:id` — soft delete, admin only

---

**Giai đoạn 5 — Quiz**

19. Tạo `src/modules/quiz/` với đầy đủ module, service, controller, dto
20. POST `/quizzes` — tạo quiz + version đầu tiên cùng lúc, creator only
21. GET `/quizzes` — list với filter difficulty, category, tag, pagination
22. GET `/quizzes/:slug` — detail kèm published version + questions
23. PATCH `/quizzes/:id` — update metadata, chỉ creator hoặc admin
24. DELETE `/quizzes/:id` — soft delete, chỉ creator hoặc admin
25. POST `/quizzes/:id/versions` — tạo version mới từ version cũ
26. GET `/quizzes/:id/versions` — list versions
27. POST `/quizzes/:id/versions/:versionId/publish` — publish version, update `published_version_id`
28. POST `/quizzes/:id/versions/:versionId/questions` — thêm câu hỏi kèm answer options

---

**Giai đoạn 6 — Quiz Attempt**

29. Tạo `src/modules/attempt/` với đầy đủ module, service, controller, dto
30. POST `/quizzes/:id/attempts` — tạo attempt mới, check quiz published, check không có attempt đang chạy
31. POST `/attempts/:id/answers` — submit một câu trả lời
32. POST `/attempts/:id/complete` — complete attempt, tính `score_percent`, `correct_count`, `xp_earned`, update `quiz_stats`, update user `xp_total`
33. POST `/attempts/:id/abandon` — abandon attempt
34. GET `/attempts/:id` — get detail kèm answers và kết quả
35. GET `/users/me/attempts` — lịch sử với pagination

---

**Giai đoạn 7 — Bookmark**

36. Tạo `src/modules/bookmark/` với đầy đủ module, service, controller, dto
37. GET `/bookmarks/collections` — list collections của user hiện tại
38. POST `/bookmarks/collections` — tạo collection
39. POST `/bookmarks/collections/:id/quizzes` — bookmark quiz
40. DELETE `/bookmarks/collections/:id/quizzes/:quizId` — bỏ bookmark

---

**Giai đoạn 8 — Quiz Review**

41. Tạo `src/modules/review/` với đầy đủ module, service, controller, dto
42. POST `/quizzes/:id/reviews` — tạo review, check user đã complete attempt chưa
43. GET `/quizzes/:id/reviews` — list với pagination
44. PATCH `/quizzes/:id/reviews` — update review của chính mình
45. DELETE `/quizzes/:id/reviews` — xoá review của chính mình

---

**Giai đoạn 9 — Tournament**

46. Tạo `src/modules/tournament/` với đầy đủ module, service, controller, dto
47. POST `/tournaments` — tạo tournament, admin only
48. GET `/tournaments` — list với filter status, difficulty, category, pagination
49. GET `/tournaments/:id` — detail kèm rounds
50. POST `/tournaments/:id/register` — đăng ký tham gia, check deadline
51. GET `/tournaments/:id/leaderboard` — bảng xếp hạng participants
52. POST `/tournaments/:id/rounds/:roundId/attempts` — bắt đầu làm quiz của round

---

**Giai đoạn 10 — Quiz Instance (Multiplayer)**

53. Cài `@nestjs/websockets` + `socket.io`
54. Tạo `src/modules/instance/` với module, service, controller, gateway, dto
55. POST `/instances` — tạo room, host chọn quiz version
56. POST `/instances/:id/join` — join room
57. POST `/instances/:id/start` — host start, broadcast qua WebSocket
58. POST `/instances/:id/close` — đóng room
59. GET `/instances/:id/leaderboard` — kết quả sau khi close
60. WebSocket events: `player_joined`, `game_started`, `question_revealed`, `answer_submitted`, `leaderboard_updated`, `game_finished`

---

**Lưu ý xuyên suốt:**

Sau mỗi giai đoạn nên test thủ công với Postman trước khi sang giai đoạn tiếp theo. Giai đoạn 6 (Quiz Attempt) là phức tạp nhất về business logic — tính điểm, cộng XP, update stats — nên dành thêm thời gian ở đó.
