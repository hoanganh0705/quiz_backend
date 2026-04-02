# 📊 Database Audit – Quiz System

## 🧠 Tổng quan
Database này đã đạt mức **production-ready (junior+)**, có tư duy hệ thống rõ ràng:
- Phân tách bảng hợp lý
- Có tournament, realtime, gamification
- Có index và audit fields

👉 Tuy nhiên vẫn còn một số vấn đề cần fix để tránh bug và scale tốt.

---

# ✅ 1. Những điểm làm tốt

- Tách bảng đúng:
  - `quiz_stats`, `quiz_flags`
- Có:
  - `created_at`, `updated_at`, `deleted_at`
- Many-to-many chuẩn:
  - `quiz_categories`, `quiz_tags`
- Tournament system:
  - `round`, `participant`, `round_participant`
- Bookmark có collection (thiết kế tốt)
- Đã có index phục vụ query thực tế

---

# ❌ 2. Những vấn đề cần fix ngay

## ⚠️ 2.1. Denormalization trong `quiz_attempts`

Các field:
- `quiz_title`
- `category (jsonb)`
- `difficulty`

### ❌ Vấn đề:
- Duplicate dữ liệu từ `quizzes`
- Có thể bị lệch data khi update

### ✅ Giải pháp:
- Nếu dùng để snapshot → giữ
- Nếu không → xoá các field này

---

## ⚠️ 2.2. Thiếu `ON DELETE` behavior

Hiện tại chỉ có FK nhưng không có:
- `ON DELETE CASCADE`
- `ON DELETE SET NULL`

### ❌ Nguy hiểm:
- Xoá quiz → dữ liệu mồ côi

### ✅ Giải pháp:

Cascade:
ON DELETE CASCADE

Set null:
ON DELETE SET NULL

---

## ⚠️ 2.3. `quiz_answer_options.is_correct`

### ❌ Vấn đề:
- Không enforce số lượng đáp án đúng

### ✅ Giải pháp:

Nếu 1 đáp án đúng:
- Dùng `correct_option_id` trong `quiz_questions`

Nếu nhiều đáp án đúng:
- Validate ở app level

---

## ⚠️ 2.4. Thiếu constraint logic

### 🔹 `quiz_questions`
Thiếu:
- `position`

### 🔹 `quiz_attempts`
UNIQUE (user_id, quiz_id, status)  
WHERE status = 'started'

---

## ⚠️ 2.5. `quiz_instance_players.attempt_id`

- Nullable nhưng không rõ lifecycle

---

# 🚀 3. Nâng cấp để lên level PRO

## 🔥 Leaderboard cache

quiz_leaderboard:
- quiz_id
- user_id
- best_score
- best_time

## 🔥 Activity log

user_activities:
- user_id
- type
- metadata
- created_at

## 🔥 Full-text search
- GIN index cho title + description

---

# 🧠 Kết luận

Hiện tại: 8.5 / 10  
Sau khi fix: ~9.2 / 10
