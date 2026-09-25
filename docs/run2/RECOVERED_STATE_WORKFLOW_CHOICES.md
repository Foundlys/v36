# Same Run 2: shared draft and industry-template choices

Source `739b5fafe46f4a487292e704c0191d175606078a`, tree `bf48583ae30dedc080de07009ab58592ef36daf9`: 801 ZERO tests, all 14 corpus cases and three affected native suites PASS. Nine new permanent tests cover the shared controls, including a real HTTP native-member path.

The draft chooser and template modal now update owned text and revision numbers across eight locales without requests or input replacement. Names, source template content, selected draft and editor controls remain intact. A template response is bound to the current editor: a retired screen or an edit made while the source request waits prevents its modal from opening. Access denial closes an already open private modal, and stale controls cannot apply it. Typed response checks distinguish a verified empty catalogue from missing or contradictory data. Native save/publication authority is unchanged; choosing a template performs no writes or execution.

Initial localization and late-response failures are retained. Fixture repairs account for the existing localized template button, native draft normalization, and explicit Automotive selection for an Automotive template. Those repairs do not relax assertions.

The preceding result-recovery tree has full matching CI 219 evidence. Publish this exact newer source plus evidence and inspect its own full CI. Continue with Marketing measurement and remaining real localization/state gaps. The current expression scan is a candidate list, not all-surface acceptance. Other Run 2 hard gates remain open. No dashboard redesign, main/production deployment, credentials or Run 3 action.
