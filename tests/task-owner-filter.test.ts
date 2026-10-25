import assert from "node:assert/strict";
import test from "node:test";
import { matchesTaskOwner, UNASSIGNED_OWNER_FILTER } from "../src/lib/task-owner-filter.js";

test("All includes assigned and unassigned work", () => {
  assert.equal(matchesTaskOwner("doctor-1", ""), true);
  assert.equal(matchesTaskOwner(null, ""), true);
});
test("Unassigned excludes work owned by any staff member", () => {
  assert.equal(matchesTaskOwner("doctor-1", UNASSIGNED_OWNER_FILTER), false);
  assert.equal(matchesTaskOwner("student-1", UNASSIGNED_OWNER_FILTER), false);
  assert.equal(matchesTaskOwner(null, UNASSIGNED_OWNER_FILTER), true);
  assert.equal(matchesTaskOwner(undefined, UNASSIGNED_OWNER_FILTER), true);
});
test("a specific owner only includes their work", () => {
  assert.equal(matchesTaskOwner("doctor-1", "doctor-1"), true);
  assert.equal(matchesTaskOwner("doctor-2", "doctor-1"), false);
  assert.equal(matchesTaskOwner(null, "doctor-1"), false);
});
