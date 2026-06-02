import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseJson, parseAttendeeFile } from "./parse.ts";

test("maps messy real-world headers to canonical fields", () => {
  const csv = [
    "Full Name,Job Title,Organization,LinkedIn,Twitter,Interested In",
    "Ada Lovelace,Founder & CEO,Analytical Engines,ada-lovelace,@ada,AI; Devtools | Math",
    "Alan Turing,Research Lead,Bletchley,https://linkedin.com/in/aturing,turing,Cryptography, AI",
  ].join("\n");
  const rows = parseCsv(csv);
  assert.equal(rows.length, 2);

  const ada = rows[0];
  assert.equal(ada.name, "Ada Lovelace");
  assert.equal(ada.title, "Founder & CEO");
  assert.equal(ada.company, "Analytical Engines");
  assert.deepEqual(ada.interests, ["AI", "Devtools", "Math"]);
  assert.equal(ada.socials.twitter, "https://x.com/ada");
  assert.equal(ada.socials.linkedin, "https://linkedin.com/in/ada-lovelace");
  // already-full LinkedIn URL is left intact
  assert.equal(rows[1].socials.linkedin, "https://linkedin.com/in/aturing");
});

test("combines first + last name when no full-name column", () => {
  const csv = "First Name,Last Name,Role\nGrace,Hopper,Rear Admiral";
  const rows = parseCsv(csv);
  assert.equal(rows[0].name, "Grace Hopper");
  assert.equal(rows[0].title, "Rear Admiral");
});

test("strips BOM, skips empty/nameless rows", () => {
  const csv = "﻿name,company\nKatherine Johnson,NASA\n,EmptyName Co\n\n";
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Katherine Johnson");
});

test("dedupes by email, case-insensitive", () => {
  const csv = "name,email\nMargaret Hamilton,mh@nasa.gov\nMargaret Hamilton,MH@NASA.GOV";
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
});

test("parses JSON arrays and {attendees:[...]} envelopes", () => {
  const arr = parseJson(JSON.stringify([{ name: "Hedy Lamarr", title: "Inventor", github: "hedy" }]));
  assert.equal(arr[0].name, "Hedy Lamarr");
  assert.equal(arr[0].socials.github, "https://github.com/hedy");

  const env = parseJson(JSON.stringify({ attendees: [{ "Full Name": "Claude Shannon" }] }));
  assert.equal(env[0].name, "Claude Shannon");
});

test("parseAttendeeFile dispatches by extension and sniffs unknowns", () => {
  assert.equal(parseAttendeeFile("x.json", '[{"name":"A"}]').length, 1);
  assert.equal(parseAttendeeFile("x.csv", "name\nB").length, 1);
  assert.equal(parseAttendeeFile("noext", '[{"name":"C"}]').length, 1); // sniffed JSON
});
