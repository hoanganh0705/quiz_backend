--
-- PostgreSQL database dump
--

\restrict F5Y4bm2EeOOBLw1Xzs6Q4lWhIkWv5AjOP9Nk3rCOaVtmfvafpvghfmB3Yzwy3m7

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: -
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
2	manual_reset	1785126311801
\.


--
-- Data for Name: __drizzle_migrations__; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.__drizzle_migrations__ (id, hash, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (user_id, username, user_search_vector, email, password_hash, role, is_verified, email_verification_token_hash, email_verification_expires_at, email_verified_at, password_changed_at, current_streak, longest_streak, last_streak_day, settings, created_at, updated_at, deleted_at) FROM stdin;
019fa348-6ad0-719b-a10b-b2ce0d6bfa62	admin_master	\N	admin@quiz.local	$2b$12$ZTmr4LZ8tWiXQlOKq8Ago.suhUPuWcQLuAPHccKSbhg4mFdIL6T2a	admin	t	\N	\N	2026-07-27 11:14:19.682+00	\N	0	0	\N	{}	2026-07-27 11:14:19.682307+00	2026-08-08 07:45:42.975+00	\N
019fa348-6ad0-7471-ad7f-24ded0250994	community_moderator	\N	moderator@quiz.local	$2b$12$P.tJrT16fZOzjdzkP08TjOxmGo/W0SUS9co43uXIJGhpdl19NWjm2	moderator	t	\N	\N	2026-07-27 11:14:19.682+00	\N	0	0	\N	{}	2026-07-27 11:14:19.682307+00	2026-08-08 07:45:42.975+00	\N
019fa348-6ad0-74a4-b97b-be22830008a9	content_author	\N	author@quiz.local	$2b$12$fxcKX6SblJdhU0487qO6WeHUWRIpM/kPH4yr/UdsIthtyk4o.r4ze	user	t	\N	\N	2026-07-27 11:14:19.682+00	\N	0	0	\N	{}	2026-07-27 11:14:19.682307+00	2026-08-08 07:45:42.975+00	\N
019fa348-6ad0-74be-b987-06e3bd247875	learner_user	\N	user@quiz.local	$2b$12$5SPoPaF7jdFbkHP8XZ0LjO8FNliudx9neOP/fn50Jg3tHWkhblVFa	user	t	\N	\N	2026-07-27 11:14:19.682+00	\N	0	0	\N	{}	2026-07-27 11:14:19.682307+00	2026-08-08 07:45:42.975+00	\N
019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	power_user	\N	power_user@quiz.local	$2b$12$y99Qj8c/9rt/scvt2K.HKu6ZouyRikd5Q0KGQ/Zm3CIOqHm4GQP42	user	t	\N	\N	2026-07-27 11:14:19.682+00	\N	0	0	\N	{}	2026-07-27 11:14:19.682307+00	2026-08-08 07:45:42.975+00	\N
019fe055-e22d-76ff-b0e2-20e8bdc86b5d	debugtest	\N	debugtest@quiz.local	$2b$12$P5b7SWT7g2M2oO3ohvpcg.ZbcJVmKhhatix0Q1lnA1Wp1QD137aKa	user	f	34af522a9a77dc9584c1f5a4d06152cd7760e5e1d69689e410124f1973c9cbde	2026-08-08 08:45:52.693+00	\N	\N	0	0	\N	{}	2026-08-08 07:45:52.685253+00	2026-08-08 07:45:52.685253+00	\N
\.


--
-- Data for Name: auth_audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_audit_logs (audit_log_id, user_id, event_type, ip_address, metadata, created_at, expires_at) FROM stdin;
019fa371-5a99-74dc-88b5-031423e5166f	019fa348-6ad0-7471-ad7f-24ded0250994	social.user.unblocked	\N	{"action": "user.unblocked", "domain": "social", "actorId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62", "subjectUserId": "019fa348-6ad0-7471-ad7f-24ded0250994"}	2026-07-27 11:59:02.808+00	2026-10-25 11:59:02.808+00
019fa371-97c2-7bfd-a489-5cd1fb0af910	019fa348-6ad0-7471-ad7f-24ded0250994	social.user.blocked	\N	{"action": "user.blocked", "domain": "social", "reason": null, "actorId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62", "subjectUserId": "019fa348-6ad0-7471-ad7f-24ded0250994"}	2026-07-27 11:59:18.465+00	2026-10-25 11:59:18.465+00
019fa371-d2df-7e86-a529-20662802bacc	019fa348-6ad0-7471-ad7f-24ded0250994	social.user.unblocked	\N	{"action": "user.unblocked", "domain": "social", "actorId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62", "subjectUserId": "019fa348-6ad0-7471-ad7f-24ded0250994"}	2026-07-27 11:59:33.599+00	2026-10-25 11:59:33.599+00
019fa384-6d9d-7e82-a4f3-943063aecfdf	019fa348-6ad0-7471-ad7f-24ded0250994	social.user.unblocked	\N	{"action": "user.unblocked", "domain": "social", "actorId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62", "subjectUserId": "019fa348-6ad0-7471-ad7f-24ded0250994"}	2026-07-27 12:19:52.86+00	2026-10-25 12:19:52.86+00
019fa384-7548-7502-93a2-abab6f912e2a	019fa348-6ad0-7471-ad7f-24ded0250994	social.user.unblocked	\N	{"action": "user.unblocked", "domain": "social", "actorId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62", "subjectUserId": "019fa348-6ad0-7471-ad7f-24ded0250994"}	2026-07-27 12:19:54.823+00	2026-10-25 12:19:54.823+00
019fa428-7f1c-7eb9-99c7-89818448797f	019fa348-6ad0-7471-ad7f-24ded0250994	social.user.blocked	\N	{"action": "user.blocked", "domain": "social", "reason": null, "actorId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62", "subjectUserId": "019fa348-6ad0-7471-ad7f-24ded0250994"}	2026-07-27 15:19:05.243+00	2026-10-25 15:19:05.243+00
\.


--
-- Data for Name: badges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.badges (badge_id, slug, type, category, name, description, icon_url, is_active, is_hidden, version, valid_from, valid_until, evaluation_mode, created_at, updated_at) FROM stdin;
019fa348-6997-762c-9541-61a6c97d8f5e	first-quiz	bronze	quiz	First Steps	Complete your first quiz.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7a23-9d2b-953fa66ddb46	five-quizzes	bronze	quiz	Getting Started	Complete 5 quizzes.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7a54-be65-b1e98ce0e923	ten-quizzes	silver	quiz	Quiz Enthusiast	Complete 10 quizzes.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7a6e-a60c-5fa07a15801a	hundred-quizzes	gold	quiz	Quiz Master	Complete 100 quizzes.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7a85-8f79-6c22cdc8b21b	first-pass	bronze	quiz	Passer	Pass your first quiz on the first attempt.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7a9e-9b67-d23c7241ce88	five-passes	silver	quiz	Consistent Performer	Pass 5 quizzes.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7ab3-87c8-8e1cfea1d163	streak-3	bronze	quiz	On a Roll	Maintain a 3-day learning streak.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7ac9-b8b7-247c64549c11	streak-7	silver	quiz	Week Warrior	Maintain a 7-day learning streak.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7adf-9f80-beacea658c4e	streak-30	gold	quiz	Monthly Champion	Maintain a 30-day learning streak.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7af7-8c80-3bcc2e120e39	xp-100	bronze	quiz	Point Collector	Earn 100 XP total.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7b2b-b526-6f67d251ce08	xp-1000	silver	quiz	XP Master	Earn 1,000 XP total.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7b40-8bf9-87c0c00df94c	xp-5000	gold	quiz	XP Legend	Earn 5,000 XP total.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7b57-9578-5c85537702ba	tournament-win	gold	quiz	Champion	Win a tournament.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7b79-9d74-7bd837746232	tournament-three-wins	platinum	quiz	Tournament Veteran	Win 3 tournaments.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7b92-bed9-d4cd966bd3f0	perfect-score	platinum	quiz	Perfectionist	Get a perfect score on any quiz.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7bae-99f9-9651212234b5	perfect-ten	diamond	quiz	Perfectionist Elite	Get 10 perfect scores.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7bc4-a933-6c171aebb68b	rank-top-100	silver	quiz	Expert	Reach Top 100 globally.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7bda-b4bb-151a02fa246b	rank-top-10	gold	quiz	Elite	Reach Top 10 globally.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7bf0-8d6b-96a234c8294e	rank-1	diamond	quiz	Champion	Reach rank #1 globally.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
019fa348-6997-7c07-81e5-8336c6d89a67	rank-weekly-top-10	gold	quiz	Weekly Champion	Reach Top 10 in weekly rankings.	\N	t	f	1.0.0	\N	\N	immediate	2026-07-27 11:14:19.665719+00	2026-08-08 07:45:42.948+00
\.


--
-- Data for Name: badge_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.badge_rules (rule_id, badge_id, rule_type, priority, config, is_active, created_at) FROM stdin;
019fa348-6999-764b-821c-c22eb216aef9	019fa348-6997-762c-9541-61a6c97d8f5e	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 1}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-7896-ae09-4681d2f8c993	019fa348-6997-7a23-9d2b-953fa66ddb46	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 5}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-78b6-955f-ced390add423	019fa348-6997-7a54-be65-b1e98ce0e923	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 10}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-78c4-92d5-46a797d92975	019fa348-6997-7a6e-a60c-5fa07a15801a	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 100}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-78d3-a09c-5e81366623cd	019fa348-6997-7a85-8f79-6c22cdc8b21b	count	0	{"metric": "quizzes_passed", "operator": ">=", "threshold": 1}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-78df-a3ed-51a42927dea1	019fa348-6997-7a9e-9b67-d23c7241ce88	count	0	{"metric": "quizzes_passed", "operator": ">=", "threshold": 5}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-78ec-878c-c05371c391c8	019fa348-6997-7ab3-87c8-8e1cfea1d163	streak	0	{"metric": "streak_days", "operator": ">=", "threshold": 3}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-78f8-85b9-63d3be20235d	019fa348-6997-7ac9-b8b7-247c64549c11	streak	0	{"metric": "streak_days", "operator": ">=", "threshold": 7}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-7906-b93d-bbc450582d2a	019fa348-6997-7adf-9f80-beacea658c4e	streak	0	{"metric": "streak_days", "operator": ">=", "threshold": 30}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-7913-ac57-4d0c61bb445d	019fa348-6997-7af7-8c80-3bcc2e120e39	xp_total	0	{"metric": "xp_total", "operator": ">=", "threshold": 100}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-7920-9ccd-44858b194a35	019fa348-6997-7b2b-b526-6f67d251ce08	xp_total	0	{"metric": "xp_total", "operator": ">=", "threshold": 1000}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-792d-809b-4a3f8f302d32	019fa348-6997-7b40-8bf9-87c0c00df94c	xp_total	0	{"metric": "xp_total", "operator": ">=", "threshold": 5000}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-793a-8c36-40342f469f18	019fa348-6997-7b57-9578-5c85537702ba	tournament_win	0	{"metric": "tournaments_won", "operator": ">=", "threshold": 1}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-7947-ba77-58950a052e8e	019fa348-6997-7b79-9d74-7bd837746232	tournament_win	0	{"metric": "tournaments_won", "operator": ">=", "threshold": 3}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-7954-b0a8-9c9357aa40b5	019fa348-6997-7b92-bed9-d4cd966bd3f0	perfect_score	0	{"metric": "perfect_scores", "operator": ">=", "threshold": 1}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-7961-86ee-cbac10d598f0	019fa348-6997-7bae-99f9-9651212234b5	perfect_score	0	{"metric": "perfect_scores", "operator": ">=", "threshold": 10}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-796f-baff-5dabcc0c1ea2	019fa348-6997-7bc4-a933-6c171aebb68b	rank	0	{"metric": "global_rank", "operator": "<=", "threshold": 100}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-797c-aece-527784b5a634	019fa348-6997-7bda-b4bb-151a02fa246b	rank	0	{"metric": "global_rank", "operator": "<=", "threshold": 10}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-7989-be62-2c95dee662d4	019fa348-6997-7bf0-8d6b-96a234c8294e	rank	0	{"metric": "global_rank", "operator": "<=", "threshold": 1}	t	2026-07-27 11:14:19.665719+00
019fa348-6999-7996-b7e0-102e305a02f3	019fa348-6997-7c07-81e5-8336c6d89a67	rank_period	0	{"metric": "period_rank", "period": "weekly", "operator": "<=", "threshold": 10}	t	2026-07-27 11:14:19.665719+00
019fe043-31d3-7a08-825b-3d28c72528d4	019fa348-6997-762c-9541-61a6c97d8f5e	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 1}	t	2026-08-08 07:25:27.883268+00
019fe043-31d8-7e60-b201-339ec1c3d6a3	019fa348-6997-7a23-9d2b-953fa66ddb46	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 5}	t	2026-08-08 07:25:27.883268+00
019fe043-31d8-7eca-996c-c2398c8bb02d	019fa348-6997-7a54-be65-b1e98ce0e923	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 10}	t	2026-08-08 07:25:27.883268+00
019fe043-31d8-7f0a-91be-10cb7c8f1e58	019fa348-6997-7a6e-a60c-5fa07a15801a	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 100}	t	2026-08-08 07:25:27.883268+00
019fe043-31d8-7f33-9ff4-9f5d86293166	019fa348-6997-7a85-8f79-6c22cdc8b21b	count	0	{"metric": "quizzes_passed", "operator": ">=", "threshold": 1}	t	2026-08-08 07:25:27.883268+00
019fe043-31d8-7f53-8115-7c2934487df3	019fa348-6997-7a9e-9b67-d23c7241ce88	count	0	{"metric": "quizzes_passed", "operator": ">=", "threshold": 5}	t	2026-08-08 07:25:27.883268+00
019fe043-31d8-7f89-b202-945c5a87d809	019fa348-6997-7ab3-87c8-8e1cfea1d163	streak	0	{"metric": "streak_days", "operator": ">=", "threshold": 3}	t	2026-08-08 07:25:27.883268+00
019fe043-31d8-7fa9-a01a-fad5aea06cf9	019fa348-6997-7ac9-b8b7-247c64549c11	streak	0	{"metric": "streak_days", "operator": ">=", "threshold": 7}	t	2026-08-08 07:25:27.883268+00
019fe043-31d8-7fc9-abbd-98836bb82643	019fa348-6997-7adf-9f80-beacea658c4e	streak	0	{"metric": "streak_days", "operator": ">=", "threshold": 30}	t	2026-08-08 07:25:27.883268+00
019fe043-31d8-7fe7-8102-bc1e98aad5a0	019fa348-6997-7af7-8c80-3bcc2e120e39	xp_total	0	{"metric": "xp_total", "operator": ">=", "threshold": 100}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-7005-9015-91ea489daabd	019fa348-6997-7b2b-b526-6f67d251ce08	xp_total	0	{"metric": "xp_total", "operator": ">=", "threshold": 1000}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-7023-9fb7-4daf38c43cf1	019fa348-6997-7b40-8bf9-87c0c00df94c	xp_total	0	{"metric": "xp_total", "operator": ">=", "threshold": 5000}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-7048-b01d-172e5e9e25e9	019fa348-6997-7b57-9578-5c85537702ba	tournament_win	0	{"metric": "tournaments_won", "operator": ">=", "threshold": 1}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-7067-978d-94d7f060fe67	019fa348-6997-7b79-9d74-7bd837746232	tournament_win	0	{"metric": "tournaments_won", "operator": ">=", "threshold": 3}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-7085-a7c0-b4d09d1a51de	019fa348-6997-7b92-bed9-d4cd966bd3f0	perfect_score	0	{"metric": "perfect_scores", "operator": ">=", "threshold": 1}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-70b9-9afd-0bd7d822c54a	019fa348-6997-7bae-99f9-9651212234b5	perfect_score	0	{"metric": "perfect_scores", "operator": ">=", "threshold": 10}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-70d8-b73f-e534cff9503c	019fa348-6997-7bc4-a933-6c171aebb68b	rank	0	{"metric": "global_rank", "operator": "<=", "threshold": 100}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-70f7-b518-ffd82a5c1338	019fa348-6997-7bda-b4bb-151a02fa246b	rank	0	{"metric": "global_rank", "operator": "<=", "threshold": 10}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-7115-be4d-f4ee24acd6b0	019fa348-6997-7bf0-8d6b-96a234c8294e	rank	0	{"metric": "global_rank", "operator": "<=", "threshold": 1}	t	2026-08-08 07:25:27.883268+00
019fe043-31d9-7133-b54b-0ab229f25e0c	019fa348-6997-7c07-81e5-8336c6d89a67	rank_period	0	{"metric": "period_rank", "period": "weekly", "operator": "<=", "threshold": 10}	t	2026-08-08 07:25:27.883268+00
019fe055-bc38-70f0-b4b0-81a4793e96b6	019fa348-6997-762c-9541-61a6c97d8f5e	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 1}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-7352-b270-d339c61d0f7c	019fa348-6997-7a23-9d2b-953fa66ddb46	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 5}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-738e-a119-109f70cb91ed	019fa348-6997-7a54-be65-b1e98ce0e923	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 10}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-73ca-bb23-83119c030936	019fa348-6997-7a6e-a60c-5fa07a15801a	count	0	{"metric": "quizzes_completed", "operator": ">=", "threshold": 100}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-73ec-b937-837dd523db65	019fa348-6997-7a85-8f79-6c22cdc8b21b	count	0	{"metric": "quizzes_passed", "operator": ">=", "threshold": 1}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-740b-8ba1-cc28a9b45d8a	019fa348-6997-7a9e-9b67-d23c7241ce88	count	0	{"metric": "quizzes_passed", "operator": ">=", "threshold": 5}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-7430-8ca4-af8114f8bf9e	019fa348-6997-7ab3-87c8-8e1cfea1d163	streak	0	{"metric": "streak_days", "operator": ">=", "threshold": 3}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-744f-b6eb-74ce180a02cf	019fa348-6997-7ac9-b8b7-247c64549c11	streak	0	{"metric": "streak_days", "operator": ">=", "threshold": 7}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-746e-b321-5f4d23b95767	019fa348-6997-7adf-9f80-beacea658c4e	streak	0	{"metric": "streak_days", "operator": ">=", "threshold": 30}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-74a5-a638-27c2c6229ebd	019fa348-6997-7af7-8c80-3bcc2e120e39	xp_total	0	{"metric": "xp_total", "operator": ">=", "threshold": 100}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-74c5-9f20-31769be36075	019fa348-6997-7b2b-b526-6f67d251ce08	xp_total	0	{"metric": "xp_total", "operator": ">=", "threshold": 1000}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-74e4-96a3-a589521767d1	019fa348-6997-7b40-8bf9-87c0c00df94c	xp_total	0	{"metric": "xp_total", "operator": ">=", "threshold": 5000}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-76fc-94fa-b2253cc0398a	019fa348-6997-7b57-9578-5c85537702ba	tournament_win	0	{"metric": "tournaments_won", "operator": ">=", "threshold": 1}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-772b-887c-b15874a23592	019fa348-6997-7b79-9d74-7bd837746232	tournament_win	0	{"metric": "tournaments_won", "operator": ">=", "threshold": 3}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-7751-bdae-d43aa6df58ee	019fa348-6997-7b92-bed9-d4cd966bd3f0	perfect_score	0	{"metric": "perfect_scores", "operator": ">=", "threshold": 1}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-7771-86f2-eee5cfb6293e	019fa348-6997-7bae-99f9-9651212234b5	perfect_score	0	{"metric": "perfect_scores", "operator": ">=", "threshold": 10}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-7790-b022-acc5ab2be76e	019fa348-6997-7bc4-a933-6c171aebb68b	rank	0	{"metric": "global_rank", "operator": "<=", "threshold": 100}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-77ae-8a1b-612d32280439	019fa348-6997-7bda-b4bb-151a02fa246b	rank	0	{"metric": "global_rank", "operator": "<=", "threshold": 10}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-77cc-8794-183cd0dd3d7c	019fa348-6997-7bf0-8d6b-96a234c8294e	rank	0	{"metric": "global_rank", "operator": "<=", "threshold": 1}	t	2026-08-08 07:45:42.959984+00
019fe055-bc38-77ea-81f7-fd96f2ee9b98	019fa348-6997-7c07-81e5-8336c6d89a67	rank_period	0	{"metric": "period_rank", "period": "weekly", "operator": "<=", "threshold": 10}	t	2026-08-08 07:45:42.959984+00
\.


