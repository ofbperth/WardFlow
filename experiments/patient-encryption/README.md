# WardFlow encryption experiment

Prototype แยกสำหรับทดสอบการรักษา HN/ชื่อให้ตรงต้นฉบับ ใช้ข้อมูลสมมติทั้งหมด
ยังไม่เชื่อม application, Supabase, production หรือ Google APIs และไม่อ่าน .env
กุญแจสุ่มสร้างใน process ของการทดสอบเท่านั้น ไม่เขียนกุญแจลงไฟล์

## รัน

จาก C:/DEV/WardFlow:

```powershell
node --test experiments/patient-encryption/prototype.test.mjs
npx eslint experiments/patient-encryption/prototype.mjs experiments/patient-encryption/prototype.test.mjs
```

## ขอบเขต

- ใช้ AES-256-GCM ผ่าน Node crypto พร้อม IV สุ่ม 12 bytes และ authentication tag 16 bytes
- ผูก scope/team, Patient ID, ชื่อ field และ key ID ผ่าน authenticated additional data
- เก็บค่าเป็น string หรือ null เท่านั้น ไม่มี Number(), parseInt(), trim() หรือ Unicode normalization
- ถอดรหัสและตรวจ authentication ครบก่อนคืนค่า; ผิดกุญแจ/ข้อมูลเสีย/สลับคนให้ error
- ทดสอบ HN สมมติ 10,000 ค่า และ staging สมมติ 1,000 records รวม 5,000 fields
- ทดสอบ leading zeros, ตัวเลขยาว, ชื่อไทย, Unicode, emoji, note หลายบรรทัด, ค่าว่าง และ null
- ทดสอบแก้ทุก bit ของ IV/ciphertext/tag ในตัวอย่างหนึ่ง การสลับคน/field/team รูปแบบข้อมูลผิด และ key rotation
- โหลดตัวสร้าง Summary Note และ Google Docs requests จริงมาเทียบผลก่อน–หลังถอดรหัส โดยไม่ส่งเอกสารออกไป

## ข้อจำกัดที่ต้องรักษาไว้

- นี่ไม่ใช่ production encryption หรือ database migration; staging ใช้ array ใน memory เท่านั้น
- ผล nonce ไม่ซ้ำใน sample ไม่ใช่การรับรองว่าจะไม่เกิด collision ตลอดอายุระบบ
- ไม่ได้ทดสอบ browser, clipboard จริง, network retry จริง, concurrent SQL writes, RLS, log, backup หรือข้อมูลคนไข้จริง
- การลอง retry ในชุดนี้แสดงการ reuse encrypted request และ revision เท่านั้น ยังไม่เชื่อม production autosave
- Replay ciphertext เก่าที่ถูกต้องภายใน Patient ID/field เดิมยังผ่าน authentication ได้ จึงต้องใช้ revision/CAS ที่ฝั่งระบบ ไม่ใช่อาศัย encryption อย่างเดียว
- การอ่านข้อมูลหลังได้รับสิทธิ์ยังได้ plaintext; นี่เป็น prototype สำหรับ server-side encryption ไม่ใช่ E2EE
- ก่อนใช้งานจริงต้องออกแบบ key storage/rotation/recovery, สิทธิ์ถอดรหัส, migration ข้อมูลเดิม และครอบคลุม activity log/SQL RPC/export
- ชุดตัวอย่างเข้ารหัส 5 fields ที่ระบุใน protectedFields เท่านั้น ไม่ใช่การรับรองว่าไม่มี PHI ในทุกช่องของ WardFlow

เอกสารอ้างอิง: [Node 20 crypto](https://nodejs.org/docs/latest-v20.x/api/crypto.html), [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
