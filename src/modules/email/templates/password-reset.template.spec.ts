import { renderPasswordResetEmail } from './password-reset.template';

describe('renderPasswordResetEmail', () => {
  const baseInput = {
    fromName: 'Acme Support',
    resetUrl: 'https://example.com/reset?token=xyz',
    ttlSeconds: 3_600,
  };

  it('returns a password-reset subject and HTML body', () => {
    const { subject, html } = renderPasswordResetEmail(baseInput);
    expect(subject).toBe('Reset your password');
    expect(html).toContain('<!doctype html>');
  });

  it('embeds the formatted TTL in the body', () => {
    const { html } = renderPasswordResetEmail({ ...baseInput, ttlSeconds: 1_800 });
    expect(html).toContain('30 minutes');
  });

  it('embeds the reset URL twice (button + fallback link)', () => {
    const { html } = renderPasswordResetEmail(baseInput);
    const occurrences = html.split(baseInput.resetUrl).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('escapes user-controlled fromName to prevent HTML injection', () => {
    const { html } = renderPasswordResetEmail({
      ...baseInput,
      fromName: '"><img src=x>',
    });
    expect(html).not.toContain('"><img src=x>');
    expect(html).toContain('&quot;&gt;&lt;img src=x&gt;');
  });
});
