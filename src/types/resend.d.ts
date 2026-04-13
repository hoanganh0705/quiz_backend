import 'resend';

declare module 'resend' {
  interface PostOptions {
    signal?: AbortSignal;
  }
}
