import assert from "node:assert/strict";
import test from "node:test";
import { isProfileAssignableToWard, replaceResidentsForWard, visibleWardIdsForRole } from "../src/lib/resident-ward-assignment.js";

test("a Resident sees the combined wards assigned to them", () => {
  assert.deepEqual(
    visibleWardIdsForRole({ role: "resident", residentWardIds: ["ward-a", "ward-b"], allWardIds: ["ward-a", "ward-b", "ward-c"] }),
    ["ward-a", "ward-b"],
  );
});

test("a Resident without an assignment has no visible Ward scope", () => {
  assert.deepEqual(
    visibleWardIdsForRole({ role: "resident", residentWardIds: [], allWardIds: ["ward-a"] }),
    [],
  );
});

test("saving a Ward preserves other Resident-Ward assignments", () => {
  assert.deepEqual(
    replaceResidentsForWard([{ residentId: "r1", wardId: "ward-a" }, { residentId: "r1", wardId: "ward-b" }], "ward-b", ["r1", "r2"]),
    [{ residentId: "r1", wardId: "ward-a" }, { residentId: "r1", wardId: "ward-b" }, { residentId: "r2", wardId: "ward-b" }],
  );
});

test("duplicate Resident-Ward pairs are rejected", () => {
  assert.throws(() => replaceResidentsForWard([], "ward-a", ["r1", "r1"]), /Duplicate resident selection/);
});

test("only Residents assigned to the Ward are task owners", () => {
  assert.equal(isProfileAssignableToWard({ role: "resident", residentWardIds: ["ward-a"] }, "ward-a"), true);
  assert.equal(isProfileAssignableToWard({ role: "resident", residentWardIds: ["ward-b"] }, "ward-a"), false);
});
