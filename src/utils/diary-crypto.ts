import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
export function encryptDiary(text: string) {
 const salt = randomBytes(16), iv = randomBytes(12);
 const key = pbkdf2Sync('20031016', salt, 210000, 32, 'sha256');
 const cipher = createCipheriv('aes-256-gcm', key, iv);
 const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()]);
 return { salt: salt.toString('base64'), iv: iv.toString('base64'), data: data.toString('base64') };
}
