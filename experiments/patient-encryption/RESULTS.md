# ผลทดสอบ WardFlow encryption prototype

วันที่: 16 พฤศจิกายน 2026 (Asia/Bangkok)
Runtime ที่ทดสอบ: Node.js v20.20.0 บน Windows

## ผลที่ตรวจแล้ว

- `node --test experiments/patient-encryption/prototype.test.mjs`: **17 ผ่าน / 0 ไม่ผ่าน / 0 ข้าม**
- `npx eslint experiments/patient-encryption/prototype.mjs experiments/patient-encryption/prototype.test.mjs`: **ผ่าน**, exit code 0
- HN สมมติ **10,000 ค่า** ถอดกลับตรงต้นฉบับหลัง serialize/deserialize JSON: **0 mismatch** รวมเลข 0 ด้านหน้า
- staging ใน memory **1,000 records / 5,000 protected fields** ตรวจค่ากลับตรงต้นฉบับทุกช่อง และ source เดิมไม่ถูกเปลี่ยน
- การเปลี่ยนทีละ bit ใน IV/ciphertext/tag ของตัวอย่างหนึ่ง **296 กรณี** ถูกปฏิเสธทั้งหมด
- กุญแจผิด/หาย สลับ Patient ID, field หรือ team รูปแบบ envelope เสีย และ key ID ถูกแก้: ปฏิเสธโดยไม่คืน partial plaintext
- ชื่อไทย Unicode combining marks, emoji, note หลายบรรทัด, ตัวเลขยาว, ค่าว่างและ null: คงค่าเดิมในชุดทดสอบ
- ผลจากตัวสร้าง **Summary Note และ Google Docs requests จริง** ตรงกันก่อน–หลังถอดรหัส ไม่มีการเรียก Google APIs

## ขอบเขตการสรุป

ผลนี้ยืนยันว่ากลไก encryption ใน prototype รักษาค่าที่ทดสอบได้ และปฏิเสธข้อมูลที่ตรวจ authentication ไม่ผ่าน ไม่ใช่การรับรองว่าเส้นทาง application หรือ migration production พร้อมใช้งาน

ยังไม่ได้ทดสอบ browser/clipboard จริง, Supabase, สิทธิ์ production, SQL concurrency, ข้อมูลผู้ป่วยจริง, backup, activity log หรือ key management จริง การจำลอง retry และ staging เป็น in-memory tests เท่านั้น

มี test แสดงข้อจำกัดด้วย: ciphertext เก่าที่ถูกต้องสำหรับคน/field เดิมยังเปิดได้ ดังนั้น production ต้องใช้ revision/CAS ป้องกัน stale writes/replay เพิ่มเติม

ไม่มีการแก้ src, schema, application configuration หรือเชื่อม prototype เข้าระบบจริง และไม่มีการ commit/push

## Output จาก test runner

```text
TAP version 13
# Subtest: exact HN round-trip: leading zeros, separators, long numbers and whitespace
ok 1 - exact HN round-trip: leading zeros, separators, long numbers and whitespace
  ---
  duration_ms: 5.9774
  ...
# Subtest: 10,000 synthetic HNs remain exact after JSON storage; each nonce is distinct
ok 2 - 10,000 synthetic HNs remain exact after JSON storage; each nonce is distinct
  ---
  duration_ms: 427.233
  ...
# 10,000 synthetic HNs: exact round-trips, zero mismatches; nonce uniqueness observed in this sample
# Subtest: Thai names, combining marks, emoji, null, empty and multiline notes remain exact
ok 3 - Thai names, combining marks, emoji, null, empty and multiline notes remain exact
  ---
  duration_ms: 7.5543
  ...
# Subtest: numbers, undefined, objects and booleans are rejected instead of silently changing HNs
ok 4 - numbers, undefined, objects and booleans are rejected instead of silently changing HNs
  ---
  duration_ms: 0.7101
  ...
# Subtest: same input encrypts differently but decrypts to the identical HN
ok 5 - same input encrypts differently but decrypts to the identical HN
  ---
  duration_ms: 0.4196
  ...
# Subtest: wrong or missing keys fail closed, with no partial HN returned
ok 6 - wrong or missing keys fail closed, with no partial HN returned
  ---
  duration_ms: 2.4707
  ...
# Subtest: every single-bit mutation of IV, ciphertext and authentication tag is rejected
ok 7 - every single-bit mutation of IV, ciphertext and authentication tag is rejected
  ---
  duration_ms: 12.5478
  ...
# 296 single-bit corruptions rejected; no plaintext returned
# Subtest: patient, field and team substitutions are rejected
ok 8 - patient, field and team substitutions are rejected
  ---
  duration_ms: 0.6863
  ...
# Subtest: malformed, truncated, unexpected metadata and plaintext fallback inputs are rejected
ok 9 - malformed, truncated, unexpected metadata and plaintext fallback inputs are rejected
  ---
  duration_ms: 1.2445
  ...
# Subtest: key rotation supports both versions; unavailable old key never falls back
ok 10 - key rotation supports both versions; unavailable old key never falls back
  ---
  duration_ms: 0.604
  ...
# Subtest: a stored encrypted record has no extra plaintext fields and preserves all protected values
ok 11 - a stored encrypted record has no extra plaintext fields and preserves all protected values
  ---
  duration_ms: 1.4128
  ...
# Subtest: swapping fields or records across patients blocks the entire decrypted result
ok 12 - swapping fields or records across patients blocks the entire decrypted result
  ---
  duration_ms: 0.836
  ...
# Subtest: staging 1,000 synthetic patient records validates every field without changing source
ok 13 - staging 1,000 synthetic patient records validates every field without changing source
  ---
  duration_ms: 197.4809
  ...
# 1,000 synthetic records / 5,000 protected fields verified exactly; source remained unchanged
# Subtest: damaged, mispaired and invalid migration candidates never replace source records
ok 14 - damaged, mispaired and invalid migration candidates never replace source records
  ---
  duration_ms: 1.0633
  ...
# Subtest: retry reuses the exact encrypted request; a concurrent new edit retains a distinct revision
ok 15 - retry reuses the exact encrypted request; a concurrent new edit retains a distinct revision
  ---
  duration_ms: 0.5637
  ...
# Subtest: documented boundary: old valid ciphertext for the same field needs external replay protection
ok 16 - documented boundary: old valid ciphertext for the same field needs external replay protection
  ---
  duration_ms: 0.3593
  ...
# Subtest: actual Summary Note/copy text and Google Docs requests are identical after decryption
ok 17 - actual Summary Note/copy text and Google Docs requests are identical after decryption
  ---
  duration_ms: 2244.3904
  ...
1..17
# tests 17
# suites 0
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3772.6873
```
