import { NotFoundException } from '@nestjs/common';
import { SupportService } from './support.service';

describe('SupportService', () => {
  let service: SupportService;

  beforeEach(() => {
    service = new SupportService();
  });

  describe('getFaqs', () => {
    it('returns FAQ categories with items', () => {
      const categories = service.getFaqs();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      const general = categories.find((c) => c.id === 'general');
      expect(general).toBeDefined();
      expect(general?.faqs.length).toBeGreaterThan(0);
    });
  });

  describe('getArticles', () => {
    it('returns support articles', () => {
      const articles = service.getArticles();
      expect(Array.isArray(articles)).toBe(true);
      expect(articles.length).toBeGreaterThanOrEqual(12);
      expect(articles[0]).toHaveProperty('slug');
      expect(articles[0]).toHaveProperty('title');
    });
  });

  describe('getArticleBySlug', () => {
    it('returns an article when slug matches', () => {
      const article = service.getArticleBySlug('getting-started-with-quizhub');
      expect(article.title).toBe('Getting Started with QuizHub');
    });

    it('throws NotFoundException when slug does not exist', () => {
      expect(() => service.getArticleBySlug('non-existent-slug')).toThrow(NotFoundException);
    });
  });

  describe('submitContact', () => {
    it('generates a ticketId and returns a confirmation message', () => {
      const res = service.submitContact({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Need help with scoring',
        category: 'technical',
        message: 'My score was not saved after completing quiz 1.',
      });
      expect(res.ticketId).toBeDefined();
      expect(res.message).toContain('Jane Doe');
      expect(res.message).toContain('jane@example.com');
    });
  });
});
