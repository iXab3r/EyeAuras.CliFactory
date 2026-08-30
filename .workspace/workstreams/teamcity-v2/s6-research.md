# TeamCity remaining operational API research

Research date: 2026-08-30. Research only; this file does not accept a new implementation slice
or change the scope of [Issue #5](https://github.com/iXab3r/EyeAuras.CliFactory/issues/5).
The orchestrator owns scope publication, implementation, coverage acceptance, and checkpoints.

The candidate set was obtained by subtracting the frozen baseline cli-map and S1-S4 coverage CSVs
from the 449-route inventory. It contains 45 further operations: 23 GET / ReadOnly and 22 Update.
It excludes S5 configuration/queue scope, binary/file downloads, and secret-value output.
Five additional metadata-only candidates and one unresolved bulk-unmute contract are recorded
separately below, not silently counted in the 45.

No production files, GitHub records, or real TeamCity service state were changed during research.
All examples are synthetic.

## Evidence and confidence

Primary API version: [JetBrains REST 2026.1](https://www.jetbrains.com/help/teamcity/rest/buildapi.html).
Implementation details were cross-checked against the official public repository at
[fc730e618ccd4b57dbbaf03425bb79a9580d19d2](https://github.com/JetBrains/teamcity-rest/tree/fc730e618ccd4b57dbbaf03425bb79a9580d19d2).

The public source revision predates some 2026.1 endpoints. It is useful corroboration, not evidence
that every current implementation is byte-for-byte identical. DELETE /mutes/multiple and the
build output-parameter endpoints are not implemented in the inspected public BuildRequest /
MuteRequest sources; current documentation is the available primary evidence for those routes.
Do not turn an unverified minimal mutation payload into a passing fixture and call it proven.

## Shared notation and safe output

All paths below have prefix /app/rest. JSON requests use Accept: application/json; JSON bodies
also use Content-Type: application/json. Plain-text bodies use Content-Type: text/plain.
Text response routes use Accept: text/plain. No arbitrary URL, HTTP method, or JSON body
passthrough is proposed.

The following are proposed minimal field selectors, substituted into the tables:

~~~text
B = id,buildTypeId,number,state,status
C = id,version,date,comment
T = id,name
P = id,type,identity
TO = id,name,status,duration,ignored,currentlyMuted,test(id),build(id)
PO = id,type,identity,currentlyMuted,problem(id),build(id)
MULTI = count,errorCount,operationResult(related(build(id)))
~~~

Nested service objects must be explicitly projected after parsing, even when fields was sent.
Never spread a raw object into the result. Do not return nested credentials, configuration
properties, error-message bodies, usernames/e-mails, VCS URLs, or diagnostic details unless a
separate intentional contract requires them.

Test IDs, problem IDs, occurrence IDs, and investigation IDs remain strings. A test name ID is
a Java long and may exceed JavaScript's safe integer range. Positive numeric build/user/mute IDs
need range validation before use; opaque or long string IDs must never pass through Number().
See [Test](https://www.jetbrains.com/help/teamcity/rest/test.html),
[Problem](https://www.jetbrains.com/help/teamcity/rest/problem.html),
[TestOccurrence](https://www.jetbrains.com/help/teamcity/rest/testoccurrence.html), and
[ProblemOccurrence](https://www.jetbrains.com/help/teamcity/rest/problemoccurrence.html).

## Build operations: 22 candidates

A single build locator is constructed from an explicit build ID. Bulk commands should take a
bounded, nonempty, unique list of explicit IDs and form the documented union locator:

~~~text
item:(id:101),item:(id:102)
~~~

This is a direct request, not a discovery-and-mutate workflow. No hidden search, retry, or
follow-up mutation. See [BuildLocator](https://www.jetbrains.com/help/teamcity/rest/buildlocator.html).

| # | Method | Path after /app/rest | Request / response |
|---|---|---|---|
| 1 | GET | /builds/aggregated/{buildLocator}/status | No body; text status response |
| 2 | GET | /builds/multiple/{buildLocator} | fields=count,nextHref,build(B); Builds JSON |
| 3 | POST | /builds/multiple/{buildLocator} | JSON {comment:string,readdIntoQueue:boolean}; fields=MULTI; MultipleOperationResult |
| 4 | DELETE | /builds/multiple/{buildLocator} | No body; fields=MULTI; MultipleOperationResult |
| 5 | PUT | /builds/multiple/{buildLocator}/comment | Plain-text comment; fields=MULTI; MultipleOperationResult |
| 6 | DELETE | /builds/multiple/{buildLocator}/comment | No body; fields=MULTI; MultipleOperationResult |
| 7 | PUT | /builds/multiple/{buildLocator}/pinInfo | JSON {status:boolean,comment?:{text:string}}; fields=MULTI; MultipleOperationResult |
| 8 | POST | /builds/multiple/{buildLocator}/tags | JSON {tag:[{name:string}]}; fields=MULTI; MultipleOperationResult |
| 9 | DELETE | /builds/multiple/{buildLocator}/tags | JSON body {tag:[{name:string}]}; fields=MULTI; MultipleOperationResult |
| 10 | GET | /builds/{buildLocator}/artifactDependencyChanges | fields=count,buildChange(nextBuild(B),prevBuild(B)); BuildChanges JSON |
| 11 | DELETE | /builds/{buildLocator}/caches/finishProperties | No body; void / 204; normalized acknowledgment |
| 12 | PUT | /builds/{buildLocator}/finish | No body, text/plain media; text accepted finish time |
| 13 | PUT | /builds/{buildLocator}/finishDate | Plain-text TeamCity timestamp; text accepted finish time |
| 14 | POST | /builds/{buildLocator}/log | Plain-text message; void / 204 |
| 15 | GET | /builds/{buildLocator}/problemOccurrences | fields=count,problemOccurrence(PO); ProblemOccurrences JSON |
| 16 | POST | /builds/{buildLocator}/problemOccurrences | Plain-text description; fields=PO; ProblemOccurrence JSON |
| 17 | GET | /builds/{buildLocator}/relatedIssues | fields=count,issueUsage(issue(id)); IssuesUsages JSON; project only issue IDs |
| 18 | PUT | /builds/{buildLocator}/runningData | Plain-text requestor; fields=B; Build JSON |
| 19 | POST | /builds/{buildLocator}/status | JSON {status:"SUCCESS" or "FAILURE",comment:string}; BuildStatusUpdateResult JSON |
| 20 | GET | /builds/{buildLocator}/testOccurrences | fields=count,testOccurrence(TO); TestOccurrences JSON |
| 21 | GET | /builds/{buildLocator}/vcsLabels | VcsLabels JSON; explicit projection to text/status/buildId |
| 22 | POST | /builds/{buildLocator}/vcsLabels | Plain-text label; optional query locator=id:<vcsRootInstanceId>; VcsLabels JSON |

GET is ReadOnly; all other verbs are Update.

Detailed primary evidence:
[BuildRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/BuildRequest.java),
[BuildChanges](https://www.jetbrains.com/help/teamcity/rest/buildchanges.html),
[MultipleOperationResult](https://www.jetbrains.com/help/teamcity/rest/multipleoperationresult.html),
[BuildStatusUpdate](https://www.jetbrains.com/help/teamcity/rest/buildstatusupdate.html).

### Bulk result and failure semantics

The wire shape is:

~~~ts
type MultipleOperationResult = {
  count?: number;
  errorCount?: number;
  operationResult?: {
    message?: string;
    related?: { build?: { id: number } };
  }[];
};
~~~

HTTP 200 can contain partial failures. Do not normalize it into unconditional success.
The MULTI selector omits raw messages and selects count/errorCount/affected IDs; the returned
domain object must preserve a visible partial-failure indicator. Individual success cannot be
inferred from a missing message when the selector deliberately excluded messages.

Published source has a field-selection inconsistency: OperationResult serializes a property named
message but checks a selector named text internally. The safe selector does not depend on either.
See [result source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/OperationResult.java).

### Build lifecycle and diagnostics limitations

- DELETE caches/finishProperties invalidates/reloads cached final parameters; source explicitly
  says this is not deletion of the durable parameters. Use a cache-reset command name.
- PUT finish and finishDate apply to a running build. Completion may be asynchronous after the
  returned timestamp; an acknowledgment is not evidence that the build reached finished state.
- PUT runningData starts a queued build as an agentless build. It is not a normal build trigger
  or resume operation.
- POST log accepts TeamCity service messages, which may have semantics beyond appending text.
  A plain-message CLI may reject the service-message prefix rather than exposing another
  unrestricted control surface. It remains Update.
- POST problemOccurrences uses the public text/plain overload. The JSON overload in source is
  hidden from the API inventory and must not become the assumed contract.
- POST status returns BuildStatusUpdateResult, not a bare Build. Shape:
  {build?:Build,errors?:{item?:string[]}}. HTTP 400 may return this shape too. Project only the
  build and non-sensitive failure state; never expose raw errors in diagnostics.
- Scoped problemOccurrences and testOccurrences collections do not accept pagination locators.
  They remain outside the fixed bounded real-service proof.
- Related issue models can contain URLs even when the outer request selects issue(id), because
  the nested Issue implementation does not itself use Fields. Always project locally.

See [status result source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/build/BuildStatusUpdateResult.java)
and [Issue source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/issue/Issue.java).

### VCS labels

VcsLabels is {count?:number,vcsLabel?:[{text?:string,status?:string,buildId?:number}]}.
POST creates labels in the external VCS, not merely TeamCity tags. Without the optional VCS-root
instance locator it applies to all roots in the build. Source catches VCS exceptions and returns
label statuses, so HTTP 200 alone is not proof of successful labeling.

The published resource passes the same Fields object to both collection and child labels.
The selector justified by that source is count,vcsLabel,text,status,buildId; a nested-only
vcsLabel(text,status,buildId) must not be assumed to work without further target-version evidence.
Still project locally and do not request failureReason or VCS-root properties.

[VcsLabel source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/build/VcsLabel.java).

## Change operations: 6 candidates

Use an explicit id:<changeId> locator. These are all ReadOnly.

| # | Method | Path after /app/rest | Query / response |
|---|---|---|---|
| 23 | GET | /changes/{changeLocator}/duplicates | fields=change(C); {change?:Change[]} |
| 24 | GET | /changes/{changeLocator}/firstBuilds | fields=build(B); {build?:Build[]} |
| 25 | GET | /changes/{changeLocator}/issues | No fields query; {issue?:[{id:string,url:string}]}; return IDs only |
| 26 | GET | /changes/{changeLocator}/parentRevisions | No fields query; {item?:string[]} |
| 27 | GET | /changes/{changeLocator}/vcsRootInstance | fields=id,name,vcs-root-id; VcsRootInstance identity only |
| 28 | GET | /changes/{changeLocator}/{field} | text/plain; proposed whitelist id/version/date/personal/comment |

The generic field implementation also accepts username and undocumented fields. The proposed
surface deliberately omits them; it does not claim every field combination is supported.
Do not select VCS root instance properties.

[ChangeRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/ChangeRequest.java),
[Change field source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/change/Change.java).

## Investigation operations: 6 candidates

Use one typed target to derive both request identity and payload. An investigation ID is itself
a compound locator, not a numeric ID.

~~~ts
type InvestigationTarget =
  | { kind: "job"; jobId: string }
  | { kind: "test"; projectId: string; testId: string }
  | { kind: "problem"; projectId: string; problemId: string };
~~~

The corresponding locators are:

~~~text
job     -> buildType:(id:JOB)
test    -> assignmentProject:(id:PROJECT),test:(id:TEST)
problem -> assignmentProject:(id:PROJECT),problem:(id:PROBLEM)
~~~

Create/replace requires state, assignee, resolution, scope, and target:

~~~ts
type InvestigationInput = {
  state: "TAKEN" | "FIXED" | "GIVEN_UP";
  assignee: { id: number };
  assignment?: { text: string };
  resolution: { type: "manually" | "whenFixed" };
} & (
  | {
      scope: { buildTypes: { buildType: [{ id: string }] } };
      target: { anyProblem: true };
    }
  | {
      scope: { project: { id: string } };
      target: { tests: { test: [{ id: string }] } };
    }
  | {
      scope: { project: { id: string } };
      target: { problems: { problem: [{ id: string }] } };
    }
);
~~~

Do not use deprecated responsible or scope.buildType. Test and problem targets are mutually
exclusive; anyProblem:true must not contain either. Single create/replace resolves exactly one
target. For multiple, submit an explicit array of independently validated single-target bodies.

Proposed selector I:

~~~text
id,state,assignee(id),assignment(text,timestamp),
scope(project(id),buildTypes(buildType(id))),
target(anyProblem,tests(test(id)),problems(problem(id))),
resolution(type,time)
~~~

| # | Method | Path after /app/rest | Request / response |
|---|---|---|---|
| 29 | GET | /investigations | locator=count:N,start:S; fields=count,nextHref,investigation(I) |
| 30 | POST | /investigations | One typed InvestigationInput; fields=I; Investigation |
| 31 | POST | /investigations/multiple | {investigation:[<typed input>,...]}; fields=count,investigation(I); Investigations |
| 32 | GET | /investigations/{investigationLocator} | fields=I; Investigation |
| 33 | PUT | /investigations/{investigationLocator} | Full typed InvestigationInput; fields=I; Investigation |
| 34 | DELETE | /investigations/{investigationLocator} | No body; void / 204 |

GET is ReadOnly, others Update.

PUT is not an atomic patch in the published implementation: it removes the matching investigation
then calls create. An unrelated locator and payload target could delete one investigation and
create another. Construct both from the same typed identity; validate the complete body before
HTTP. Server-side validation can still fail after removal (for example, an invalid assignee), so
the command help must describe replacement semantics and must not retry automatically.

The conservative input supports manually/whenFixed resolution, not atTime investigations.
The resolution locator filter documents when_fixed while the body model serializes whenFixed;
do not confuse locator vocabulary with JSON body vocabulary.

[Investigation API](https://www.jetbrains.com/help/teamcity/rest/investigationapi.html),
[Investigation model](https://www.jetbrains.com/help/teamcity/rest/investigation.html),
[InvestigationLocator](https://www.jetbrains.com/help/teamcity/rest/investigationlocator.html),
[ProblemScope](https://www.jetbrains.com/help/teamcity/rest/problemscope.html),
[ProblemTarget](https://www.jetbrains.com/help/teamcity/rest/problemtarget.html),
[Investigation source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/buildType/Investigation.java),
[resource replacement implementation](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/InvestigationRequest.java).

## Mute operations: 5 confirmed candidates

~~~ts
type MuteInput = {
  assignment?: { text: string };
  scope:
    | { project: { id: string } }
    | { buildTypes: { buildType: { id: string }[] } };
  target:
    | { tests: { test: { id: string }[] } }
    | { problems: { problem: { id: string }[] } };
  resolution:
    | { type: "manually" | "whenFixed" }
    | { type: "atTime"; time: string };
};
~~~

Require nonempty, unique ID lists, exactly one scope, exactly one target kind, and a valid timestamp
for atTime. Do not expose anyProblem:true as a mute: mute targets tests/problems, not all future
problems. Mute has integer id, unlike investigation.

Selector M is I without state and assignee. Project all nested data explicitly.

| # | Method | Path after /app/rest | Request / response |
|---|---|---|---|
| 35 | GET | /mutes | locator=count:N,start:S; fields=count,nextHref,mute(M); Mutes |
| 36 | POST | /mutes | Typed MuteInput; fields=M; Mute |
| 37 | POST | /mutes/multiple | {mute:[<typed input>,...]}; fields=count,mute(M); Mutes |
| 38 | GET | /mutes/{muteLocator} | id:<muteId>; fields=M; Mute |
| 39 | DELETE | /mutes/{muteLocator} | id:<muteId>; optional plain-text comment body; void / 204 |

GET is ReadOnly, others Update. No hidden GET or retry is needed for these operations.

[MuteApi](https://www.jetbrains.com/help/teamcity/rest/muteapi.html),
[Mute](https://www.jetbrains.com/help/teamcity/rest/mute.html),
[Mutes](https://www.jetbrains.com/help/teamcity/rest/mutes.html),
[Resolution source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/problem/Resolution.java).

### DELETE /mutes/multiple: unresolved minimal identity contract

This operation is in the frozen inventory and the 2026.1 MuteApi documentation. Confirmed:

- HTTP DELETE /app/rest/mutes/multiple.
- Consumes application/json or application/xml.
- JSON body model is Mutes, whose list property is mute.
- Optional query fields is documented.
- No response DTO is documented; treat successful empty response as acknowledgment, not JSON.
- Permission is Update.

Not established: whether {mute:[{id:101},{id:102}]} is sufficient, whether full scope/target
descriptions are expected, how missing IDs behave, or whether partial failure is reported.
The inspected public MuteRequest lacks the endpoint. Official JetBrains GitHub code searches for
mutes/multiple and unmuteMultipleTests returned no additional implementation/example.
Do not claim the ID-only payload is verified. The Mutes schema alone does not prove which fields
the DELETE implementation consumes. This is an evidence gap, not a reason to invent a fixture.

## Test and problem operations: 6 candidates

| # | Method | Path after /app/rest | Query / response |
|---|---|---|---|
| 40 | GET | /tests | bounded locator; fields=count,nextHref,test(T); Tests |
| 41 | GET | /tests/{testLocator} | id:<string testId>; fields=T; Test |
| 42 | GET | /testOccurrences/{testLocator} | occurrence locator; fields=TO; TestOccurrence |
| 43 | GET | /problems | bounded locator; fields=count,nextHref,problem(P); Problems |
| 44 | GET | /problems/{problemLocator} | id:<string problemId>; fields=P; Problem |
| 45 | GET | /problemOccurrences/{problemLocator} | occurrence locator; fields=PO; ProblemOccurrence |

All are ReadOnly. Do not confuse an occurrence ID/locator with a test/problem ID. A typed
{buildId,testId/problemId} selector or an explicitly named returned occurrence locator is suitable;
coercing a compound ID to a number is not.

[TestOccurrenceLocator](https://www.jetbrains.com/help/teamcity/rest/testoccurrencelocator.html),
[ProblemOccurrenceLocator](https://www.jetbrains.com/help/teamcity/rest/problemoccurrencelocator.html),
[TestRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/TestRequest.java),
[ProblemRequest](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/request/ProblemRequest.java).

## Five additional metadata-only candidates

These are research additions, not part of the 45-operation candidate count above. All are GET /
ReadOnly, but read-only does not imply safe-to-print values. Names-only collections have a
server-side projection; scalar value endpoints do not.

| Method/path after /app/rest | Exact documented query / media / result | Safe proposed output contract |
|---|---|---|
| GET /builds/{buildLocator}/output-parameters | Optional fields; JSON Properties {count?:number,href?:string,property?:Property[]} | Send fields=count,property(name); return names/count only |
| GET /builds/{buildLocator}/output-parameters/{propertyName} | No fields query; text/plain string value | Existence probe only: never return, log, hash, or attach the value |
| GET /builds/{buildLocator}/resulting-properties | Optional fields; JSON Properties | Send fields=count,property(name); return names/count only |
| GET /builds/{buildLocator}/resulting-properties/{propertyName} | No fields query; text/plain string final value | Existence probe only: never return, log, hash, or attach the value |
| GET /changes/{changeLocator}/attributes | Optional fields; JSON Entries {count?:number,entry?:Entry[]} | Send fields=count,entry(name); return names/count only |

Wire element shapes:

~~~ts
type Property = {
  name?: string;
  value?: string;
  inherited?: boolean;
  type?: { rawValue?: string };
};
type Entry = { name?: string; value?: string };
~~~

Do not request type(rawValue): that is a serialized parameter specification, not a safe type enum.
Do not infer secure/nonsecure classification merely because type is absent: runtime maps may lack
the original parameter specifications. The simple names-only selector avoids this ambiguity.

For both Properties and Entries, published source confirms child name/value fields are selected
independently. Explicit fields=count,property(name) and fields=count,entry(name) suppress values
server-side; local projection must still discard any extra value/type/href fields in a response.

Scalar endpoints cannot produce real metadata-only HTTP payloads: their purpose is to return the
value and they have no fields query. A product may expose an explicitly named existence check
which accepts 2xx and discards the body, returning {name,exists:true}; do not call that server-side
metadata projection. A 404 can mean missing build or parameter, so without another read it is not
proof that only the parameter is absent. Preserve the generic 404 error unless the contract
explicitly accepts that ambiguity. Never print length/hash/preview of the discarded value.
Cancel/consume the response safely and bound resource use if this path is implemented.

The inspected resulting-properties source checks VIEW_BUILD_RUNTIME_DATA. Public docs describe
output-parameters collection and scalar routes, but those newer methods are absent from the
inspected public BuildRequest; avoid inventing additional guarantees from the older source.

Primary evidence:
[BuildApi](https://www.jetbrains.com/help/teamcity/rest/buildapi.html),
[Properties](https://www.jetbrains.com/help/teamcity/rest/properties.html),
[Property](https://www.jetbrains.com/help/teamcity/rest/property.html),
[Entries](https://www.jetbrains.com/help/teamcity/rest/entries.html),
[Entry](https://www.jetbrains.com/help/teamcity/rest/entry.html),
[Properties source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/Properties.java),
[Property source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/Property.java),
[Entries source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/Entries.java),
[Entry source](https://github.com/JetBrains/teamcity-rest/blob/fc730e618ccd4b57dbbaf03425bb79a9580d19d2/rest-api/src/jetbrains/buildServer/server/rest/model/Entry.java).

## Explicit exclusions and verification obligations

- GET /builds/{buildLocator}/resolved/{value} performs parameter interpolation; it is not a
  resolved-status endpoint and may disclose parameter values. It needs its own safety contract.
- Artifact/source downloads, status icons, and server filesystem-path output are outside this
  research assignment.
- No new route in this document is automatically added to the fixed local real-service proof.
- Every mutation needs Update denial before HTTP; no live mutation is necessary to implement it.
- Mock contracts must cover partial errors at HTTP 200, JSON/text DELETE bodies, exact
  investigation replacement identity, long string test IDs, and cross-profile isolation.
- Response fixtures should contain synthetic unwanted nested credential/configuration fields
  to prove explicit projections discard them.
- Malformed JSON and HTTP failures must not expose response-body excerpts.
- Collection metadata tests must inject extra value/type/href fields and assert they never reach
  output. Scalar existence tests must prove the secret body is never rendered or logged.
- The orchestrator must publish the accepted contract and any uncertainty resolution in Issue #5
  before implementation scope expands; this research file is evidence, not feature acceptance.
