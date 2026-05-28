export type UpdateProfileCommand = {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
};

export type UpdateSettingsCommand = {
  settings: Record<string, unknown>;
};
