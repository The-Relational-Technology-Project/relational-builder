# Clean builds, kept as fixtures

Four builds that bundled, rendered in the browser with no errors, and were
judged working on the bench (two Opus, one Gemma, one Mistral Small,
Nov 5 and 6, 2026), copied as the model wrote them. `bench/lib/check-scan.test.ts`
runs every static check over them and expects nothing: a new check that
fires on a working app is a false positive, and this is where it shows up
first (the React check on Nov 5 would have).
