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


test("configured URLs retain explicit ports independently of native transport serialization", () => {
  for (const host of ["example.test", "[2001:db8::1]"]) {
    for (const scheme of ["http", "https"]) {
      for (const port of ["", ":80", ":443", ":8111", ":8443", ":00443", ":0", ":65535"]) {
        const configured = scheme + "://" + host + port + "/context/";
        const parsed = parseServerUrl(" \t" + configured + "// \r\n", "Invalid URL");
        assert.equal(parsed.href, configured);
        assert.equal(parsed.pathname, "/context/");
        assert.deepEqual(parseServerUrl(parsed.href, "Invalid URL"), parsed);
        assert.equal(new URL(parsed.href).href, new URL(configured).href);
      }
    }
  }
  for (const value of ["https://example.test:65536", "http://example.test:-1", "https://example.test:abc"]) {
    assert.throws(() => parseServerUrl(value, "Invalid URL"), { message: "Invalid URL" });
  }
});