--
-- Data for Name: blocked_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.blocked_users (block_id, blocker_id, blocked_id, reason, created_at, deleted_at) FROM stdin;
019fa371-97b8-7c6a-8996-70d0b495def4	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	019fa348-6ad0-7471-ad7f-24ded0250994	\N	2026-07-27 11:59:18.456611+00	2026-07-27 12:19:54.815+00
019fa428-7f12-7994-a04d-89a916b7bcb3	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	019fa348-6ad0-7471-ad7f-24ded0250994	\N	2026-07-27 15:19:05.234136+00	\N
\.


--
-- Data for Name: bookmark_collections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bookmark_collections (collection_id, user_id, name, description, created_at, updated_at) FROM stdin;
019fa348-6b86-73c8-ab2b-e0500569ce69	019fa348-6ad0-74be-b987-06e3bd247875	Favorites	My favorite quizzes to revisit.	2026-07-27 11:14:20.164+00	2026-08-08 07:25:27.969+00
019fa348-6b89-7ef3-8499-aef82703c8cf	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	Study Plan	Quizzes to complete this month.	2026-07-27 11:14:20.164+00	2026-08-08 07:25:27.969+00
019fa348-6b8b-7a6c-be1a-5a3dcc690984	019fa348-6ad0-74be-b987-06e3bd247875	Work Progress	Tracking my learning journey.	2026-07-27 11:14:20.164+00	2026-08-08 07:25:27.969+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (category_id, name, description, slug, image_url, created_at, updated_at, deleted_at) FROM stdin;
019fa348-6adb-70f7-8c16-b2231636acfd	Science	Physics, chemistry, biology and scientific discoveries.	science	https://images.unsplash.com/photo-1532094349884-543bc11b234d	2026-07-27 11:14:19.993313+00	2026-08-08 07:45:42.981+00	\N
019fa348-6adb-7275-8b8b-ec089b551f80	History	World history, major events, timelines, and civilizations.	history	https://images.unsplash.com/photo-1461360370896-922624d12aa1	2026-07-27 11:14:19.993313+00	2026-08-08 07:45:42.981+00	\N
019fa348-6adb-729f-9a17-63dee6b94b00	Geography	Countries, capitals, landscapes, and geographical facts.	geography	https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1	2026-07-27 11:14:19.993313+00	2026-08-08 07:45:42.981+00	\N
019fa348-6adb-72b6-b34a-e1bae0b50adf	Technology	Computing, software, internet, and modern innovations.	technology	https://images.unsplash.com/photo-1518773553398-650c184e0bb3	2026-07-27 11:14:19.993313+00	2026-08-08 07:45:42.981+00	\N
019fa348-6adb-72c9-83f2-263f1ce110ab	Mathematics	Algebra, geometry, calculus, and logical reasoning.	mathematics	https://images.unsplash.com/photo-1509228468518-180dd4864904	2026-07-27 11:14:19.993313+00	2026-08-08 07:45:42.981+00	\N
019fa348-6adb-72db-9913-618c3d961e68	Sports	Rules, players, records, and major sporting events.	sports	https://images.unsplash.com/photo-1461896836934-ffe607ba8211	2026-07-27 11:14:19.993313+00	2026-08-08 07:45:42.981+00	\N
\.


--
-- Data for Name: quiz_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_versions (quiz_version_id, quiz_id, version_number, status, difficulty, duration_ms, passing_score_percent, reward_xp, created_by_user_id, created_at, published_at, archived_at, updated_at) FROM stdin;
019fa348-6af8-7015-bca5-2a489b454074	019fa348-6ae4-766a-a332-b67cac1ced82	1	published	easy	600000	60	100	019fa348-6ad0-74a4-b97b-be22830008a9	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00	\N	2026-07-27 11:14:20.001+00
019fa348-6b1a-7a73-9a47-285cffee29cb	019fa348-6b10-7f21-b3b0-9f7d972f5402	1	archived	medium	900000	70	200	019fa348-6ad0-74a4-b97b-be22830008a9	2026-07-27 11:14:20.001+00	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b2f-7486-ab87-018005465330	019fa348-6b10-7f21-b3b0-9f7d972f5402	2	published	medium	1200000	65	250	019fa348-6ad0-74a4-b97b-be22830008a9	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00	\N	2026-07-27 11:14:20.001+00
019fa348-6b4a-7045-a892-e7c17c95b9ed	019fa348-6b10-7f21-b3b0-9f7d972f5402	3	draft	hard	1500000	70	300	019fa348-6ad0-74a4-b97b-be22830008a9	2026-07-27 11:14:20.001+00	\N	\N	2026-07-27 11:14:20.001+00
019fa348-6b55-70ef-846b-a302559372bb	019fa348-6b54-718b-a9e0-69ab2ee3852c	1	draft	easy	600000	60	100	019fa348-6ad0-74a4-b97b-be22830008a9	2026-07-27 11:14:20.001+00	\N	\N	2026-07-27 11:14:20.001+00
019fa348-6b5b-74b4-9358-2faabfc3971d	019fa348-6b59-74dc-b21e-1cbe787b2cc3	1	published	hard	1800000	75	500	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00	\N	2026-07-27 11:14:20.001+00
\.


--
-- Data for Name: quizzes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quizzes (quiz_id, creator_id, title, description, slug, requirements, image_url, is_featured, is_hidden, is_verified, created_at, updated_at, deleted_at, published_version_id, category_id) FROM stdin;
019fa348-6b54-718b-a9e0-69ab2ee3852c	019fa348-6ad0-74a4-b97b-be22830008a9	Data Structures Primer	Introduction to fundamental data structures.	data-structures-primer	\N	\N	f	f	f	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00	\N	\N	\N
019fa348-6ae4-766a-a332-b67cac1ced82	019fa348-6ad0-74a4-b97b-be22830008a9	JavaScript Fundamentals	Test your knowledge of core JavaScript concepts.	javascript-fundamentals	\N	\N	t	f	f	2026-07-27 11:14:20.001+00	2026-08-08 07:25:27.918+00	\N	019fa348-6af8-7015-bca5-2a489b454074	019fa348-6adb-72b6-b34a-e1bae0b50adf
019fa348-6b10-7f21-b3b0-9f7d972f5402	019fa348-6ad0-74a4-b97b-be22830008a9	System Design Essentials	Design scalable distributed systems.	system-design-v2	\N	\N	f	f	f	2026-07-27 11:14:20.001+00	2026-08-08 07:25:27.918+00	\N	019fa348-6b2f-7486-ab87-018005465330	019fa348-6adb-72b6-b34a-e1bae0b50adf
019fa348-6b59-74dc-b21e-1cbe787b2cc3	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	Advanced Algorithms	Deep dive into complex algorithmic problems.	algorithms-advanced	\N	\N	f	f	f	2026-07-27 11:14:20.001+00	2026-08-08 07:25:27.918+00	\N	019fa348-6b5b-74b4-9358-2faabfc3971d	019fa348-6adb-72c9-83f2-263f1ce110ab
\.


--
-- Data for Name: bookmarked_quizzes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bookmarked_quizzes (bookmark_id, collection_id, quiz_id, bookmarked_at, notes, updated_at) FROM stdin;
019fa348-6b88-7cef-b411-9e053e981dd2	019fa348-6b86-73c8-ab2b-e0500569ce69	019fa348-6ae4-766a-a332-b67cac1ced82	2026-07-27 11:14:20.164+00	\N	2026-07-27 11:14:20.164+00
019fa348-6b89-778b-9f38-c7a1dc632c02	019fa348-6b86-73c8-ab2b-e0500569ce69	019fa348-6b10-7f21-b3b0-9f7d972f5402	2026-07-27 11:14:20.164+00	\N	2026-07-27 11:14:20.164+00
019fa348-6b8a-7587-9818-90e7bfc41ab8	019fa348-6b89-7ef3-8499-aef82703c8cf	019fa348-6b59-74dc-b21e-1cbe787b2cc3	2026-07-27 11:14:20.164+00	\N	2026-07-27 11:14:20.164+00
019fa348-6b8a-7c51-bab1-146e8750126b	019fa348-6b89-7ef3-8499-aef82703c8cf	019fa348-6b10-7f21-b3b0-9f7d972f5402	2026-07-27 11:14:20.164+00	\N	2026-07-27 11:14:20.164+00
019fa348-6b8b-740b-923d-877851bccce9	019fa348-6b89-7ef3-8499-aef82703c8cf	019fa348-6ae4-766a-a332-b67cac1ced82	2026-07-27 11:14:20.164+00	\N	2026-07-27 11:14:20.164+00
019fa348-6b8c-7061-9cda-30655d421c37	019fa348-6b8b-7a6c-be1a-5a3dcc690984	019fa348-6ae4-766a-a332-b67cac1ced82	2026-07-27 11:14:20.164+00	\N	2026-07-27 11:14:20.164+00
\.


