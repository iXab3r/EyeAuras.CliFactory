import test from "node:test";
import { checkLiveCase, liveCases, parseProofProfile } from "./profile-proof.js";

// Never reached by the default tests/*.test.js glob. Validate before spawning any CLI/network work.
const profile = parseProofProfile(process.argv.slice(2), process.env);
let previousFailure = false;

for (const caseSpec of liveCases) {
  test(caseSpec.name, { concurrency: false, timeout: 260_000 }, async (context) => {
    if (previousFailure) {
      context.skip("Earlier live test failed; no additional requests sent.");
      return;
    }
    try {
      await checkLiveCase(caseSpec, profile);
    } catch (error) {
      previousFailure = true;
      throw error;
    }
  });
}
