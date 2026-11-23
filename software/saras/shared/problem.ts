// Something the server reports: a code the translation files may know, its parameters, and its English text.
export interface Problem {
  code: string;
  params: Record<string, string | number>;
  message: string;
}
