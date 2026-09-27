import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBearerToken, parseServerUrl } from "../src/index.js";

test("normalizers are idempotent and never reinterpret token symbols as URLs", () => {
  for (const input of [" \r\nfictional.A+b/c== \t", "fictional inner symbols / = +"]) {
    const token = normalizeBearerToken(input);
    assert.equal(token, input.trim());
    assert.equal(normalizeBearerToken(token), token);
  }
  const url = parseServerUrl(" https://example.test:8443/context/// ", "Invalid URL");
  assert.equal(url.href, "https://example.test:8443/context/");
  assert.equal(parseServerUrl(url.href, "Invalid URL").href, url.href);
  for (const value of ["", " ", "invalid", "https:///example.test", "https://example.test/a b", "https://example.test?fictional-private", "https://fictional:private@example.test", "https://example.test/%zz"]) {
    assert.throws(() => parseServerUrl(value, "Invalid URL"), { message: "Invalid URL" });
  }
});
