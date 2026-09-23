import { renderVerificationEmail } from './verification.template';

describe('renderVerificationEmail', () => {
  const baseInput = {
    fromName: 'Acme Support',
    verificationUrl: 'https://example.com/verify?token=abc',
    ttlSeconds: 3_600,
  };

  it('returns a verification subject and HTML body', () => {
    const { subject, html } = renderVerificationEmail(baseInput);
    expect(subject).toBe('Verify your email');
    expect(html).toContain('<!doctype html>');
  });

  it('embeds the formatted TTL in the body', () => {
    const { html } = renderVerificationEmail({ ...baseInput, ttlSeconds: 60 });
    expect(html).toContain('1 minute');
  });

  it('embeds the verification URL twice (button + fallback link)', () => {
    const { html } = renderVerificationEmail(baseInput);
    const occurrences = html.split(baseInput.verificationUrl).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('escapes user-controlled fromName to prevent HTML injection', () => {
    const { html } = renderVerificationEmail({
      ...baseInput,
      fromName: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes the verification URL on both occurrences', () => {
    const { html } = renderVerificationEmail({
      ...baseInput,
      verificationUrl: 'https://example.com/verify?token=abc&x="y"',
    });
    expect(html).toContain('https://example.com/verify?token=abc&amp;x=&quot;y&quot;');
    expect(html).not.toMatch(/href="https:\/\/example\.com\/verify\?token=abc&x="y""/);
  });
});