--
-- Data for Name: category_follows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.category_follows (follow_id, user_id, category_id, created_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: comment_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comment_reports (report_id, reporter_id, comment_id, reason, details, status, reviewed_by_user_id, reviewed_at, action_taken, created_at, updated_at) FROM stdin;
019fa348-6b83-7052-b560-6e0ded8a0327	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	22222222-2222-7222-8222-222222222223	spam	\N	dismissed	019fa348-6ad0-7471-ad7f-24ded0250994	2026-07-27 11:14:20.159+00	f	2026-07-27 11:14:20.159+00	2026-07-27 11:14:20.159+00
\.


--
-- Data for Name: comment_votes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comment_votes (vote_id, user_id, comment_id, value, created_at, updated_at) FROM stdin;
019fa348-6b80-7d61-bf32-dbd114ea220d	019fa348-6ad0-74be-b987-06e3bd247875	11111111-1111-7111-8111-111111111112	upvote	2026-07-27 11:14:20.159+00	2026-07-27 11:14:20.159+00
019fa348-6b82-78d8-adde-5b4f634ddf94	019fa348-6ad0-74be-b987-06e3bd247875	22222222-2222-7222-8222-222222222223	upvote	2026-07-27 11:14:20.159+00	2026-07-27 11:14:20.159+00
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comments (comment_id, quiz_id, author_id, parent_comment_id, body, is_hidden, hidden_by_id, hidden_at, votes_count, upvotes_count, downvotes_count, replies_count, created_at, updated_at, deleted_at) FROM stdin;
11111111-1111-7111-8111-111111111112	019fa348-6ae4-766a-a332-b67cac1ced82	019fa348-6ad0-74a4-b97b-be22830008a9	\N	It is a long-standing JavaScript bug from the earliest implementation. You still see it today for compatibility reasons, so the practical takeaway is to avoid using `typeof` alone when you need to detect `null`.	f	\N	\N	1	1	0	1	2026-07-27 11:14:20.159+00	2026-07-27 11:14:20.159+00	\N
11111111-1111-7111-8111-111111111113	019fa348-6ae4-766a-a332-b67cac1ced82	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	11111111-1111-7111-8111-111111111112	A safer check is `value === null`, and for arrays use `Array.isArray(value)` instead of relying on `typeof`.	f	\N	\N	0	0	0	0	2026-07-27 11:14:20.159+00	2026-07-27 11:14:20.159+00	\N
22222222-2222-7222-8222-222222222223	019fa348-6b10-7f21-b3b0-9f7d972f5402	019fa348-6ad0-74a4-b97b-be22830008a9	\N	A reverse proxy sits in front of servers and can provide caching, TLS termination, and routing. Load balancing is one capability it may provide, but not every reverse proxy setup is primarily about balancing traffic.	f	\N	\N	1	1	0	0	2026-07-27 11:14:20.159+00	2026-07-27 11:14:20.159+00	\N
\.


--
-- Data for Name: friendships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.friendships (friendship_id, requester_id, addressee_id, status, created_at, updated_at, deleted_at) FROM stdin;
019fa352-3fc9-786c-9dbe-1d4cdaee7a83	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	019fa348-6ad0-7471-ad7f-24ded0250994	pending	2026-07-27 11:25:04.329427+00	2026-07-27 11:25:04.329427+00	\N
\.


--
-- Data for Name: idempotency_keys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.idempotency_keys (key, user_id, operation, response, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_preferences (preferences_id, user_id, in_app_enabled, email_enabled, push_enabled, achievement_enabled, tournament_enabled, rank_enabled, friend_enabled, comment_enabled, summary_enabled, marketing_enabled, rank_improvement_threshold, quiet_hours_start, quiet_hours_end, updated_at, created_at) FROM stdin;
019fa348-6b71-7fce-991b-3b6594b919f2	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	t	t	t	t	t	t	t	t	t	f	1	\N	\N	2026-08-08 07:25:27.955+00	2026-07-27 11:14:20.144+00
019fa348-6b72-7d95-8dca-a08bcb42513d	019fa348-6ad0-74be-b987-06e3bd247875	t	t	f	t	t	t	t	t	t	f	3	22:00	07:00	2026-08-08 07:25:27.955+00	2026-07-27 11:14:20.144+00
019fa348-6b73-769c-bcda-45657b9123c9	019fa348-6ad0-74a4-b97b-be22830008a9	t	t	f	t	f	t	t	t	t	f	5	23:00	06:30	2026-08-08 07:25:27.955+00	2026-07-27 11:14:20.144+00
019fa348-6b73-7f89-b365-8daed9715d3b	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	t	t	t	t	t	t	t	t	t	f	5	\N	\N	2026-08-08 07:25:27.955+00	2026-07-27 11:14:20.144+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (notification_id, user_id, type, title, message, metadata, channel, is_read, read_at, expires_at, created_at, deleted_at) FROM stdin;
61111111-1111-7111-8111-111111111111	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	rank_achievement	You are #1!	You climbed to rank #1 on the global leaderboard. Keep the momentum going.	{"rank": 1, "period": "all_time"}	in_app	f	\N	\N	2026-06-30 10:05:00+00	\N
61111111-1111-7111-8111-111111111112	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	badge_unlocked	Badge Unlocked	You unlocked the "Champion" badge for reaching rank #1 globally.	{"badgeName": "Champion", "badgeSlug": "rank-1"}	in_app	t	2026-06-30 10:10:00+00	\N	2026-06-30 10:06:00+00	\N
62222222-2222-7222-8222-222222222221	019fa348-6ad0-74be-b987-06e3bd247875	comment_reply	New Reply On Your Thread	Someone replied to your comment on `typeof null`.	{"threadId": "11111111-1111-7111-8111-111111111111", "commentId": "11111111-1111-7111-8111-111111111112"}	in_app	f	\N	\N	2026-06-30 09:00:00+00	\N
62222222-2222-7222-8222-222222222222	019fa348-6ad0-74be-b987-06e3bd247875	achievement_earned	New Achievement Earned	You earned the "Point Collector" badge for reaching 100 XP.	{"xpTotal": 100, "badgeSlug": "xp-100"}	in_app	t	2026-06-29 09:00:00+00	\N	2026-06-29 08:35:00+00	\N
63333333-3333-7333-8333-333333333331	019fa348-6ad0-74a4-b97b-be22830008a9	quiz_review_received	Your Quiz Got A New Review	A learner left a 5-star review on "JavaScript Fundamentals".	{"rating": 5, "quizSlug": "javascript-fundamentals"}	in_app	f	\N	\N	2026-06-29 12:00:00+00	\N
019fa352-3fd6-7917-9f87-123cac2663fb	019fa348-6ad0-7471-ad7f-24ded0250994	friend_request	New Friend Request	 sent you a friend request	{"requesterId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62", "friendshipId": "019fa352-3fc9-786c-9dbe-1d4cdaee7a83", "requesterUsername": ""}	in_app	f	\N	\N	2026-07-27 11:25:04.342314+00	\N
019fa36d-971d-7411-b7bb-cc56ab6868bb	019fa348-6ad0-7471-ad7f-24ded0250994	friend_request	Friend Request Cancelled	A friend request sent to you was cancelled	{"friendshipId": "019fa352-3fc9-786c-9dbe-1d4cdaee7a83"}	in_app	f	\N	\N	2026-07-27 11:54:56.157141+00	\N
019fa36e-9efe-70f8-b719-cf41632a3bb6	019fa348-6ad0-7471-ad7f-24ded0250994	friend_accepted	Friend Removed	A friend removed you from their friends list	{"userId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62"}	in_app	f	\N	\N	2026-07-27 11:56:03.709867+00	\N
019fa36f-3516-7165-8089-f26127240ae3	019fa348-6ad0-7471-ad7f-24ded0250994	friend_accepted	Friend Removed	A friend removed you from their friends list	{"userId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62"}	in_app	f	\N	\N	2026-07-27 11:56:42.133825+00	\N
019fa371-5a9e-739c-a161-2a9b6c6b84fd	019fa348-6ad0-7471-ad7f-24ded0250994	friend_request	You Have Been Unblocked	You have been unblocked by a user	{"blockerId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62"}	in_app	f	\N	\N	2026-07-27 11:59:02.813988+00	\N
019fa371-97d9-7168-8510-eaf3e26f7d6c	019fa348-6ad0-7471-ad7f-24ded0250994	friend_request	You Have Been Blocked	You have been blocked by a user	{"reason": null, "blockerId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62"}	in_app	f	\N	\N	2026-07-27 11:59:18.488569+00	\N
019fa371-d2e4-7cdd-8878-78caa06b459c	019fa348-6ad0-7471-ad7f-24ded0250994	friend_request	You Have Been Unblocked	You have been unblocked by a user	{"blockerId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62"}	in_app	f	\N	\N	2026-07-27 11:59:33.604597+00	\N
019fa372-cfef-7044-b41c-ce4f071872d5	019fa348-6ad0-7471-ad7f-24ded0250994	followed	New Follower	admin_master started following you	{"followerUsername": "admin_master"}	in_app	f	\N	\N	2026-07-27 12:00:38.38276+00	\N
019fa373-2af7-7c10-8ea1-2a16b0daca6f	019fa348-6ad0-7471-ad7f-24ded0250994	followed	Follower Removed	admin_master unfollowed you	{"unfollowerUsername": "admin_master"}	in_app	f	\N	\N	2026-07-27 12:01:01.687557+00	\N
019fa373-3a39-744f-847a-a3750562ebbb	019fa348-6ad0-7471-ad7f-24ded0250994	followed	New Follower	admin_master started following you	{"followerUsername": "admin_master"}	in_app	f	\N	\N	2026-07-27 12:01:05.593004+00	\N
019fa373-40b5-7992-8e25-4c838211aaaa	019fa348-6ad0-7471-ad7f-24ded0250994	followed	Follower Removed	admin_master unfollowed you	{"unfollowerUsername": "admin_master"}	in_app	f	\N	\N	2026-07-27 12:01:07.253403+00	\N
019fa384-6daa-708f-acbb-4534be5a3a88	019fa348-6ad0-7471-ad7f-24ded0250994	friend_request	You Have Been Unblocked	You have been unblocked by a user	{"blockerId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62"}	in_app	f	\N	\N	2026-07-27 12:19:52.873477+00	\N
019fa384-754b-7685-8787-9ff7c3602889	019fa348-6ad0-7471-ad7f-24ded0250994	friend_request	You Have Been Unblocked	You have been unblocked by a user	{"blockerId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62"}	in_app	f	\N	\N	2026-07-27 12:19:54.827275+00	\N
019fa384-7d43-7c8b-9396-2acecef288ed	019fa348-6ad0-7471-ad7f-24ded0250994	followed	New Follower	admin_master started following you	{"followerUsername": "admin_master"}	in_app	f	\N	\N	2026-07-27 12:19:56.86762+00	\N
019fa427-bc3a-72fa-a65f-a717d70e9674	019fa348-6ad0-7471-ad7f-24ded0250994	followed	New Follower	admin_master started following you	{"followerUsername": "admin_master"}	in_app	f	\N	\N	2026-07-27 15:18:15.353918+00	\N
019fa427-d565-7c2f-9ce5-1593bffc1cc1	019fa348-6ad0-7471-ad7f-24ded0250994	followed	New Follower	admin_master started following you	{"followerUsername": "admin_master"}	in_app	f	\N	\N	2026-07-27 15:18:21.797593+00	\N
019fa427-e955-7d34-823d-63346a71dcda	019fa348-6ad0-7471-ad7f-24ded0250994	followed	Follower Removed	undefined unfollowed you	{}	in_app	f	\N	\N	2026-07-27 15:18:26.901681+00	\N
019fa428-7f21-78ac-b41f-24a6121fa296	019fa348-6ad0-7471-ad7f-24ded0250994	friend_request	You Have Been Blocked	You have been blocked by a user	{"reason": null, "blockerId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62"}	in_app	f	\N	\N	2026-07-27 15:19:05.249153+00	\N
\.


--
-- Data for Name: oauth_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.oauth_accounts (oauth_account_id, user_id, provider, provider_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: outbox_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.outbox_events (event_id, aggregate_type, event_type, payload, created_at, processed_at, attempt_count, last_attempt_at, next_attempt_at, last_error, idempotency_key, failed_at, dlq_reason, correlation_id) FROM stdin;
\.


--
-- Data for Name: password_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_history (history_id, user_id, password_hash, created_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (password_reset_token_id, user_id, token_hash, expires_at, used_at, created_at, revoked_at, is_active) FROM stdin;
\.


--
-- Data for Name: quiz_questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_questions (question_id, quiz_version_id, "position", question_text, image_url, created_at, updated_at) FROM stdin;
019fa348-6afb-74be-8322-8734d723faaf	019fa348-6af8-7015-bca5-2a489b454074	1	Which keyword is used to declare a variable in JavaScript?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b00-76e1-9865-a9dff2cf8461	019fa348-6af8-7015-bca5-2a489b454074	2	What will console.log(typeof null) output?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b03-790c-8ac6-549b692fe0e3	019fa348-6af8-7015-bca5-2a489b454074	3	Which method adds an element to the end of an array?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b06-74a4-bcac-1dd80aaf6d65	019fa348-6af8-7015-bca5-2a489b454074	4	What does the === operator check for?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b09-7343-bf41-f83c06857a1d	019fa348-6af8-7015-bca5-2a489b454074	5	Which built-in method combines two arrays?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b1b-7efe-a924-27ec6a137c68	019fa348-6b1a-7a73-9a47-285cffee29cb	1	What does CAP theorem stand for?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b1e-7763-8828-0c5cbf74983b	019fa348-6b1a-7a73-9a47-285cffee29cb	2	Which caching strategy writes data to the cache and the database simultaneously?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b24-706a-a20d-65c97bf574ad	019fa348-6b1a-7a73-9a47-285cffee29cb	3	What is the primary purpose of a message queue in a distributed system?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b28-7d6f-83f6-67dede519a02	019fa348-6b1a-7a73-9a47-285cffee29cb	4	Which database type is best suited for hierarchical data?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b2b-78bd-8b75-ef739ee21cad	019fa348-6b1a-7a73-9a47-285cffee29cb	5	What does horizontal scaling mean?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b30-7801-9209-3eab1d78c0e9	019fa348-6b2f-7486-ab87-018005465330	1	In CAP theorem, during a network partition, you must choose between:	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b33-7556-a899-e400c07b3e79	019fa348-6b2f-7486-ab87-018005465330	2	Which load balancing algorithm routes requests to the server with the fewest active connections?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b38-78e7-8733-be7213bfd581	019fa348-6b2f-7486-ab87-018005465330	3	What is eventual consistency?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b3e-73fd-ae3e-bc5c65a08984	019fa348-6b2f-7486-ab87-018005465330	4	Which pattern is used to handle repeated requests for the same data?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b42-78c8-9eac-c5469fc43575	019fa348-6b2f-7486-ab87-018005465330	5	What does a reverse proxy provide that a forward proxy does not?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b44-7d2c-a4a9-b166b4313e06	019fa348-6b2f-7486-ab87-018005465330	6	Which consistency model guarantees that a read always returns the most recent write?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b4b-72ef-83c5-fdd2a829ab3f	019fa348-6b4a-7045-a892-e7c17c95b9ed	1	What is a benefit of the CQRS pattern?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b4d-7a7c-a3ca-cd7e1d1e8710	019fa348-6b4a-7045-a892-e7c17c95b9ed	2	Which technique reduces database load by serving pre-computed query results?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b50-706a-897a-3e204b355f89	019fa348-6b4a-7045-a892-e7c17c95b9ed	3	What is the primary advantage of a content delivery network (CDN)?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b55-76c7-a0f9-bf45ffffaa3a	019fa348-6b55-70ef-846b-a302559372bb	1	What is the time complexity of accessing an element in an array by index?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b56-7088-9d32-06005531802f	019fa348-6b55-70ef-846b-a302559372bb	2	Which data structure uses LIFO (Last In, First Out) ordering?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b56-78b9-8675-f3a45217bd52	019fa348-6b55-70ef-846b-a302559372bb	3	What is the worst-case time complexity of searching in a binary search tree?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b57-7269-b8e7-59f96451499d	019fa348-6b55-70ef-846b-a302559372bb	4	Which hash collision resolution technique chains entries in linked lists?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b5b-77df-a424-16555a5a5611	019fa348-6b5b-74b4-9358-2faabfc3971d	1	What is the time complexity of merge sort in the average case?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b5b-7e28-b8dc-6d815e00428b	019fa348-6b5b-74b4-9358-2faabfc3971d	2	Which algorithm finds the shortest path in a weighted graph with non-negative edges?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b5c-7424-8a10-2db1f2fd0b92	019fa348-6b5b-74b4-9358-2faabfc3971d	3	What is the space complexity of a recursive implementation of merge sort?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b5c-79da-b1a1-9a3b8921e242	019fa348-6b5b-74b4-9358-2faabfc3971d	4	In the context of dynamic programming, what does "optimal substructure" mean?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b5c-7fea-beef-1b628b80d121	019fa348-6b5b-74b4-9358-2faabfc3971d	5	Which technique transforms a recursive solution into an iterative one using a stack?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
019fa348-6b5d-7771-a3b9-e6fd54dff65b	019fa348-6b5b-74b4-9358-2faabfc3971d	6	What is the time complexity of binary search on a sorted array?	\N	2026-07-27 11:14:20.001+00	2026-07-27 11:14:20.001+00
\.


--
-- Data for Name: quiz_answer_options; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_answer_options (option_id, question_id, "position", value, is_correct, created_at) FROM stdin;
019fa348-6afe-7666-a775-ea35478e892e	019fa348-6afb-74be-8322-8734d723faaf	1	var	f	2026-07-27 11:14:20.001+00
019fa348-6afe-7d47-a70f-2d7810795eb3	019fa348-6afb-74be-8322-8734d723faaf	2	let	t	2026-07-27 11:14:20.001+00
019fa348-6afe-7e83-8be4-38415fda2d72	019fa348-6afb-74be-8322-8734d723faaf	3	const	f	2026-07-27 11:14:20.001+00
019fa348-6afe-7ec5-b4d6-107b2abdefd0	019fa348-6afb-74be-8322-8734d723faaf	4	Both let and const	f	2026-07-27 11:14:20.001+00
019fa348-6b02-7088-91d7-ec3889415d97	019fa348-6b00-76e1-9865-a9dff2cf8461	1	"null"	f	2026-07-27 11:14:20.001+00
019fa348-6b02-727d-96db-8bd35af0f0dd	019fa348-6b00-76e1-9865-a9dff2cf8461	2	"undefined"	f	2026-07-27 11:14:20.001+00
019fa348-6b02-7308-91d9-9e21ae11788d	019fa348-6b00-76e1-9865-a9dff2cf8461	3	"object"	t	2026-07-27 11:14:20.001+00
019fa348-6b02-738f-b358-0cd03808b090	019fa348-6b00-76e1-9865-a9dff2cf8461	4	"number"	f	2026-07-27 11:14:20.001+00
019fa348-6b05-71a6-9907-3b4980f4b340	019fa348-6b03-790c-8ac6-549b692fe0e3	1	unshift()	f	2026-07-27 11:14:20.001+00
019fa348-6b05-72e3-8af1-14bf84c92736	019fa348-6b03-790c-8ac6-549b692fe0e3	2	push()	t	2026-07-27 11:14:20.001+00
019fa348-6b05-733f-aa64-c4b381af8640	019fa348-6b03-790c-8ac6-549b692fe0e3	3	pop()	f	2026-07-27 11:14:20.001+00
019fa348-6b05-737a-87f2-1abf6f22d686	019fa348-6b03-790c-8ac6-549b692fe0e3	4	shift()	f	2026-07-27 11:14:20.001+00
019fa348-6b07-7e0e-980e-01965dccdddc	019fa348-6b06-74a4-bcac-1dd80aaf6d65	1	Value equality only	f	2026-07-27 11:14:20.001+00
019fa348-6b08-7004-9d7d-8e9961ffcbc3	019fa348-6b06-74a4-bcac-1dd80aaf6d65	2	Reference equality only	f	2026-07-27 11:14:20.001+00
019fa348-6b08-7086-b298-83f04c4c34f3	019fa348-6b06-74a4-bcac-1dd80aaf6d65	3	Value and type equality	t	2026-07-27 11:14:20.001+00
019fa348-6b08-70fc-9ab5-65f425ccdcbc	019fa348-6b06-74a4-bcac-1dd80aaf6d65	4	None of the above	f	2026-07-27 11:14:20.001+00
019fa348-6b0a-79e5-a34c-aa2c09addf4d	019fa348-6b09-7343-bf41-f83c06857a1d	1	merge()	f	2026-07-27 11:14:20.001+00
019fa348-6b0a-7b4f-a293-539abe81a24c	019fa348-6b09-7343-bf41-f83c06857a1d	2	concat()	t	2026-07-27 11:14:20.001+00
019fa348-6b0a-7baa-83ae-397f9e3baeb1	019fa348-6b09-7343-bf41-f83c06857a1d	3	combine()	f	2026-07-27 11:14:20.001+00
019fa348-6b0a-7be9-a2fe-65d29bd4a148	019fa348-6b09-7343-bf41-f83c06857a1d	4	join()	f	2026-07-27 11:14:20.001+00
019fa348-6b1d-7434-ba25-04aaa084dbfb	019fa348-6b1b-7efe-a924-27ec6a137c68	1	Consistency, Availability, Partition tolerance	t	2026-07-27 11:14:20.001+00
019fa348-6b1d-7561-baad-47b2b32eb341	019fa348-6b1b-7efe-a924-27ec6a137c68	2	Consistency, Async, Performance	f	2026-07-27 11:14:20.001+00
019fa348-6b1d-75b5-9054-1c62d461cff3	019fa348-6b1b-7efe-a924-27ec6a137c68	3	Cache, API, Protocol	f	2026-07-27 11:14:20.001+00
019fa348-6b1d-75f6-8b43-3f9b1d72dc46	019fa348-6b1b-7efe-a924-27ec6a137c68	4	Compute, Allocate, Process	f	2026-07-27 11:14:20.001+00
019fa348-6b21-7a0d-80cb-b8fab2892d56	019fa348-6b1e-7763-8828-0c5cbf74983b	1	Cache-aside	f	2026-07-27 11:14:20.001+00
019fa348-6b21-7c9d-bc40-3cde35e63579	019fa348-6b1e-7763-8828-0c5cbf74983b	2	Write-through	t	2026-07-27 11:14:20.001+00
019fa348-6b21-7dda-8d7c-2ea0d45c2de7	019fa348-6b1e-7763-8828-0c5cbf74983b	3	Write-behind	f	2026-07-27 11:14:20.001+00
019fa348-6b21-7e86-a0ee-1c982ecb6856	019fa348-6b1e-7763-8828-0c5cbf74983b	4	Refresh-ahead	f	2026-07-27 11:14:20.001+00
019fa348-6b26-7f09-a954-28abc0904f46	019fa348-6b24-706a-a20d-65c97bf574ad	1	Load balancing	f	2026-07-27 11:14:20.001+00
019fa348-6b27-7106-956f-5cdd04ac7092	019fa348-6b24-706a-a20d-65c97bf574ad	2	Decoupling producers and consumers	t	2026-07-27 11:14:20.001+00
019fa348-6b27-71d8-8092-44e873fadd5d	019fa348-6b24-706a-a20d-65c97bf574ad	3	Data replication	f	2026-07-27 11:14:20.001+00
019fa348-6b27-7273-850d-d53333810e8c	019fa348-6b24-706a-a20d-65c97bf574ad	4	Authentication	f	2026-07-27 11:14:20.001+00
019fa348-6b2a-7699-b949-f542cd5c2e39	019fa348-6b28-7d6f-83f6-67dede519a02	1	Relational (SQL)	f	2026-07-27 11:14:20.001+00
019fa348-6b2a-7849-9211-d9b021182a99	019fa348-6b28-7d6f-83f6-67dede519a02	2	Document store	f	2026-07-27 11:14:20.001+00
019fa348-6b2a-78a3-976e-9ebbf551457b	019fa348-6b28-7d6f-83f6-67dede519a02	3	Key-value store	f	2026-07-27 11:14:20.001+00
019fa348-6b2a-78e7-8bf5-55e536346807	019fa348-6b28-7d6f-83f6-67dede519a02	4	Graph database	t	2026-07-27 11:14:20.001+00
019fa348-6b2c-7c47-9604-1a3bab079e97	019fa348-6b2b-78bd-8b75-ef739ee21cad	1	Adding more CPU to existing machines	f	2026-07-27 11:14:20.001+00
019fa348-6b2c-7d23-9a61-4cb0799087c4	019fa348-6b2b-78bd-8b75-ef739ee21cad	2	Adding more machines to the pool	t	2026-07-27 11:14:20.001+00
019fa348-6b2c-7d84-8b92-114d89148873	019fa348-6b2b-78bd-8b75-ef739ee21cad	3	Increasing memory allocation	f	2026-07-27 11:14:20.001+00
019fa348-6b2c-7df2-864f-7a9d25681188	019fa348-6b2b-78bd-8b75-ef739ee21cad	4	Upgrading disk storage	f	2026-07-27 11:14:20.001+00
019fa348-6b31-7c99-b9e6-cfd3a3dd8c26	019fa348-6b30-7801-9209-3eab1d78c0e9	1	Consistency and Availability	t	2026-07-27 11:14:20.001+00
019fa348-6b31-7e03-b9a5-ceee5d58dbc9	019fa348-6b30-7801-9209-3eab1d78c0e9	2	Consistency and Durability	f	2026-07-27 11:14:20.001+00
019fa348-6b31-7e59-9d20-a097c877b6b8	019fa348-6b30-7801-9209-3eab1d78c0e9	3	Availability and Durability	f	2026-07-27 11:14:20.001+00
019fa348-6b31-7e9d-94ef-9f039a056f8c	019fa348-6b30-7801-9209-3eab1d78c0e9	4	Consistency and Performance	f	2026-07-27 11:14:20.001+00
019fa348-6b35-7de1-8476-8731d647b37d	019fa348-6b33-7556-a899-e400c07b3e79	1	Round Robin	f	2026-07-27 11:14:20.001+00
019fa348-6b36-70c0-a85c-00dbbac931cb	019fa348-6b33-7556-a899-e400c07b3e79	2	Least Connections	t	2026-07-27 11:14:20.001+00
019fa348-6b36-7162-8c64-e1409715cae1	019fa348-6b33-7556-a899-e400c07b3e79	3	IP Hash	f	2026-07-27 11:14:20.001+00
019fa348-6b36-71d0-bba9-8118e1604b74	019fa348-6b33-7556-a899-e400c07b3e79	4	Random	f	2026-07-27 11:14:20.001+00
019fa348-6b3b-793e-b33b-4b8872f94daa	019fa348-6b38-78e7-8733-be7213bfd581	1	Data is always immediately consistent	f	2026-07-27 11:14:20.001+00
019fa348-6b3b-7c82-ac69-d0f069a49aee	019fa348-6b38-78e7-8733-be7213bfd581	2	Data will become consistent over time without updates	t	2026-07-27 11:14:20.001+00
019fa348-6b3b-7d81-b786-d0d1b881c409	019fa348-6b38-78e7-8733-be7213bfd581	3	Data is never consistent	f	2026-07-27 11:14:20.001+00
019fa348-6b3b-7e35-8302-ac765af1b280	019fa348-6b38-78e7-8733-be7213bfd581	4	Data is consistent only during reads	f	2026-07-27 11:14:20.001+00
019fa348-6b40-7ef3-b59a-3f2a816ee584	019fa348-6b3e-73fd-ae3e-bc5c65a08984	1	Circuit Breaker	f	2026-07-27 11:14:20.001+00
019fa348-6b41-7131-8139-ee8d76ca1927	019fa348-6b3e-73fd-ae3e-bc5c65a08984	2	Bulkhead	f	2026-07-27 11:14:20.001+00
019fa348-6b41-7189-8244-518b49732c45	019fa348-6b3e-73fd-ae3e-bc5c65a08984	3	Cache-Aside	t	2026-07-27 11:14:20.001+00
019fa348-6b41-71e2-8fb2-c9047f1d7883	019fa348-6b3e-73fd-ae3e-bc5c65a08984	4	Saga	f	2026-07-27 11:14:20.001+00
019fa348-6b43-7d18-972e-86df020989d5	019fa348-6b42-78c8-9eac-c5469fc43575	1	Caching responses from servers	t	2026-07-27 11:14:20.001+00
019fa348-6b43-7e2a-955c-40133520b6e4	019fa348-6b42-78c8-9eac-c5469fc43575	2	Hiding client IP addresses from the internet	f	2026-07-27 11:14:20.001+00
019fa348-6b43-7e78-a7be-d2b056ed9e63	019fa348-6b42-78c8-9eac-c5469fc43575	3	Bypassing geo-restrictions	f	2026-07-27 11:14:20.001+00
019fa348-6b43-7eb3-a703-2782d10a770b	019fa348-6b42-78c8-9eac-c5469fc43575	4	Compressing outgoing requests	f	2026-07-27 11:14:20.001+00
019fa348-6b46-70c8-940c-dda5553a295d	019fa348-6b44-7d2c-a4a9-b166b4313e06	1	Causal consistency	f	2026-07-27 11:14:20.001+00
019fa348-6b46-71e5-a3af-d640964300c2	019fa348-6b44-7d2c-a4a9-b166b4313e06	2	Eventual consistency	f	2026-07-27 11:14:20.001+00
019fa348-6b46-7245-9e82-a471ca65a8f9	019fa348-6b44-7d2c-a4a9-b166b4313e06	3	Strong consistency	t	2026-07-27 11:14:20.001+00
019fa348-6b46-72b2-b3a1-c782b0525858	019fa348-6b44-7d2c-a4a9-b166b4313e06	4	Read-your-writes consistency	f	2026-07-27 11:14:20.001+00
019fa348-6b4c-77d6-8a3e-106a53091521	019fa348-6b4b-72ef-83c5-fdd2a829ab3f	1	Single database schema	f	2026-07-27 11:14:20.001+00
019fa348-6b4c-78c7-91a5-1a74806e6589	019fa348-6b4b-72ef-83c5-fdd2a829ab3f	2	Separation of read and write models	t	2026-07-27 11:14:20.001+00
019fa348-6b4c-791d-b334-af1ff7c16964	019fa348-6b4b-72ef-83c5-fdd2a829ab3f	3	Elimination of indexes	f	2026-07-27 11:14:20.001+00
019fa348-6b4c-7959-921c-9bef80b9f529	019fa348-6b4b-72ef-83c5-fdd2a829ab3f	4	Automatic data replication	f	2026-07-27 11:14:20.001+00
019fa348-6b4f-715b-a446-9380ff621952	019fa348-6b4d-7a7c-a3ca-cd7e1d1e8710	1	Sharding	f	2026-07-27 11:14:20.001+00
019fa348-6b4f-71fa-83d7-455864aa0593	019fa348-6b4d-7a7c-a3ca-cd7e1d1e8710	2	Materialized views	t	2026-07-27 11:14:20.001+00
019fa348-6b4f-7235-85a5-3db065176b44	019fa348-6b4d-7a7c-a3ca-cd7e1d1e8710	3	Vertical partitioning	f	2026-07-27 11:14:20.001+00
019fa348-6b4f-7261-8025-8a53559ceb53	019fa348-6b4d-7a7c-a3ca-cd7e1d1e8710	4	Denormalization only	f	2026-07-27 11:14:20.001+00
019fa348-6b51-7469-bb7c-750dd94dd11c	019fa348-6b50-706a-897a-3e204b355f89	1	Database replication	f	2026-07-27 11:14:20.001+00
019fa348-6b51-756d-90d5-10d28a0b40e0	019fa348-6b50-706a-897a-3e204b355f89	2	Reduced latency by serving from edge locations	t	2026-07-27 11:14:20.001+00
019fa348-6b51-75ba-b278-492c9eb2d1c8	019fa348-6b50-706a-897a-3e204b355f89	3	Load balancing between regions	f	2026-07-27 11:14:20.001+00
019fa348-6b51-75f3-888e-d4550028e12e	019fa348-6b50-706a-897a-3e204b355f89	4	Automatic failover	f	2026-07-27 11:14:20.001+00
019fa348-6b55-7c8c-888b-52b54444068b	019fa348-6b55-76c7-a0f9-bf45ffffaa3a	1	O(n)	f	2026-07-27 11:14:20.001+00
019fa348-6b55-7cd8-ae30-856742757b86	019fa348-6b55-76c7-a0f9-bf45ffffaa3a	2	O(log n)	f	2026-07-27 11:14:20.001+00
019fa348-6b55-7cf5-bf16-4376dfb12230	019fa348-6b55-76c7-a0f9-bf45ffffaa3a	3	O(1)	t	2026-07-27 11:14:20.001+00
019fa348-6b55-7d11-aec0-e78bacbceca3	019fa348-6b55-76c7-a0f9-bf45ffffaa3a	4	O(n log n)	f	2026-07-27 11:14:20.001+00
019fa348-6b56-7564-8737-9b03c7b6ac4e	019fa348-6b56-7088-9d32-06005531802f	1	Queue	f	2026-07-27 11:14:20.001+00
019fa348-6b56-7598-a506-d21e25945e64	019fa348-6b56-7088-9d32-06005531802f	2	Stack	t	2026-07-27 11:14:20.001+00
019fa348-6b56-75c6-aac6-e7d500e819a3	019fa348-6b56-7088-9d32-06005531802f	3	Linked List	f	2026-07-27 11:14:20.001+00
019fa348-6b56-75d7-9eea-70c660f4dbc8	019fa348-6b56-7088-9d32-06005531802f	4	Heap	f	2026-07-27 11:14:20.001+00
019fa348-6b56-7d47-aab8-10f6cda65118	019fa348-6b56-78b9-8675-f3a45217bd52	1	O(1)	f	2026-07-27 11:14:20.001+00
019fa348-6b56-7d74-a626-dfbd832b681d	019fa348-6b56-78b9-8675-f3a45217bd52	2	O(log n)	f	2026-07-27 11:14:20.001+00
019fa348-6b56-7f41-a449-228045ffe0a3	019fa348-6b56-78b9-8675-f3a45217bd52	3	O(n)	t	2026-07-27 11:14:20.001+00
019fa348-6b56-7f5b-a325-8da3b7c90db1	019fa348-6b56-78b9-8675-f3a45217bd52	4	O(n^2)	f	2026-07-27 11:14:20.001+00
019fa348-6b57-7909-93c0-32189276f898	019fa348-6b57-7269-b8e7-59f96451499d	1	Linear probing	f	2026-07-27 11:14:20.001+00
019fa348-6b57-79c5-a747-470126dd59bc	019fa348-6b57-7269-b8e7-59f96451499d	2	Quadratic probing	f	2026-07-27 11:14:20.001+00
019fa348-6b57-79f9-969c-fb7967bff877	019fa348-6b57-7269-b8e7-59f96451499d	3	Separate chaining	t	2026-07-27 11:14:20.001+00
019fa348-6b57-7a29-885e-0c03956b98c5	019fa348-6b57-7269-b8e7-59f96451499d	4	Robin Hood hashing	f	2026-07-27 11:14:20.001+00
019fa348-6b5b-7b75-8392-c3f9751de4e0	019fa348-6b5b-77df-a424-16555a5a5611	1	O(n)	f	2026-07-27 11:14:20.001+00
019fa348-6b5b-7bb9-85cc-8b9f59968a16	019fa348-6b5b-77df-a424-16555a5a5611	2	O(n log n)	t	2026-07-27 11:14:20.001+00
019fa348-6b5b-7bcf-b8fd-9152198f6f58	019fa348-6b5b-77df-a424-16555a5a5611	3	O(n^2)	f	2026-07-27 11:14:20.001+00
019fa348-6b5b-7bde-82f2-149d66a265e4	019fa348-6b5b-77df-a424-16555a5a5611	4	O(log n)	f	2026-07-27 11:14:20.001+00
019fa348-6b5c-71bd-a54e-59b296fc5fcf	019fa348-6b5b-7e28-b8dc-6d815e00428b	1	Bellman-Ford	f	2026-07-27 11:14:20.001+00
019fa348-6b5c-71e4-b72b-aafd87befaa2	019fa348-6b5b-7e28-b8dc-6d815e00428b	2	Dijkstra's algorithm	t	2026-07-27 11:14:20.001+00
019fa348-6b5c-71f7-ba84-825ab5788177	019fa348-6b5b-7e28-b8dc-6d815e00428b	3	Floyd-Warshall only	f	2026-07-27 11:14:20.001+00
019fa348-6b5c-7204-845d-144d9061e3a7	019fa348-6b5b-7e28-b8dc-6d815e00428b	4	DFS	f	2026-07-27 11:14:20.001+00
019fa348-6b5c-7746-bdd4-19aacefe6a7e	019fa348-6b5c-7424-8a10-2db1f2fd0b92	1	O(1)	f	2026-07-27 11:14:20.001+00
019fa348-6b5c-7769-8e28-0c1e1401c405	019fa348-6b5c-7424-8a10-2db1f2fd0b92	2	O(log n)	f	2026-07-27 11:14:20.001+00
019fa348-6b5c-777d-bb56-0dc47385cc00	019fa348-6b5c-7424-8a10-2db1f2fd0b92	3	O(n)	t	2026-07-27 11:14:20.001+00
019fa348-6b5c-778d-94e8-1c5a34a35d0c	019fa348-6b5c-7424-8a10-2db1f2fd0b92	4	O(n^2)	f	2026-07-27 11:14:20.001+00
019fa348-6b5c-7d63-aa56-ce8e127dd95b	019fa348-6b5c-79da-b1a1-9a3b8921e242	1	All subproblems are equally sized	f	2026-07-27 11:14:20.001+00
019fa348-6b5c-7d87-8c4d-6e12aa06484a	019fa348-6b5c-79da-b1a1-9a3b8921e242	2	Optimal solution can be built from optimal solutions of subproblems	t	2026-07-27 11:14:20.001+00
019fa348-6b5c-7d9a-aaad-450306b46d2b	019fa348-6b5c-79da-b1a1-9a3b8921e242	3	All solutions must be stored	f	2026-07-27 11:14:20.001+00
019fa348-6b5c-7da7-87bb-6ca327cad6c6	019fa348-6b5c-79da-b1a1-9a3b8921e242	4	The problem has no overlapping subproblems	f	2026-07-27 11:14:20.001+00
019fa348-6b5d-747b-923d-4e063e246302	019fa348-6b5c-7fea-beef-1b628b80d121	1	Memoization	f	2026-07-27 11:14:20.001+00
019fa348-6b5d-74b8-b9f5-30c3a096e100	019fa348-6b5c-7fea-beef-1b628b80d121	2	Tabulation	f	2026-07-27 11:14:20.001+00
019fa348-6b5d-74c8-8d97-4998eff18528	019fa348-6b5c-7fea-beef-1b628b80d121	3	Stack emulation	t	2026-07-27 11:14:20.001+00
019fa348-6b5d-74e0-90e9-d074854dd57d	019fa348-6b5c-7fea-beef-1b628b80d121	4	Tail call optimization	f	2026-07-27 11:14:20.001+00
019fa348-6b5d-7ac8-a851-58fd0efc735c	019fa348-6b5d-7771-a3b9-e6fd54dff65b	1	O(n)	f	2026-07-27 11:14:20.001+00
019fa348-6b5d-7aef-bf70-0dc5293a4675	019fa348-6b5d-7771-a3b9-e6fd54dff65b	2	O(log n)	t	2026-07-27 11:14:20.001+00
019fa348-6b5d-7b13-b61d-534b246b7c36	019fa348-6b5d-7771-a3b9-e6fd54dff65b	3	O(n log n)	f	2026-07-27 11:14:20.001+00
019fa348-6b5d-7b22-b0b1-a680c61be517	019fa348-6b5d-7771-a3b9-e6fd54dff65b	4	O(1)	f	2026-07-27 11:14:20.001+00
\.


--
-- Data for Name: quiz_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_attempts (attempt_id, user_id, quiz_version_id, context_type, context_ref_id, status, score_percent, correct_count, started_at, finished_at, time_taken_ms, xp_earned, created_at, updated_at) FROM stdin;
019fe71e-5a2d-738e-ae28-a4ad2a820f69	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	019fa348-6b2f-7486-ab87-018005465330	solo	\N	started	\N	\N	2026-08-09 15:22:33.892+00	\N	\N	0	2026-08-09 15:22:33.892+00	2026-08-09 15:22:33.892+00
\.


--
-- Data for Name: quiz_attempt_answers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_attempt_answers (attempt_answer_id, attempt_id, question_id, selected_option_id, answered_at, time_taken_ms) FROM stdin;
019fe737-da9a-7211-8fc3-f6b3e5692e07	019fe71e-5a2d-738e-ae28-a4ad2a820f69	019fa348-6b30-7801-9209-3eab1d78c0e9	019fa348-6b31-7e59-9d20-a097c877b6b8	2026-08-09 15:50:25.174+00	\N
019fe738-0bbf-7e6b-b4ee-3e3647a15738	019fe71e-5a2d-738e-ae28-a4ad2a820f69	019fa348-6b38-78e7-8733-be7213bfd581	019fa348-6b3b-7d81-b786-d0d1b881c409	2026-08-09 15:50:37.755+00	\N
\.


--
-- Data for Name: quiz_attempt_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_attempt_events (event_id, attempt_id, event_type, question_id, selected_option_id, payload, created_at) FROM stdin;
1	019fe71e-5a2d-738e-ae28-a4ad2a820f69	answer.submitted	019fa348-6b30-7801-9209-3eab1d78c0e9	019fa348-6b31-7e59-9d20-a097c877b6b8	{"answeredAt": "2026-08-09T15:50:25.174Z"}	2026-08-09 15:50:25.176619+00
2	019fe71e-5a2d-738e-ae28-a4ad2a820f69	answer.submitted	019fa348-6b38-78e7-8733-be7213bfd581	019fa348-6b3b-7d81-b786-d0d1b881c409	{"answeredAt": "2026-08-09T15:50:37.755Z"}	2026-08-09 15:50:37.758626+00
\.


--
-- Data for Name: quiz_instances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_instances (instance_id, quiz_version_id, host_user_id, max_players, status, created_at, started_at, closed_at, updated_at, countdown_started_at, version) FROM stdin;
019fa348-6b9a-7adb-8cfa-0c88d19b24d6	019fa348-6af8-7015-bca5-2a489b454074	019fa348-6ad0-74a4-b97b-be22830008a9	10	open	2026-07-27 11:14:20.184+00	\N	\N	2026-07-27 11:14:20.184+00	\N	1
019fa348-6b9b-7dd0-ab91-4baf2aae9127	019fa348-6b2f-7486-ab87-018005465330	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	20	running	2026-07-27 11:14:20.184+00	\N	\N	2026-07-27 11:14:20.184+00	\N	1
\.


--
-- Data for Name: quiz_instance_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_instance_players (instance_player_id, instance_id, user_id, attempt_id, status, joined_at, left_at) FROM stdin;
\.


--
-- Data for Name: quiz_reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_reviews (review_id, quiz_id, user_id, rating, comment, created_at, updated_at, helpful_count, deleted_at) FROM stdin;
019fa348-6b79-7ce5-9ce2-7cc962ed7ad0	019fa348-6ae4-766a-a332-b67cac1ced82	019fa348-6ad0-74be-b987-06e3bd247875	5	Excellent quiz! Great questions that really test your understanding of JavaScript basics.	2026-07-27 11:14:20.152+00	2026-07-27 11:14:20.152+00	0	\N
019fa348-6b7b-7349-b921-22324119186c	019fa348-6ae4-766a-a332-b67cac1ced82	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	4	Good coverage of fundamentals. Some questions felt a bit too straightforward.	2026-07-27 11:14:20.152+00	2026-07-27 11:14:20.152+00	0	\N
019fa348-6b7c-7828-9ca6-c11fb7555ffa	019fa348-6b10-7f21-b3b0-9f7d972f5402	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	5	Challenging but fair. The questions cover real-world scenarios you would encounter in system design interviews.	2026-07-27 11:14:20.152+00	2026-07-27 11:14:20.152+00	0	\N
\.


--
-- Data for Name: quiz_stats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_stats (quiz_id, total_attempts, total_players, avg_score_percent, last_attempt_at, updated_at, avg_rating, rating_count, bookmark_count, completion_rate, popularity_score, trending_score, last_calculated_at) FROM stdin;
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tags (tag_id, name, slug, created_at, updated_at, deleted_at) FROM stdin;
019fa348-6ade-75a2-b0db-c4a52d05e503	Physics	physics	2026-07-27 11:14:19.996955+00	2026-08-08 07:45:42.987+00	\N
019fa348-6ade-76d7-a37e-d7fa5b6a22df	Chemistry	chemistry	2026-07-27 11:14:19.996955+00	2026-08-08 07:45:42.987+00	\N
019fa348-6ade-76fc-933e-d89692751be9	Biology	biology	2026-07-27 11:14:19.996955+00	2026-08-08 07:45:42.987+00	\N
019fa348-6ade-7710-80d2-ab5cf6d3bd65	Math	math	2026-07-27 11:14:19.996955+00	2026-08-08 07:45:42.987+00	\N
019fa348-6ade-7723-82e9-0a19bb1a56cc	Programming	programming	2026-07-27 11:14:19.996955+00	2026-08-08 07:45:42.987+00	\N
019fa348-6ade-7736-936b-1ee50262efac	Algorithms	algorithms	2026-07-27 11:14:19.996955+00	2026-08-08 07:45:42.987+00	\N
019fa348-6ade-7747-8cb5-7f7042ec7236	General Knowledge	general-knowledge	2026-07-27 11:14:19.996955+00	2026-08-08 07:45:42.987+00	\N
019fa348-6ade-775c-b074-b2a17a941218	World History	world-history	2026-07-27 11:14:19.996955+00	2026-08-08 07:45:42.987+00	\N
\.


--
-- Data for Name: quiz_tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_tags (quiz_tag_id, quiz_id, tag_id, created_at) FROM stdin;
019fa348-6af2-73e8-846e-5a6016e9e4bf	019fa348-6ae4-766a-a332-b67cac1ced82	019fa348-6ade-7723-82e9-0a19bb1a56cc	2026-07-27 11:14:20.001+00
019fa348-6b16-70c9-8143-bf1861ac06d7	019fa348-6b10-7f21-b3b0-9f7d972f5402	019fa348-6ade-7723-82e9-0a19bb1a56cc	2026-07-27 11:14:20.001+00
019fa348-6b17-7dd6-afe0-73f353eba4fd	019fa348-6b10-7f21-b3b0-9f7d972f5402	019fa348-6ade-7736-936b-1ee50262efac	2026-07-27 11:14:20.001+00
019fa348-6b5a-777e-a0d1-0b83c6926b40	019fa348-6b59-74dc-b21e-1cbe787b2cc3	019fa348-6ade-7736-936b-1ee50262efac	2026-07-27 11:14:20.001+00
019fa348-6b5a-7d30-9d20-dd13c512974f	019fa348-6b59-74dc-b21e-1cbe787b2cc3	019fa348-6ade-7723-82e9-0a19bb1a56cc	2026-07-27 11:14:20.001+00
\.


--
-- Data for Name: rank_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rank_history (history_id, user_id, period, snapshot_date, rank, xp, recorded_at) FROM stdin;
31111111-1111-7111-8111-111111111111	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	weekly	2026-06-23 00:00:00+00	2	180	2026-07-27 11:14:20.129+00
31111111-1111-7111-8111-111111111112	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	monthly	2026-06-01 00:00:00+00	1	350	2026-07-27 11:14:20.129+00
32222222-2222-7222-8222-222222222221	019fa348-6ad0-74be-b987-06e3bd247875	weekly	2026-06-23 00:00:00+00	3	40	2026-07-27 11:14:20.129+00
32222222-2222-7222-8222-222222222222	019fa348-6ad0-74be-b987-06e3bd247875	monthly	2026-06-01 00:00:00+00	2	100	2026-07-27 11:14:20.129+00
33333333-3333-7333-8333-333333333331	019fa348-6ad0-74a4-b97b-be22830008a9	weekly	2026-06-23 00:00:00+00	1	0	2026-07-27 11:14:20.129+00
33333333-3333-7333-8333-333333333332	019fa348-6ad0-74a4-b97b-be22830008a9	monthly	2026-06-01 00:00:00+00	3	0	2026-07-27 11:14:20.129+00
019fa372-3a27-79f9-89a8-fa2ca6436481	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-07-27 00:00:00+00	1	350	2026-07-27 12:00:00.03+00
019fa372-3a27-7c47-ab2a-4ecce52dbd64	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-07-27 00:00:00+00	2	100	2026-07-27 12:00:00.03+00
019fa372-3a34-73ae-acaf-1a5e9ac6dbba	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	weekly	2026-07-27 00:00:00+00	1	250	2026-07-27 12:00:00.03+00
019fa372-3a34-7510-94e0-cf384810fc4e	019fa348-6ad0-74be-b987-06e3bd247875	weekly	2026-07-27 00:00:00+00	2	80	2026-07-27 12:00:00.03+00
019fa372-3a39-7ce1-9362-75ba47b9426e	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	monthly	2026-07-01 00:00:00+00	1	350	2026-07-27 12:00:00.03+00
019fa372-3a39-7dd8-89d2-3a4ec4f2267f	019fa348-6ad0-74be-b987-06e3bd247875	monthly	2026-07-01 00:00:00+00	2	100	2026-07-27 12:00:00.03+00
019fa372-3a3f-7502-93c4-69579ee8218a	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-07-27 00:00:00+00	2	40	2026-07-27 12:00:00.03+00
019fa372-3a3f-7509-8401-fd54041f137f	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-07-27 00:00:00+00	1	150	2026-07-27 12:00:00.03+00
019fa63c-56ab-7262-862e-60e6cea84c00	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-07-28 00:00:00+00	1	350	2026-07-28 01:00:00.032+00
019fa63c-56ab-72a2-ac21-0e2d26485172	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-07-28 00:00:00+00	2	100	2026-07-28 01:00:00.032+00
019fa63c-56b5-7660-9502-44efcc56cc3a	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-07-28 00:00:00+00	1	150	2026-07-28 01:00:00.032+00
019fa63c-56b5-7695-b29b-8aa8f04406c6	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-07-28 00:00:00+00	2	40	2026-07-28 01:00:00.032+00
019fadf5-e0a9-78f3-a4f1-c462fa91707b	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-07-29 00:00:00+00	1	350	2026-07-29 13:00:00.03+00
019fadf5-e0a9-7913-a83c-a3a4cda71828	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-07-29 00:00:00+00	2	100	2026-07-29 13:00:00.03+00
019fadf5-e0b9-75bc-a5b1-a8ce33fb2362	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-07-29 00:00:00+00	1	150	2026-07-29 13:00:00.03+00
019fadf5-e0b9-773c-97e8-b928d41ccc5c	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-07-29 00:00:00+00	2	40	2026-07-29 13:00:00.03+00
019fb089-0eb9-7a03-a03e-00d173ebe187	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-07-30 00:00:00+00	1	350	2026-07-30 01:00:00.022+00
019fb089-0eb9-7aa2-85cc-cb54e3b2cb96	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-07-30 00:00:00+00	2	100	2026-07-30 01:00:00.022+00
019fb089-0ece-7c50-8ef9-ebdcea313e10	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-07-30 00:00:00+00	1	150	2026-07-30 01:00:00.022+00
019fb089-0ece-7f0b-8e6f-f0b323576574	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-07-30 00:00:00+00	2	40	2026-07-30 01:00:00.022+00
019fb79d-cd3a-79fa-84cf-7a824a634d14	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-07-31 00:00:00+00	1	350	2026-07-31 10:00:00.045+00
019fb79d-cd3a-7a45-ab10-523cb29c178c	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-07-31 00:00:00+00	2	100	2026-07-31 10:00:00.045+00
019fb79d-cd4b-73be-96b4-3074b88d7291	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-07-31 00:00:00+00	1	150	2026-07-31 10:00:00.045+00
019fb79d-cd4b-74ad-bf14-c85109d30476	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-07-31 00:00:00+00	2	40	2026-07-31 10:00:00.045+00
019fbb0c-b537-7c29-9151-ce7f334bce26	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-01 00:00:00+00	1	350	2026-08-01 02:00:00.044+00
019fbb0c-b537-7c65-8f60-0a03b2379f49	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-01 00:00:00+00	2	100	2026-08-01 02:00:00.044+00
019fbb0c-b542-788b-8a20-929f285f57ae	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	monthly	2026-08-01 00:00:00+00	1	350	2026-08-01 02:00:00.044+00
019fbb0c-b542-78da-b953-ebb08458935b	019fa348-6ad0-74be-b987-06e3bd247875	monthly	2026-08-01 00:00:00+00	2	100	2026-08-01 02:00:00.044+00
019fbb0c-b547-743f-a655-4ec131cf4f6e	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-01 00:00:00+00	1	150	2026-08-01 02:00:00.044+00
019fbb0c-b547-74ee-a2e2-c1b6f2546958	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-01 00:00:00+00	2	40	2026-08-01 02:00:00.044+00
019fc28f-509f-75a4-ab50-21df994ebb59	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-02 00:00:00+00	1	350	2026-08-02 13:00:00.021+00
019fc28f-509f-75c6-9ba9-5027491c9bba	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-02 00:00:00+00	2	100	2026-08-02 13:00:00.021+00
019fc28f-50af-7149-9bac-7b9c427aeabb	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-02 00:00:00+00	1	150	2026-08-02 13:00:00.021+00
019fc28f-50af-72bb-bb5f-5b63886f23da	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-02 00:00:00+00	2	40	2026-08-02 13:00:00.021+00
019fc635-2724-75f1-9c6a-518c129cbcdc	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-03 00:00:00+00	1	350	2026-08-03 06:00:00.024+00
019fc635-2724-7638-ba61-9fce18c2bd34	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-03 00:00:00+00	2	100	2026-08-03 06:00:00.024+00
019fc635-272e-7613-97af-8aff93b340fc	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	weekly	2026-08-03 00:00:00+00	1	250	2026-08-03 06:00:00.024+00
019fc635-272e-77c1-a8e1-b13f04e020d2	019fa348-6ad0-74be-b987-06e3bd247875	weekly	2026-08-03 00:00:00+00	2	80	2026-08-03 06:00:00.024+00
019fc635-2740-709f-b9fa-135a8960fdf2	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-03 00:00:00+00	1	150	2026-08-03 06:00:00.024+00
019fc635-2740-7131-b55a-3b07f156eeb7	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-03 00:00:00+00	2	40	2026-08-03 06:00:00.024+00
019fcab6-b7ab-7e4f-8111-7693dc4fe08f	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-04 00:00:00+00	2	100	2026-08-04 03:00:00.03+00
019fcab6-b7ab-7eba-8d32-1b54e912ef0f	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-04 00:00:00+00	1	350	2026-08-04 03:00:00.03+00
019fcab6-b7b7-70bb-85be-5d9bfa519253	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-04 00:00:00+00	2	40	2026-08-04 03:00:00.03+00
019fcab6-b7b7-70c1-8e85-a628c925e730	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-04 00:00:00+00	1	150	2026-08-04 03:00:00.03+00
019fd1cb-7628-703f-955b-8c00a952e050	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-05 00:00:00+00	1	350	2026-08-05 12:00:00.029+00
019fd1cb-7628-70ad-aa2f-b7c1ec124907	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-05 00:00:00+00	2	100	2026-08-05 12:00:00.029+00
019fd1cb-7634-7b0f-9483-8b8cca3ac10e	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-05 00:00:00+00	2	40	2026-08-05 12:00:00.029+00
019fd1cb-7634-7b23-9c63-78736e9b7fbc	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-05 00:00:00+00	1	150	2026-08-05 12:00:00.029+00
019fd495-92a8-7ba4-a8b0-ea3ed8f283bf	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-06 00:00:00+00	1	350	2026-08-06 01:00:00.032+00
019fd495-92a8-7bac-87bc-52b88d4e82d6	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-06 00:00:00+00	2	100	2026-08-06 01:00:00.032+00
019fd495-92b4-706c-9ffb-c1fbee34f394	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-06 00:00:00+00	2	40	2026-08-06 01:00:00.032+00
019fd495-92b4-7052-9b25-253077dec89a	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-06 00:00:00+00	1	150	2026-08-06 01:00:00.032+00
019fd9f2-dd2c-78ed-a423-4687276df882	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-07 00:00:00+00	1	350	2026-08-07 02:00:00.036+00
019fd9f2-dd2f-7784-80af-b3acd8130cf6	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-07 00:00:00+00	2	100	2026-08-07 02:00:00.036+00
019fd9f2-dd3b-71c2-b726-2c7bfdd98ad5	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-07 00:00:00+00	2	40	2026-08-07 02:00:00.036+00
019fd9f2-dd3b-71d8-aca2-8744fef485ad	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-07 00:00:00+00	1	150	2026-08-07 02:00:00.036+00
019fdee2-4aa5-72b5-bfd4-5d807974badb	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-08 00:00:00+00	2	100	2026-08-08 01:00:00.026+00
019fdee2-4aa5-72a2-a35b-09b89988a3cd	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-08 00:00:00+00	1	350	2026-08-08 01:00:00.026+00
019fdee2-4ab2-7ae0-a560-cc76e2d37411	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-08 00:00:00+00	1	150	2026-08-08 01:00:00.026+00
019fdee2-4ab2-7ca3-a0e6-3b3f1f1cd36a	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-08 00:00:00+00	2	40	2026-08-08 01:00:00.026+00
019fe408-a6b3-7a2a-996b-304abd191ea8	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-09 00:00:00+00	2	100	2026-08-09 01:00:00.04+00
019fe408-a6b3-7a4e-8768-382cddd8f9c9	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-09 00:00:00+00	1	350	2026-08-09 01:00:00.04+00
019fe408-a6c5-71aa-a737-f460fae2e068	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-09 00:00:00+00	2	40	2026-08-09 01:00:00.04+00
019fe408-a6c5-71de-b99f-e6b63d0d63c6	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-09 00:00:00+00	1	150	2026-08-09 01:00:00.04+00
019fe8fc-32cb-7a4d-9992-ba0f8a7da888	019fa348-6ad0-74be-b987-06e3bd247875	weekly	2026-08-09 17:00:00+00	2	80	2026-08-10 00:04:30.007+00
019fe8fc-32cc-7c4f-bb3f-2072c41754fe	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	weekly	2026-08-09 17:00:00+00	1	250	2026-08-10 00:04:30.007+00
019fe92f-02a8-7f06-9207-61f14e494a90	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	all_time	2026-08-10 00:00:00+00	1	350	2026-08-10 01:00:00.034+00
019fe92f-02a9-7ae3-a47e-a839c07f07a9	019fa348-6ad0-74be-b987-06e3bd247875	all_time	2026-08-10 00:00:00+00	2	100	2026-08-10 01:00:00.034+00
019fe92f-02b2-7732-b94f-c1b4b213672d	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	daily	2026-08-10 00:00:00+00	1	150	2026-08-10 01:00:00.034+00
019fe92f-02b2-7790-aeeb-99bc6ea2b4c3	019fa348-6ad0-74be-b987-06e3bd247875	daily	2026-08-10 00:00:00+00	2	40	2026-08-10 01:00:00.034+00
\.


--
-- Data for Name: rank_recalculation_work_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rank_recalculation_work_items (work_item_id, user_id, period, enqueued_at) FROM stdin;
\.


--
-- Data for Name: ranking_milestones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ranking_milestones (id, user_id, milestone, rank, achieved_at) FROM stdin;
41111111-1111-7111-8111-111111111111	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	TOP_10	1	2026-06-30 10:00:00+00
41111111-1111-7111-8111-111111111112	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	TOP_3	1	2026-06-30 10:00:00+00
41111111-1111-7111-8111-111111111113	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	TOP_1	1	2026-06-30 10:00:00+00
42222222-2222-7222-8222-222222222221	019fa348-6ad0-74be-b987-06e3bd247875	TOP_10	2	2026-06-29 08:30:00+00
42222222-2222-7222-8222-222222222222	019fa348-6ad0-74be-b987-06e3bd247875	TOP_3	2	2026-06-29 08:30:00+00
43333333-3333-7333-8333-333333333331	019fa348-6ad0-74a4-b97b-be22830008a9	TOP_10	3	2026-06-28 14:00:00+00
43333333-3333-7333-8333-333333333332	019fa348-6ad0-74a4-b97b-be22830008a9	TOP_3	3	2026-06-28 14:00:00+00
\.


--
-- Data for Name: review_helpful_votes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.review_helpful_votes (vote_id, review_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: review_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.review_reports (report_id, review_id, reporter_id, reason, details, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sent_verification_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sent_verification_tokens (sent_token_id, user_id, token_hash, sent_at, expires_at) FROM stdin;
\.


--
-- Data for Name: social_feed_activities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.social_feed_activities (activity_id, user_id, activity_type, payload, occurred_at, created_at) FROM stdin;
\.


--
-- Data for Name: tag_follows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tag_follows (follow_id, user_id, tag_id, created_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: tournaments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournaments (tournament_id, title, description, difficulty, status, prize, start_at, end_at, max_participants, category_id, owner_user_id, created_at, updated_at, deleted_at) FROM stdin;
019fa348-6b92-7a9c-ac0d-ceaf30383bba	Monthly JavaScript Showdown	Monthly competition for JavaScript enthusiasts.	medium	ongoing	1000 XP + Expert Badge	2026-07-22 11:14:19.644+00	2026-07-29 11:14:19.644+00	100	019fa348-6adb-72b6-b34a-e1bae0b50adf	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	2026-07-27 11:14:20.175+00	2026-07-27 11:14:20.175+00	\N
019fa348-6b94-70e7-947c-bf628a2cc305	April System Design Cup	The inaugural system design tournament.	medium	finished	2000 XP + Champion Badge	2026-06-27 11:14:19.644+00	2026-07-04 11:14:19.644+00	200	019fa348-6adb-72b6-b34a-e1bae0b50adf	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	2026-07-27 11:14:20.175+00	2026-07-27 11:14:20.175+00	\N
019fa348-6b90-79ab-9b73-ac2fbdb57d63	Weekly Challenge: Algorithms	Test your algorithmic thinking with our weekly challenge.	hard	ongoing	500 XP + Champion Badge	2026-08-03 11:14:19.643+00	2026-08-04 11:14:19.644+00	50	019fa348-6adb-72b6-b34a-e1bae0b50adf	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	2026-07-27 11:14:20.175+00	2026-08-03 11:15:00.03+00	\N
\.


--
-- Data for Name: tournament_participants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournament_participants (participant_id, tournament_id, user_id, registered_at, total_score, total_time_ms, rank_final, status, withdrawn_at, updated_at) FROM stdin;
019fa348-6b95-7ce4-b70a-68540757ef51	019fa348-6b94-70e7-947c-bf628a2cc305	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	2026-06-27 11:14:19.644+00	250	540000	1	active	\N	2026-08-08 07:25:27.976+00
019fa348-6b96-77a2-9e02-247867ce5f7d	019fa348-6b94-70e7-947c-bf628a2cc305	019fa348-6ad0-74be-b987-06e3bd247875	2026-06-27 11:14:19.644+00	200	610000	2	active	\N	2026-08-08 07:25:27.976+00
\.


--
-- Data for Name: tournament_rounds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournament_rounds (round_id, tournament_id, round_number, name, description, quiz_version_id, start_at, end_at, duration_ms, status, is_elimination, participant_limit, created_at, updated_at) FROM stdin;
019fa348-6b91-79b7-9c2b-08b00c7ee46c	019fa348-6b90-79ab-9b73-ac2fbdb57d63	1	Round 1: algorithms-advanced	Quiz: algorithms-advanced	019fa348-6b5b-74b4-9358-2faabfc3971d	\N	\N	\N	pending	f	\N	2026-07-27 11:14:20.175+00	2026-07-27 11:14:20.175+00
019fa348-6b93-74d2-bf8a-9cc91de12222	019fa348-6b92-7a9c-ac0d-ceaf30383bba	1	Round 1: javascript-fundamentals	Quiz: javascript-fundamentals	019fa348-6af8-7015-bca5-2a489b454074	\N	\N	\N	open	f	\N	2026-07-27 11:14:20.175+00	2026-07-27 11:14:20.175+00
019fa348-6b94-7de8-b086-9f543b663c24	019fa348-6b94-70e7-947c-bf628a2cc305	1	Round 1: system-design-v2	Quiz: system-design-v2	019fa348-6b2f-7486-ab87-018005465330	\N	\N	\N	finished	f	\N	2026-07-27 11:14:20.175+00	2026-07-27 11:14:20.175+00
\.


--
-- Data for Name: tournament_round_participants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournament_round_participants (round_participant_id, round_id, participant_id, attempt_id, joined_at, round_score, round_time_ms, rank_in_round, is_qualified, updated_at) FROM stdin;
\.


--
-- Data for Name: tournament_stats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournament_stats (tournament_id, participants, completed_participants, average_score, highest_score, lowest_score, completion_rate, average_rank, updated_at) FROM stdin;
\.


--
-- Data for Name: user_activity_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_activity_events (event_id, user_id, "eventType", metadata, visibility, occurred_at, created_at) FROM stdin;
\.


--
-- Data for Name: user_badges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_badges (user_badge_id, user_id, badge_id, earned_at, badge_version, progress, metadata, expires_at, revoked_at, revocation_reason) FROM stdin;
51111111-1111-7111-8111-111111111111	019fa348-6ad0-74be-b987-06e3bd247875	019fa348-6997-762c-9541-61a6c97d8f5e	2026-06-28 08:00:00+00	1.0.0	{"threshold": 1, "quizzesCompleted": 1}	{"note": "Completed first quiz", "source": "direct_seed"}	\N	\N	\N
51111111-1111-7111-8111-111111111112	019fa348-6ad0-74be-b987-06e3bd247875	019fa348-6997-7af7-8c80-3bcc2e120e39	2026-06-29 08:30:00+00	1.0.0	{"xpTotal": 100, "threshold": 100}	{"source": "ranking_seed"}	\N	\N	\N
52222222-2222-7222-8222-222222222221	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	019fa348-6997-762c-9541-61a6c97d8f5e	2026-06-27 10:00:00+00	1.0.0	{"threshold": 1, "quizzesCompleted": 1}	{"source": "direct_seed"}	\N	\N	\N
52222222-2222-7222-8222-222222222222	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	019fa348-6997-7b92-bed9-d4cd966bd3f0	2026-06-30 10:00:00+00	1.0.0	{"threshold": 1, "perfectScores": 1}	{"note": "Seeded directly to exercise badge list / revoke endpoints", "source": "direct_seed"}	\N	\N	\N
52222222-2222-7222-8222-222222222223	019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	019fa348-6997-7bf0-8d6b-96a234c8294e	2026-06-30 10:00:00+00	1.0.0	{"threshold": 1, "globalRank": 1}	{"period": "all_time", "source": "ranking_seed"}	\N	\N	\N
53333333-3333-7333-8333-333333333331	019fa348-6ad0-74a4-b97b-be22830008a9	019fa348-6997-7bc4-a933-6c171aebb68b	2026-06-28 14:00:00+00	1.0.0	{"threshold": 100, "globalRank": 3}	{"period": "all_time", "source": "ranking_seed"}	\N	\N	\N
\.


--
-- Data for Name: user_follows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_follows (follow_id, follower_id, following_id, created_at, deleted_at) FROM stdin;
019fa372-cfdf-7691-93d4-057ad162111f	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	019fa348-6ad0-7471-ad7f-24ded0250994	2026-07-27 12:00:38.367286+00	2026-07-27 15:18:26.891+00
019fa373-3a2f-726c-9da5-b7da18424d4a	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	019fa348-6ad0-7471-ad7f-24ded0250994	2026-07-27 12:01:05.582931+00	2026-07-27 15:18:26.891+00
019fa384-7d3d-7b0e-acb0-e8271e8035f4	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	019fa348-6ad0-7471-ad7f-24ded0250994	2026-07-27 12:19:56.861465+00	2026-07-27 15:18:26.891+00
\.


--
-- Data for Name: user_profile_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_profile_settings (settings_id, user_id, is_public, show_statistics, show_achievements, show_activity, show_rank_improvement, show_tournament_activity, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_profiles (profile_id, user_id, display_name, avatar_url, bio, tagline, pinned_badge_ids, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_ranking; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_ranking (user_id, all_time_xp, weekly_xp, monthly_xp, all_time_rank, weekly_rank, monthly_rank, daily_rank, updated_at, last_weekly_reset_at, last_monthly_reset_at, last_daily_reset_at, peak_all_time_rank, peak_all_time_rank_achieved_at, peak_weekly_rank, peak_weekly_rank_achieved_at, peak_monthly_rank, peak_monthly_rank_achieved_at, peak_daily_rank, peak_daily_rank_achieved_at, daily_xp, last_activity_at, is_dirty) FROM stdin;
019fa348-6ad0-74a4-b97b-be22830008a9	0	0	0	3	3	3	3	2026-08-08 07:25:27.941+00	2026-06-30 00:00:00+00	2026-06-01 00:00:00+00	2026-06-30 00:00:00+00	3	2026-06-28 14:00:00+00	3	2026-06-28 14:00:00+00	3	2026-06-28 14:00:00+00	3	2026-06-28 14:00:00+00	0	2026-06-28 14:00:00+00	f
019fa348-6ad0-719b-a10b-b2ce0d6bfa62	0	0	0	4	4	4	4	2026-08-08 07:25:27.941+00	2026-06-30 00:00:00+00	2026-06-01 00:00:00+00	2026-06-30 00:00:00+00	4	2026-06-28 00:00:00+00	4	2026-06-28 00:00:00+00	4	2026-06-28 00:00:00+00	4	2026-06-28 00:00:00+00	0	2026-06-28 00:00:00+00	f
019fa348-6ad0-7471-ad7f-24ded0250994	0	0	0	5	5	5	5	2026-08-08 07:25:27.941+00	2026-06-30 00:00:00+00	2026-06-01 00:00:00+00	2026-06-30 00:00:00+00	5	2026-06-28 00:00:00+00	5	2026-06-28 00:00:00+00	5	2026-06-28 00:00:00+00	5	2026-06-28 00:00:00+00	0	2026-06-28 00:00:00+00	f
019fa348-6ad0-74e1-aa37-acf3bf1d5c9c	350	0	350	1	\N	1	1	2026-08-10 00:04:30.007+00	2026-08-10 00:04:30.007+00	2026-06-01 00:00:00+00	2026-06-30 00:00:00+00	1	2026-06-30 10:00:00+00	1	2026-06-30 10:00:00+00	1	2026-06-30 10:00:00+00	1	2026-06-30 10:00:00+00	150	2026-06-30 10:00:00+00	f
019fa348-6ad0-74be-b987-06e3bd247875	100	0	100	2	\N	2	2	2026-08-10 00:04:30.007+00	2026-08-10 00:04:30.007+00	2026-06-01 00:00:00+00	2026-06-30 00:00:00+00	2	2026-06-29 08:30:00+00	2	2026-06-29 08:30:00+00	2	2026-06-29 08:30:00+00	2	2026-06-29 08:30:00+00	40	2026-06-29 08:30:00+00	f
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_sessions (session_id, jti, user_id, refresh_token_hash, device_browser, device_os, device_type, ip_address, expires_at, created_at, last_used_at, revoked_at) FROM stdin;
019fa348-79f7-7c00-938d-43d494faa0d1	019fa348-79f7-75fc-a724-6fc511eae671	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	5e0ad8a36d855ba7972e588bdc35de67dec960f8538414e0c75b5a5d9635daee	\N	\N	desktop	::1	2026-08-03 11:14:23.865+00	2026-07-27 11:14:23.865854+00	2026-07-27 15:17:18.392+00	2026-07-27 15:17:18.392+00
019fa351-3ac4-747d-9fff-03afd0a7766d	019fa351-3ac4-71c7-a984-8e5d432a7fcb	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	bd07869ed2178bc47c32c9cf6bc75a145176e627f83bbafe96ca10d3aa10f429	\N	\N	desktop	::1	2026-08-03 11:23:57.509+00	2026-07-27 11:23:57.510268+00	2026-07-27 15:28:51.941+00	2026-07-27 15:28:51.941+00
019fa366-2227-7112-8d1c-e97be73fe776	019fa366-2227-753f-9357-210a65c9a212	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	21300430738674576a4d4b9aae1c7dd31da671b72645deecc1b5aae57429d753	\N	\N	desktop	::1	2026-08-03 11:46:47.465+00	2026-07-27 11:46:47.46581+00	2026-07-27 11:46:47.46581+00	2026-08-03 12:00:00.021+00
019fa374-a842-763f-9f0a-6e59f278ccf5	019fa374-a842-7d71-a47a-8bc7ce29d6f2	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	04695a190fd83b34174d1dcbb24d7a85f366e2c2f3fd072e2353be5d9b3fbab4	\N	\N	desktop	::1	2026-08-03 12:02:39.299+00	2026-07-27 12:02:39.299824+00	2026-07-27 12:02:39.299824+00	2026-08-04 03:00:00.017+00
019fa384-226b-7667-8913-f90c1347dfaf	019fa384-226b-7b0c-9950-7f32bad2aa30	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	150d8d72b58601a839d3382b419db681a78bf5910a6da684ca92650328ffa2c8	\N	\N	desktop	::1	2026-08-03 12:19:33.613+00	2026-07-27 12:19:33.613973+00	2026-07-27 12:19:33.613973+00	2026-08-04 03:00:00.017+00
019fa426-ddb6-7b19-81da-588acbfde57c	019fa426-ddb6-7c14-9d8a-81913596140d	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	6c0e8a02d32b1ddfc321435d810f6a2c83493a5fb51a6b636cfcd132ea5d4132	\N	\N	desktop	::1	2026-08-03 15:17:18.392+00	2026-07-27 15:17:18.393229+00	2026-07-27 15:17:18.393229+00	2026-08-04 03:00:00.017+00
019fa430-7f56-7547-823e-bfc90ba68ef2	019fa430-7f56-7e28-a322-199f47f1e226	019fa348-6ad0-74be-b987-06e3bd247875	44f06ee95d8992259c20fd3d20008f47607a4c743782815ce8287e556980026d	\N	\N	desktop	::1	2026-08-03 15:27:49.592+00	2026-07-27 15:27:49.593293+00	2026-07-27 15:27:49.593293+00	2026-08-04 03:00:00.017+00
019fa431-72e3-7611-bfef-20e0bddf5e4d	019fa431-72e3-7841-a7fa-76d182a0ff69	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	75e1fd733c50281889f9f9becfbf2bdaea8e6188ef2cc3d73ba7956003f4e79b	\N	\N	desktop	::1	2026-08-03 15:28:51.941+00	2026-07-27 15:28:51.941676+00	2026-07-27 15:28:51.941676+00	2026-08-04 03:00:00.017+00
019fa431-d16c-7ce9-83e1-c4898d83b48a	019fa431-d16c-739e-812d-73dfb81ccd84	019fa348-6ad0-74be-b987-06e3bd247875	7f200a40ec6f977b8f3c63a25023c829201a67e601207b3b319bfcf8df4793b7	\N	\N	desktop	::1	2026-08-03 15:29:16.141+00	2026-07-27 15:29:16.14215+00	2026-07-27 15:29:16.14215+00	2026-08-04 03:00:00.017+00
019fdc01-daf2-7c1a-aef8-9bb292e994be	019fdc01-daf2-7cb3-b1b9-3c1c0f2d6550	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	711b92721f29cf3a894d8b3204011c7ab3b86b6e589625329b5bd01d5235b66a	chrome	linux	desktop	::1	2026-08-14 11:35:36.949+00	2026-08-07 11:35:36.950526+00	2026-08-07 11:48:08.711+00	2026-08-07 11:48:08.711+00
019fdc03-4666-70f1-8ae9-1ff5747f64ea	019fdc03-4666-77bb-8c23-fc02cfba49f0	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	799df7c145becef26027770432ae0c1e042b5c305faa725093e00a7424d9fff9	chrome	linux	desktop	::1	2026-08-14 11:37:09.991+00	2026-08-07 11:37:09.992352+00	2026-08-08 06:22:00.815+00	2026-08-08 06:22:00.815+00
019fdc05-8245-70e6-9ee2-b4860aff338b	019fdc05-8245-7fb6-9dab-be09b1212c02	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	f2ffc03b4040ef3be098f82d1a73b943f1a492eb5d1f54264317f2153b7e4333	\N	\N	desktop	::1	2026-08-14 11:39:36.393+00	2026-08-07 11:39:36.394451+00	2026-08-08 06:28:07.782+00	2026-08-08 06:28:07.782+00
019fdc05-a62a-76db-bb69-154cbc34cd16	019fdc05-a62a-789d-9266-344e14ec3f15	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	f7a4b3707bd4e63e391ca1589252fb1e5515835d2a3c752748fc6be376eb774f	chrome	linux	desktop	::1	2026-08-14 11:39:45.579+00	2026-08-07 11:39:45.579587+00	2026-08-08 06:56:07.826+00	2026-08-08 06:56:07.826+00
019fe028-5690-740b-928c-782d2efd77fd	019fe028-5690-7535-8740-ea706b71bfe4	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	48774a0607c19f7df67ca0b1c5abd80c41b1d586828ecbf861d83e532fb3290f	chrome	linux	desktop	::1	2026-08-15 06:56:07.826+00	2026-08-08 06:56:07.826577+00	2026-08-08 07:09:38.104+00	2026-08-08 07:09:38.104+00
019fdc0a-2338-77dd-9cbc-df89c14124d8	019fdc0a-2338-70e8-93cd-539e1d0fa940	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	fd4b762b6345b8b4bdf90a97063dfdb1705718829c935ae2dd6789c433d65d04	chrome	linux	desktop	::1	2026-08-14 11:44:39.738+00	2026-08-07 11:44:39.738801+00	2026-08-08 07:46:32.769+00	2026-08-08 07:46:32.769+00
019fdc0d-5385-7376-bf72-74b7668ac200	019fdc29-5a5e-7899-ad18-c175e35e2138	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	4b3aaa3cf27e127b7156189578c3412a3d2a0ff46c20d6597f91fcd66c488c1e	chrome	linux	desktop	::1	2026-08-14 12:18:45.472+00	2026-08-07 11:48:08.711474+00	2026-08-08 07:46:43.935+00	2026-08-08 07:46:43.935+00
019fe009-1a6d-79d9-bb84-ffb1731cd967	019fe009-1a6d-7777-9d28-ccfe3ea8a359	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	a4d0c6e582a7d921ad2f62d1b3e783b339b274e7878f63e0f93039358a4cb52e	chrome	linux	desktop	::1	2026-08-15 06:22:00.815+00	2026-08-08 06:22:00.816071+00	2026-08-08 07:47:08.734+00	2026-08-08 07:47:08.734+00
019fe00e-b3e5-796b-97bf-42b77211bcf6	019fe027-d8ea-72b1-af64-5af144b595cb	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	a9d14e89652b023977eb4b138d97971543b57204ed0c5dd94343e5dd99cde4f4	chrome	linux	desktop	::1	2026-08-15 06:55:35.661+00	2026-08-08 06:28:07.783224+00	2026-08-08 07:47:41.564+00	2026-08-08 07:47:41.564+00
019fe036-e05e-7b61-9d9a-55d1075898ed	019fe054-7740-7c85-8d87-a29361577ffb	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	1fbd99fe21b80a95496ce04cc76e86ad291c7f12e32d19540095ce08093367c1	chrome	linux	desktop	::1	2026-08-15 07:44:19.777+00	2026-08-08 07:12:00.608769+00	2026-08-08 07:48:27.685+00	2026-08-08 07:48:27.685+00
019fe056-7ebf-7f30-b94f-4a23df96e310	019fe056-7ebf-73e4-8e69-56366e1bc15b	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	e1b0b5de0407b2b102d983f6630c87437b64329d396d29673870292780d6f335	\N	\N	desktop	::1	2026-08-15 07:46:32.769+00	2026-08-08 07:46:32.773222+00	2026-08-08 07:49:16.084+00	2026-08-08 07:49:16.084+00
019fe056-aa5d-7f14-8e29-6160ca1a476c	019fe056-aa5d-7faf-a2fd-42b51542c3dc	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	e486b1fd5b91a364c25aaf075446e840a638359c5e35193be99ac28adb6b38bb	\N	\N	desktop	::1	2026-08-15 07:46:43.935+00	2026-08-08 07:46:43.935788+00	2026-08-08 07:49:38.614+00	2026-08-08 07:49:38.614+00
019fe057-0b3c-7fcf-827b-d4e723d1d091	019fe057-0b3c-743f-96fd-aefd0d710b25	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	43d0bd95f24d9a4ae47dcf2c0dffcd38532891d336a621c9adf33dac49277d18	\N	\N	desktop	::1	2026-08-15 07:47:08.734+00	2026-08-08 07:47:08.735135+00	2026-08-08 07:50:26.765+00	2026-08-08 07:50:26.765+00
019fe057-8b7a-76b0-af59-6e5a03e397bb	019fe057-8b7a-7140-83ea-d22e8da05394	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	0a74e2ea2ed480b261ba450b029a6f1a09cbf847ab7e11bb7bd2722d1245461a	\N	\N	desktop	::1	2026-08-15 07:47:41.564+00	2026-08-08 07:47:41.564462+00	2026-08-08 07:50:42.541+00	2026-08-08 07:50:42.541+00
019fe058-3fa4-78f4-b434-e08ec15eacdd	019fe058-3fa4-7207-aa4f-1f41dd8a9d2b	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	86a4c146433a11db70c0bd2b58a689e546ef0d5492de114613d0b3c6bfe6f566	\N	\N	desktop	::1	2026-08-15 07:48:27.685+00	2026-08-08 07:48:27.685419+00	2026-08-08 07:51:17.231+00	2026-08-08 07:51:17.231+00
019fe058-fcb3-796c-9a9e-64da4dec08fb	019fe058-fcb3-7fbf-875e-717bbe15bdee	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	e915b317aac43c9f42ddde7041b9e8f203b10ff136a78317acf11b689a483cc2	\N	\N	desktop	::1	2026-08-15 07:49:16.084+00	2026-08-08 07:49:16.085052+00	2026-08-08 07:52:03.62+00	2026-08-08 07:52:03.62+00
019fe059-54b4-70fb-88eb-fee28634b8db	019fe059-54b4-7898-b387-b81e0aefb8ce	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	de1bf9a21120f79dede7b05c7828c2d81227ed24faa04e14fb628220edb34cdd	\N	\N	desktop	::1	2026-08-15 07:49:38.614+00	2026-08-08 07:49:38.614765+00	2026-08-08 07:52:09.147+00	2026-08-08 07:52:09.147+00
019fe05a-10cc-70e9-ae4c-fa12a60fad54	019fe05a-10cc-7f98-9561-1b1887ffce6f	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	2d69550d6695219611c8f807153666393acf12a9785066a496882f6c4f34c316	\N	\N	desktop	::1	2026-08-15 07:50:26.765+00	2026-08-08 07:50:26.765495+00	2026-08-08 07:52:21.388+00	2026-08-08 07:52:21.388+00
019fe05a-4e6c-7498-8bcb-ac9e581fd888	019fe05a-4e6c-764c-b9ca-f63531c5bb32	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	c9e9d0e59ac8f114b6d11ea4cfcc7aa8590effe07fe0a2bc536a4a625dcadb5a	\N	\N	desktop	::1	2026-08-15 07:50:42.541+00	2026-08-08 07:50:42.54226+00	2026-08-08 07:52:39.908+00	2026-08-08 07:52:39.908+00
019fe05a-d5ee-7d6c-b412-d83d9f758767	019fe05a-d5ee-7c09-9163-68a9f4ab9ece	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	dc8300b920d377201e66b77a0bd1887249d9960c6a34e48845e2b4a3f10d358f	\N	\N	desktop	::1	2026-08-15 07:51:17.231+00	2026-08-08 07:51:17.231608+00	2026-08-08 07:53:27.764+00	2026-08-08 07:53:27.764+00
019fe05b-8b23-78c9-a202-d31e993134b2	019fe05b-8b23-7852-aa42-c4602896b53c	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	7d1d924cd714e49e063c42f9ab4dde9d87073d778503c2b1bfb66edc4d0186ed	\N	\N	desktop	::1	2026-08-15 07:52:03.62+00	2026-08-08 07:52:03.620751+00	2026-08-08 07:53:48.198+00	2026-08-08 07:53:48.198+00
019fe05b-a0bb-716b-a42b-ccddd2a11106	019fe05b-a0bb-750a-994c-7bf0b03bd315	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	68d303082b5a97696edf9d720c3323b833303f8178486864bb4877f09b974759	\N	\N	desktop	::1	2026-08-15 07:52:09.147+00	2026-08-08 07:52:09.148194+00	2026-08-08 07:55:47.795+00	2026-08-08 07:55:47.795+00
019fe05b-d08b-772a-b529-cb066fd006cc	019fe05b-d08b-711d-8bfc-d95b0ed552bb	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	f5ecf1edb3d0dcf9e17e79c9e62b232c66d3b58ec8518f21b1be3bb4b0edd3eb	\N	\N	desktop	::1	2026-08-15 07:52:21.388+00	2026-08-08 07:52:21.388647+00	2026-08-08 07:56:08.067+00	2026-08-08 07:56:08.067+00
019fe05c-18e3-7165-9112-381256c55ea6	019fe05c-18e3-7a96-aeff-50bd112dfd03	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	4301d5f3cdc162528b764dd47b98ead224419e21a03a16596a7c74c9d05a0c23	\N	\N	desktop	::1	2026-08-15 07:52:39.908+00	2026-08-08 07:52:39.908422+00	2026-08-08 07:56:53.372+00	2026-08-08 07:56:53.372+00
019fe05c-d3d2-77ed-b268-667dbc2f0c33	019fe05c-d3d2-78af-a076-a88b421e5a8b	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	d23d4c7a80157d246da540f71c69a792cdc13c7f755c8f4b6ce9c108bc5d35a4	\N	\N	desktop	::1	2026-08-15 07:53:27.764+00	2026-08-08 07:53:27.764375+00	2026-08-08 07:57:30.035+00	2026-08-08 07:57:30.035+00
019fe05d-23a5-77da-b53a-85a497a9640d	019fe05d-23a5-7dcd-9a00-38c9e4e4488a	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	625b69b82cfe5b753cf8231637c35f7a42650c2a780327a720c15f520716027a	\N	\N	desktop	::1	2026-08-15 07:53:48.198+00	2026-08-08 07:53:48.198955+00	2026-08-08 08:08:21.839+00	2026-08-08 08:08:21.839+00
019fe05e-f6d1-763d-92a2-0df444a7dc69	019fe05e-f6d1-7e68-94bb-500f2641b2ba	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	c7ed815bcfc9d65d41cdd872fc1a9a63a73801e155288665110d99e3c4b12959	\N	\N	desktop	::1	2026-08-15 07:55:47.795+00	2026-08-08 07:55:47.795414+00	2026-08-08 08:08:21.839+00	2026-08-08 08:08:21.839+00
019fe05f-4602-720e-bc5e-79b3b511b0c0	019fe05f-4602-7ee0-9c58-e18a9ae763c1	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	2b80752a9302f381b3a8c87864cf648f188b7fcd21b667bbd0499d7bccef4817	\N	\N	desktop	::1	2026-08-15 07:56:08.067+00	2026-08-08 07:56:08.068234+00	2026-08-08 08:08:21.839+00	2026-08-08 08:08:21.839+00
019fe05f-f6fb-7d5b-82ef-ac718ec7e64e	019fe05f-f6fb-7da5-abb0-6aa8713f7177	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	d57e02a742ce0c8a878c2865b0dbabaa3949a24783ad6859fff34eabc9a578d4	\N	\N	desktop	::1	2026-08-15 07:56:53.372+00	2026-08-08 07:56:53.37275+00	2026-08-08 08:08:21.839+00	2026-08-08 08:08:21.839+00
019fe060-8632-76f6-9db1-acae0a4ba345	019fe060-8632-779d-8d92-4f1f9d8fbe7d	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	19d9da3c31f9c8505e1336c5e55b4f3def9abdedf9924c8f7ce829c32bf906e8	\N	\N	desktop	::1	2026-08-15 07:57:30.035+00	2026-08-08 07:57:30.03617+00	2026-08-08 08:08:21.839+00	2026-08-08 08:08:21.839+00
019fe07b-87db-7ddf-92c9-c168f4e4441c	019fe1e0-7636-78e5-88b7-6f9d32815628	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	91ef495c218768ae7f34760577524fd3748d038fb53aeb311c622ccfc4d00ec5	chrome	linux	desktop	::1	2026-08-15 14:56:51.768+00	2026-08-08 08:26:59.932765+00	2026-08-08 15:07:42.187+00	2026-08-08 15:07:42.187+00
019fe1e2-f71b-74b2-876c-90c5b2cc6114	019fe1e2-f71b-7436-89fe-b0ecde0ba7e2	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	dbebff0a0afc4b5927c39467bacdeb27b276ff52bc19c30fa44e8352f415a628	\N	\N	desktop	::1	2026-08-15 14:59:35.837+00	2026-08-08 14:59:35.838207+00	2026-08-08 15:10:43.242+00	2026-08-08 15:10:43.242+00
019fe1e5-f0a7-739c-8b6e-bd4aee20354d	019fe1e5-f0a7-7e48-ba35-4c332dc1f773	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	741dcd62817137143d0978744f588720a2378fc86609974c754e819c39e4daf9	\N	\N	desktop	::1	2026-08-15 15:02:50.792+00	2026-08-08 15:02:50.792288+00	2026-08-08 15:21:50.068+00	2026-08-08 15:21:50.068+00
019fe1eb-eb5d-7bb1-9867-3a9f49a3ccf0	019fe1eb-eb5d-70f4-9f6a-f3fb90743847	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	23ad13b47eeef11bdb744091a5603cb8ae46d0acb6a49cbe139ec0d8168cc6d4	\N	\N	desktop	::1	2026-08-15 15:09:22.654+00	2026-08-08 15:09:22.654909+00	2026-08-08 15:26:09.223+00	2026-08-08 15:26:09.223+00
019fe1ed-001e-7c3a-8bcd-57b3f0a4f5f9	019fe1ed-001e-70de-882a-34073b1fbd4e	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	2b18e608969bb95151ce0c3030c0c9013d9491e8aa7e338ddef5c747c6351a02	\N	\N	desktop	::1	2026-08-15 15:10:33.504+00	2026-08-08 15:10:33.504681+00	2026-08-08 15:27:22.49+00	2026-08-08 15:27:22.49+00
019fe1ed-2629-794c-b847-4812526ec0ba	019fe1ed-2629-7833-8bd6-ade7b2950449	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	a10ff617e0899d6cc6bf9cae7052246199f98a9f2bc8d191e8832c93a4c9d375	\N	\N	desktop	::1	2026-08-15 15:10:43.242+00	2026-08-08 15:10:43.24243+00	2026-08-08 15:28:17.693+00	2026-08-08 15:28:17.693+00
019fe1f7-52f3-7c04-8e50-911fff9c4334	019fe1f7-52f3-725f-bf6d-12b1fd135f1a	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	bb4a76cf7ec303a33b268cba180ea66ba346f224c397787972c37356b16a87a7	\N	\N	desktop	::1	2026-08-15 15:21:50.068+00	2026-08-08 15:21:50.06891+00	2026-08-08 15:30:36.165+00	2026-08-08 15:30:36.165+00
019fe1ea-a872-7823-8af8-f9552674f39d	019fe1f9-25a4-74ff-bccd-c6395245c608	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	d36a17e4f766ea285b37fdf9aeff6dd905ce1aa5fcf14d45d3ba6d431063eeab	chrome	linux	desktop	::1	2026-08-15 15:23:49.542+00	2026-08-08 15:07:59.987839+00	2026-08-08 15:31:17.436+00	2026-08-08 15:31:17.436+00
019fe1fb-4746-7901-b911-35d2dc5a1cfd	019fe1fb-4746-7a39-99e9-2d403e240cc3	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	b38a65acfd3c41bd948cc9d843c8c283495d1e9ef052d0443571833d4f5e0c9e	\N	\N	desktop	::1	2026-08-15 15:26:09.223+00	2026-08-08 15:26:09.223719+00	2026-08-08 15:33:52.499+00	2026-08-08 15:33:52.499+00
019fe1fc-6579-76b0-bdd6-c2a4cfaad1ea	019fe1fc-6579-76ae-9f2c-db54026cfed1	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	0ed37cee90475f810340f34baa7d97f301dc05e783b47d143245251ea1ad589f	\N	\N	desktop	::1	2026-08-15 15:27:22.49+00	2026-08-08 15:27:22.491003+00	2026-08-08 15:51:46.837+00	2026-08-08 15:51:46.837+00
019fe1fd-3d1c-7572-a2fa-c552bdf7b19a	019fe1fd-3d1c-77a9-9987-d25be75b9274	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	6144e5579132f55aa8f13714f41e2485dcd9a653b36483d8268d89e292fed2a3	\N	\N	desktop	::1	2026-08-15 15:28:17.693+00	2026-08-08 15:28:17.694082+00	2026-08-08 15:51:46.837+00	2026-08-08 15:51:46.837+00
019fe1ff-5a03-7ebc-9a84-9eb97639dbce	019fe1ff-5a03-7cce-a0bd-c3d70de7cb36	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	bb46bec3c58103308070ba2887f45b17126b19522f0d0da780d81f7ae771803e	\N	\N	desktop	::1	2026-08-15 15:30:36.165+00	2026-08-08 15:30:36.165588+00	2026-08-08 15:51:46.837+00	2026-08-08 15:51:46.837+00
019fe1ff-fb3b-7a8b-a687-f5b0ee4b87a8	019fe1ff-fb3b-7c4c-9df6-1575d9eba7cb	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	0e5a6897b55cfd171ef452ae3c2c35532e4752bc4457585df8e3e03161b6927f	\N	\N	desktop	::1	2026-08-15 15:31:17.436+00	2026-08-08 15:31:17.43672+00	2026-08-08 15:51:46.837+00	2026-08-08 15:51:46.837+00
019fe202-58f3-7324-a578-a071bd3900ef	019fe202-58f3-7ec1-ac95-e00286a620ec	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	ec7afd5be46d2ffbaf061d7535569f8dc6eccc4ef02eb69599ab6901f731a950	\N	\N	desktop	::1	2026-08-15 15:33:52.499+00	2026-08-08 15:33:52.500032+00	2026-08-08 15:51:46.837+00	2026-08-08 15:51:46.837+00
019fe212-fa77-702f-ae48-d4643d9bf9ef	019fe99d-fde6-77d8-bfd8-824ac0566a74	019fa348-6ad0-719b-a10b-b2ce0d6bfa62	2c752e93be81f8be62b9245043b531d75894cba749be1f81ed23dc35d135c317	chrome	linux	desktop	::1	2026-08-17 03:01:13.319+00	2026-08-08 15:52:02.424302+00	2026-08-10 03:01:13.315+00	\N
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: -
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 2, true);


--
-- Name: __drizzle_migrations___id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.__drizzle_migrations___id_seq', 1, false);


--
-- Name: quiz_attempt_events_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.quiz_attempt_events_event_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--

\unrestrict F5Y4bm2EeOOBLw1Xzs6Q4lWhIkWv5AjOP9Nk3rCOaVtmfvafpvghfmB3Yzwy3m7

