/** Parse a base server address without guessing away credentials, query or page fragments. */
export function parseServerUrl(value: unknown, message: string): Readonly<{ href: string; pathname: string }> {
  if (typeof value !== "string") throw new Error(message);
  const text = value.trim();
  if (!/^https?:\/\/[^/]/i.test(text) || /[\\\u0000-\u0020\u007f]/.test(text) || /[?#]/.test(text)) {
    throw new Error(message);
  }
  let url: URL;
  try {
    url = new URL(text);
    decodeURIComponent(url.pathname);
  } catch {
    throw new Error(message);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(message);
  }
  url.pathname = url.pathname.replace(/\/+$/, "") + "/";
  // WHATWG serialization erases default ports; retain explicit configuration separately.
  const authority = text.slice(text.indexOf("://") + 3).split("/", 1)[0]!;
  const port = authority.match(/:(\d+)$/)?.[1];
  return {
    href: `${url.protocol}//${url.hostname}${port === undefined ? "" : `:${port}`}${url.pathname}`,
    pathname: url.pathname,
  };
}

/** The one sentence about token input, shown before the interactive prompt. */
export const tokenInputHelp = "Paste only the token value, without Bearer or quotes.";

/** Bearer input only: never apply URL rules or remove characters inside a token. */
export function normalizeBearerToken(value: string): string {
  const token = value.trim();
  if (!token) throw new Error("Token must not be empty or whitespace-only.");
  if (/^(?:Bearer(?:\s|$)|Authorization\s*:)/i.test(token) ||
      /^["'\u201c\u2018]|["'\u201d\u2019]$/.test(token) || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new Error("Invalid token format: paste only the token value, without Bearer, Authorization: or quotes.");
  }
  return token;
}
