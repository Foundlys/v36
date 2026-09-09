# Industry extensions

Module engines own their records and enforce existing tenant, module, capability and record permissions. Industry manifests provide metadata through the capability resolver. Only GENERAL and AUTOMOTIVE are production registrations. The REAL_ESTATE_DEMO objects exist only inside test programs.

`industry-field-contract.js` supplies typed domain field descriptors. The authenticated schema API drives the existing record form. Writes retain the field pack identity, merge supplied fields, reject unknown/type-invalid values and preserve records when a module or pack changes. Records from incompatible or ambiguous older packs require restoring the matching pack before changing their fields. Browser acceptance is still blocked externally.

`industry-kpis.js` evaluates registered RATIO_OF_SUMS_PERCENT definitions from the existing permission-filtered canonical event projection. Both Analysis KPI and event capabilities are required. Callers select an explicit half-open date range and, for monetary inputs, one currency. Non-integer, negative or mismatched-currency visible records are excluded and counted; hidden records contribute neither values nor counts. Empty and zero-denominator results are null. Source identifiers, event references, freshness, formula version and input quality accompany each result. No provider verification, statistical confidence, trend or comparison is invented. The current production packs do not yet register these ratio definitions; their API explicitly reports NO_REGISTERED_KPIS.

`second-industry-integration-test.js` exercises a property/customer relationship through existing CRM custom fields and deals, and a property yield fixture through Analytics-only canonical events. It tests private records, separate entitlements, reload and revoked source capabilities. It is architectural fixture evidence, not a production Real Estate product or provider acceptance.

Remaining: full industry workflow/dashboard registry, production KPI integrations with verified source contracts, and browser acceptance.
