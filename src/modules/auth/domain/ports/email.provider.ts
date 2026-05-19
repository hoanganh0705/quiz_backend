// Re-export from shared location — the interface lives in common/ports
// to avoid circular dependency (module → module).
export { type EmailProvider, EMAIL_PROVIDER } from '@/common/ports/email.provider';
