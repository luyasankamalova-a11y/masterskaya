// ULID: 48 бит времени + 80 бит случайности, Crockford base32.
// Уникален между устройствами и сортируется по времени создания.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = -1;
let lastRandom: number[] = [];

function randomDigits(): number[] {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b % 32);
}

export function ulid(now = Date.now()): string {
  let rand: number[];
  if (now === lastTime) {
    // Монотонность внутри одной миллисекунды: увеличиваем случайную часть.
    rand = lastRandom.slice();
    for (let i = rand.length - 1; i >= 0; i--) {
      if (rand[i] < 31) { rand[i]++; break; }
      rand[i] = 0;
    }
  } else {
    rand = randomDigits();
  }
  lastTime = now;
  lastRandom = rand;
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  return time + rand.map((d) => ALPHABET[d]).join('');
}
