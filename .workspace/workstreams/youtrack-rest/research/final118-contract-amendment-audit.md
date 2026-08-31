# Final118 contract amendment audit

- Status: final wording independently approved and root published; canonical issue-body.md and frozen candidate both match final A3E0 body.
- Old Issue6 body guard SHA:4433757a320c1d6c30664a60ed493bdd403f89ee0a8357748c5f0a5454399c5e.
- Candidate: issue-body-final118-candidate.md; inserted section: research/final118-contract-amendment.md.
- Exact insertion before Frozen inventory boundary; removing it restores the old body byte-for-byte.
  Existing history, inventory comments and endpoint/category/count mappings are untouched.
- Decisions: explicit successful parent-null only; upload fields; both file-signature forms/opaque
  signatures/exact metadata ID; exclusive link publication and explicit same-OS-user race limitation;
  Core candidate/prompt/persistence/no-auth/guest policy as independently approved by core_auth_review.
- Root approved Core proposal and download design; final public wording still needs review before
  affected implementation. Scope manager performed no source change, credential access or GH call.
- Root alone performs privacy review, exact remote-old-body guard, gh issue edit --body-file, and
  exact new-body readback. Only then reconcile publication status; candidate preparation is not acceptance.
- Candidate SHA:a3e0ab6db72680ec45b8744c5470b35badfdbb90b1853753ffa08c7de9309030
- Amendment SHA:979194e0a353c748b1f1c52ac09c5302dd10bea5cd9557f20ced11da072320a5

- Root publication chain: guarded4433757→9ab26a7, then final guarded9ab26a7→a3e0ab6. The intervening local candidate wording revision caused a candidate/readback mismatch, not remote corruption; final remote/body/candidate equality was verified.
- Final body SHA:a3e0ab6db72680ec45b8744c5470b35badfdbb90b1853753ffa08c7de9309030; Issue6 remains OPEN. No candidate edits after final freeze.
