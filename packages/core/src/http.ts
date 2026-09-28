import { CliError, diagnosticCause, rememberSecret } from "./errors.js";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

/** The classified reason; the native detail follows it on the rendered cause line. */
function requestFailure(cause: Error): { code: string; message: string } {
  for (let error: Error | undefined = cause; error; error = error.cause instanceof Error ? error.cause : undefined) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return { code: "request.dns", message: "The server name could not be resolved; check the URL and DNS." };
    if (/CERT|^ERR_TLS|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)) return { code: "request.tls", message: "The TLS certificate could not be verified; check the server certificate and trust store." };
    if (/TIMEOUT|TIMEDOUT/.test(code) || error.name === "TimeoutError") return { code: "request.timeout", message: "The request timed out; check that the server is reachable." };
    if (code === "ECONNREFUSED") return { code: "request.connection", message: "The server refused the connection; check the address and port." };
    if (code === "ECONNRESET") return { code: "request.connection", message: "The connection was reset before the request completed." };
  }
  return { code: "request.failed", message: "The HTTP request failed before a response arrived." };
}

/** Standard redirects plus same-host HTTP-to-HTTPS credential continuity. No application retries. */
export async function fetchWithRedirects(
  fetch: typeof globalThis.fetch,
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  let url = new URL(input);
  let method = (init.method ?? "GET").toUpperCase();
  let body = init.body;
  const sensitiveHeader = /authorization|cookie|token|api[-_]?key/i;
  const rawHeaders = init.headers instanceof Headers ? [...init.headers]
    : Array.isArray(init.headers) ? init.headers : Object.entries(init.headers ?? {});
  const secrets = rawHeaders.filter(([key]) => sensitiveHeader.test(key!)).map(([, value]) => value!);
  const auth = rawHeaders.find(([key]) => key!.toLowerCase() === "authorization")?.[1];
  if (auth) secrets.push(auth.replace(/^\S+\s+/, ""));
  for (const value of secrets) rememberSecret(value);
  let headers: Headers;
  try { headers = new Headers(init.headers); }
  catch (cause) { throw new CliError("Could not construct the HTTP request headers.", { code: "request.invalidHeaders", cause: diagnosticCause(cause, secrets) }); }
  for (let redirects = 0; ; redirects++) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, method, body: body ?? null, headers, redirect: "manual" });
    } catch (cause) {
      const safe = diagnosticCause(cause, secrets);
      const reason = requestFailure(safe);
      throw new CliError(reason.message, { code: reason.code, cause: safe });
    }
    if (!redirectStatuses.has(response.status)) return response;
    const location = response.headers.get("location");
    if (location === null) return response;
    void response.body?.cancel().catch(() => undefined);
    if (redirects >= 20) throw new CliError("HTTP redirect limit exceeded (20); check the server's redirect configuration.", { code: "http.redirectLimit" });
    let next: URL;
    try { next = new URL(location, url); }
    catch (cause) { throw new CliError("The server returned an invalid redirect URL.", { code: "http.redirectInvalid", cause: diagnosticCause(cause, [location]) }); }
    if (!['http:', 'https:'].includes(next.protocol) || next.username || next.password) {
      throw new CliError("The server returned an unsupported redirect URL.", { code: "http.redirectInvalid" });
    }
    const upgrade = url.protocol === "http:" && next.protocol === "https:" &&
      url.hostname === next.hostname;
    if (url.origin !== next.origin && !upgrade) {
      for (const name of [...headers.keys()]) if (sensitiveHeader.test(name)) headers.delete(name);
    }
    headers.delete("host");
    if (((response.status === 301 || response.status === 302) && method === "POST") ||
        (response.status === 303 && method !== "GET" && method !== "HEAD")) {
      method = "GET"; body = undefined;
      for (const name of ['content-type', 'content-length', 'content-encoding', 'content-language', 'content-location']) headers.delete(name);
    } else if (body !== undefined && body !== null &&
        (body instanceof ReadableStream || Symbol.asyncIterator in Object(body))) {
      throw new CliError("The redirect requires replaying a streaming request body. Use the final endpoint URL.", { code: "http.redirectBody" });
    }
    url = next;
  }
}
