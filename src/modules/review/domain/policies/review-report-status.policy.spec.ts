/// <reference types="jest" />
import { ReviewReportStatusPolicy } from './review-report-status.policy';

describe('ReviewReportStatusPolicy — Phase 2 / Issue #38 (state machine)', () => {
  it('allows the only legal open → reviewed transition', () => {
    expect(ReviewReportStatusPolicy.canTransition('open', 'reviewed')).toBe(true);
  });

  it('allows the only legal open → dismissed transition', () => {
    expect(ReviewReportStatusPolicy.canTransition('open', 'dismissed')).toBe(true);
  });

  it('allows the only legal open → actioned transition', () => {
    expect(ReviewReportStatusPolicy.canTransition('open', 'actioned')).toBe(true);
  });

  it('rejects any transition out of reviewed (terminal)', () => {
    expect(ReviewReportStatusPolicy.canTransition('reviewed', 'open')).toBe(false);
    expect(ReviewReportStatusPolicy.canTransition('reviewed', 'dismissed')).toBe(false);
    expect(ReviewReportStatusPolicy.canTransition('reviewed', 'actioned')).toBe(false);
  });

  it('rejects any transition out of dismissed (terminal)', () => {
    expect(ReviewReportStatusPolicy.canTransition('dismissed', 'open')).toBe(false);
    expect(ReviewReportStatusPolicy.canTransition('dismissed', 'reviewed')).toBe(false);
    expect(ReviewReportStatusPolicy.canTransition('dismissed', 'actioned')).toBe(false);
  });

  it('rejects any transition out of actioned (terminal)', () => {
    expect(ReviewReportStatusPolicy.canTransition('actioned', 'open')).toBe(false);
    expect(ReviewReportStatusPolicy.canTransition('actioned', 'reviewed')).toBe(false);
    expect(ReviewReportStatusPolicy.canTransition('actioned', 'dismissed')).toBe(false);
  });

  it('rejects self-transition to avoid polluting the audit log with redundant writes', () => {
    expect(ReviewReportStatusPolicy.canTransition('open', 'open')).toBe(false);
    expect(ReviewReportStatusPolicy.canTransition('reviewed', 'reviewed')).toBe(false);
    expect(ReviewReportStatusPolicy.canTransition('dismissed', 'dismissed')).toBe(false);
    expect(ReviewReportStatusPolicy.canTransition('actioned', 'actioned')).toBe(false);
  });

  it('flags reviewed, dismissed, and actioned as terminal', () => {
    expect(ReviewReportStatusPolicy.isTerminal('reviewed')).toBe(true);
    expect(ReviewReportStatusPolicy.isTerminal('dismissed')).toBe(true);
    expect(ReviewReportStatusPolicy.isTerminal('actioned')).toBe(true);
  });

  it('does not flag open as terminal', () => {
    expect(ReviewReportStatusPolicy.isTerminal('open')).toBe(false);
  });
});
