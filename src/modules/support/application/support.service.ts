import { Injectable, NotFoundException } from '@nestjs/common';
import { generateUuidV7 } from '@/common/utils/id-generator';
import {
  ContactFormDto,
  ContactFormResponseDto,
  FaqCategoryDto,
  SupportArticleDto,
} from '../dto/support.dto';

const FAQ_DATA: FaqCategoryDto[] = [
  {
    id: 'general',
    title: 'General',
    faqs: [
      {
        id: 'what-is-quizhub',
        question: 'What is QuizHub?',
        answer:
          'QuizHub is an interactive multiplayer quiz and learning platform where users can play quizzes, compete in live tournaments, track global rankings, and earn achievements.',
      },
      {
        id: 'how-to-get-started',
        question: 'How do I get started?',
        answer:
          'Simply sign up for an account, verify your email, and start exploring thousands of quizzes across diverse categories, or jump right into a live tournament.',
      },
      {
        id: 'mobile-availability',
        question: 'Is QuizHub available on mobile devices?',
        answer:
          'Yes! QuizHub is fully responsive and optimized for mobile and tablet browsers.',
      },
      {
        id: 'educational-use',
        question: 'Can I use QuizHub for classrooms or training?',
        answer:
          'QuizHub can be used by educators, study groups, and organizations to create private quizzes, review leaderboards, and monitor participant learning progression.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & Profile',
    faqs: [
      {
        id: 'how-to-reset-password',
        question: 'How do I reset my password?',
        answer:
          'Go to the login screen and click "Forgot password?". Enter your account email to receive a secure password-reset link.',
      },
      {
        id: 'change-username-or-avatar',
        question: 'Can I customize my profile and avatar?',
        answer:
          'Yes, navigate to your Profile or Settings page. You can upload an avatar image, edit your bio, and equip custom badges or flairs you have unlocked.',
      },
      {
        id: 'delete-account',
        question: 'How do I delete my account?',
        answer:
          'In Settings > Account, you can request account deletion. All personal data will be scheduled for soft deletion according to privacy standards.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Plans',
    faqs: [
      {
        id: 'pricing-and-tiers',
        question: 'Is QuizHub free or paid?',
        answer:
          'QuizHub is free to play for everyone. We also offer premium features, custom cosmetics, and advanced tournament analytics.',
      },
      {
        id: 'quiz-coins',
        question: 'What are Quiz Coins used for?',
        answer:
          'Coins can be earned through tournaments, daily challenges, and streak achievements. They can be redeemed for avatar cosmetics and exclusive flairs.',
      },
    ],
  },
  {
    id: 'quiz-creation',
    title: 'Quiz Creation',
    faqs: [
      {
        id: 'create-quiz-steps',
        question: 'How do I create a new quiz?',
        answer:
          'Click the "Create Quiz" button in the navigation header. Provide a title, choose a category, add optional tags, and construct multiple-choice questions with answers and explanations.',
      },
      {
        id: 'quiz-visibility',
        question: 'Can I make my quiz private?',
        answer:
          'Yes. Quizzes can be saved as drafts, published publicly to the discovery catalogue, or shared via direct link with invited participants.',
      },
    ],
  },
  {
    id: 'tournaments',
    title: 'Tournaments',
    faqs: [
      {
        id: 'how-tournaments-work',
        question: 'How do tournaments work?',
        answer:
          'Tournaments are multi-player competitive events that run across scheduled rounds. Scores and response times dictate your position on the tournament leaderboard.',
      },
      {
        id: 'tournament-registration',
        question: 'How do I enter a tournament?',
        answer:
          'Browse the Tournaments page, select an upcoming or open tournament, and click "Join". Make sure you are present before the countdown concludes.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    faqs: [
      {
        id: 'data-privacy',
        question: 'How is my data protected?',
        answer:
          'We use industry-standard encryption, strict JWT session revocation, and security cookies to safeguard your account information.',
      },
      {
        id: 'blocking-reporting',
        question: 'How do I report or block abusive users?',
        answer:
          'You can block or report any user directly from their public profile or comment actions. Reports are routed to the moderation audit queue.',
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical Issues',
    faqs: [
      {
        id: 'quiz-connection-lost',
        question: 'What should I do if my quiz attempt disconnects?',
        answer:
          'Your in-progress attempt state is recorded on the server. If you disconnect briefly, refresh the page to reconnect to your session before the timer expires.',
      },
      {
        id: 'report-bug',
        question: 'Where can I report technical bugs or glitches?',
        answer:
          'Submit a ticket using the "Contact Support" tab on this page with category "Technical Issues", and our team will investigate.',
      },
    ],
  },
];

const ARTICLES_DATA: SupportArticleDto[] = [
  {
    id: '1',
    category: 'General',
    title: 'Getting Started with QuizHub',
    excerpt: 'Everything you need to know to begin your journey on our platform.',
    readTime: '5 min read',
    icon: 'book-open',
    slug: 'getting-started-with-quizhub',
    content:
      'Welcome to QuizHub! This guide walks you through finding quizzes, competing in tournaments, tracking your mastery stats, and configuring your account settings.',
    tags: ['beginner', 'setup', 'introduction'],
    updatedAt: '2026-08-01',
    difficulty: 'Beginner',
  },
  {
    id: '2',
    category: 'Account',
    title: 'Complete Account Setup Guide',
    excerpt: 'Learn how to set up your account, customize your profile, and configure your preferences.',
    readTime: '5 min read',
    icon: 'user',
    slug: 'complete-account-setup-guide',
    content:
      'Step-by-step account setup instructions covering avatar uploads, email verification, two-factor safety, and public profile privacy controls.',
    tags: ['account', 'profile', 'settings'],
    updatedAt: '2026-07-28',
    difficulty: 'Beginner',
  },
  {
    id: '3',
    category: 'Billing',
    title: 'Managing Your Subscription',
    excerpt: 'Learn how to upgrade, downgrade, or cancel your subscription plan.',
    readTime: '4 min read',
    icon: 'credit-card',
    slug: 'managing-your-subscription',
    content:
      'A comprehensive guide to billing cycles, managing subscription tiers, viewing coin transactions, and downloading past invoices.',
    tags: ['billing', 'subscription', 'payment'],
    updatedAt: '2026-07-20',
    difficulty: 'Beginner',
  },
  {
    id: '4',
    category: 'Quiz creation',
    title: 'Quiz Creation Basics',
    excerpt: 'A step-by-step guide to creating your first quiz from scratch.',
    readTime: '5 min read',
    icon: 'plus-circle',
    slug: 'quiz-creation-basics',
    content:
      'Learn the fundamentals of quiz creation: choosing engaging questions, defining correct options, adding explanations, and selecting the most fitting categories.',
    tags: ['quiz', 'creation', 'basics'],
    updatedAt: '2026-08-05',
    difficulty: 'Beginner',
  },
  {
    id: '5',
    category: 'Tournaments',
    title: 'Creating Your First Tournament',
    excerpt: 'Learn how to set up, configure, and launch a successful quiz tournament.',
    readTime: '6 min read',
    icon: 'trophy',
    slug: 'creating-your-first-tournament',
    content:
      'Configure participant limits, scheduled start times, round transitions, and prize pools for an unforgettable tournament experience.',
    tags: ['tournament', 'competition', 'setup'],
    updatedAt: '2026-07-15',
    difficulty: 'Intermediate',
  },
  {
    id: '6',
    category: 'Privacy',
    title: 'Understanding Privacy Settings',
    excerpt: 'A comprehensive guide to all privacy options available on the platform.',
    readTime: '5 min read',
    icon: 'shield',
    slug: 'understanding-privacy-settings',
    content:
      'Learn how to adjust who can search your profile, view your quiz attempts, challenge you to matches, or comment on your submissions.',
    tags: ['privacy', 'security', 'settings'],
    updatedAt: '2026-06-30',
    difficulty: 'Beginner',
  },
  {
    id: '7',
    category: 'Quiz creation',
    title: 'Advanced Quiz Features',
    excerpt: 'Explore advanced features like timers, multimedia questions, and custom scoring.',
    readTime: '8 min read',
    icon: 'settings',
    slug: 'advanced-quiz-features',
    content:
      'Deep dive into timer penalization, weighted points, multimedia asset embedding, and anti-cheat randomization options.',
    tags: ['quiz', 'advanced', 'features'],
    updatedAt: '2026-07-10',
    difficulty: 'Advanced',
  },
  {
    id: '8',
    category: 'Account',
    title: 'Profile Customization Guide',
    excerpt: 'Learn how to personalize your profile with avatars, bio, and social links.',
    readTime: '3 min read',
    icon: 'user',
    slug: 'profile-customization-guide',
    content:
      'Showcase your accomplishments! Equip earned badges, show off your win rate, and connect with fellow quiz enthusiasts.',
    tags: ['profile', 'customization', 'personalization'],
    updatedAt: '2026-06-18',
    difficulty: 'Beginner',
  },
  {
    id: '9',
    category: 'Tournaments',
    title: 'Tournament Moderation Tools',
    excerpt: 'Master the tools available for moderating and managing tournament participants.',
    readTime: '7 min read',
    icon: 'shield',
    slug: 'tournament-moderation-tools',
    content:
      'Organizers can review live participant standings, disqualify disruptive players, and maintain a competitive, fair environment.',
    tags: ['tournament', 'moderation', 'management'],
    updatedAt: '2026-05-22',
    difficulty: 'Advanced',
  },
  {
    id: '10',
    category: 'Billing',
    title: 'Understanding Pricing Plans',
    excerpt: 'Compare different pricing tiers and find the plan that best suits your needs.',
    readTime: '4 min read',
    icon: 'credit-card',
    slug: 'understanding-pricing-plans',
    content:
      'Detailed overview of free vs premium features, coin bundles, and volume educator plans.',
    tags: ['pricing', 'plans', 'comparison'],
    updatedAt: '2026-07-01',
    difficulty: 'Beginner',
  },
  {
    id: '11',
    category: 'General',
    title: 'Mobile App Features',
    excerpt: 'Discover all the features available in our mobile application.',
    readTime: '6 min read',
    icon: 'book-open',
    slug: 'mobile-app-features',
    content:
      'Play on the go! Enjoy haptic quiz feedbacks, push notifications for daily challenges, and offline draft question caching.',
    tags: ['mobile', 'app', 'features'],
    updatedAt: '2026-06-10',
    difficulty: 'Beginner',
  },
  {
    id: '12',
    category: 'Privacy',
    title: 'Data Export and Deletion',
    excerpt: 'Learn how to export your data or permanently delete your account.',
    readTime: '4 min read',
    icon: 'shield',
    slug: 'data-export-and-deletion',
    content:
      'Exercise your data privacy rights: request a machine-readable export of all your attempts, questions, and achievements, or request permanent deletion.',
    tags: ['data', 'export', 'deletion', 'gdpr'],
    updatedAt: '2026-08-10',
    difficulty: 'Intermediate',
  },
];

@Injectable()
export class SupportService {
  getFaqs(): FaqCategoryDto[] {
    return FAQ_DATA;
  }

  getArticles(): SupportArticleDto[] {
    return ARTICLES_DATA;
  }

  getArticleBySlug(slug: string): SupportArticleDto {
    const article = ARTICLES_DATA.find((a) => a.slug === slug);
    if (!article) {
      throw new NotFoundException(`Article with slug '${slug}' not found`);
    }
    return article;
  }

  submitContact(dto: ContactFormDto): ContactFormResponseDto {
    const ticketId = generateUuidV7();
    return {
      message: `Thank you for contacting QuizHub support, ${dto.name}. Your ticket has been received and our team will follow up via ${dto.email} shortly.`,
      ticketId,
    };
  }
}
