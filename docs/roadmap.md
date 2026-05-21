
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
