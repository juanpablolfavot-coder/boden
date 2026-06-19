// Genera el par de claves VAPID para las notificaciones push.
// Uso:  npm run gen-vapid
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();

console.log('\n=== Claves VAPID generadas ===\n');
console.log('Pegá esto en las Environment Variables de Render (o en tu .env):\n');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_SUBJECT=mailto:mantenimiento@boden.com');
console.log('\nGuardalas: la privada NO se vuelve a mostrar.\n');
