# BÖDEN · Sistema de Alertas de Mantenimiento

PWA para que el personal del Hotel BÖDEN reporte problemas de mantenimiento y el
equipo los tome, resuelva y cierre. Anda en **compu y celular**, se instala como app
y manda **notificaciones push**.

Stack: **Node.js + Express + PostgreSQL + JWT**, frontend PWA (HTML/CSS/JS), hosting **Render**.

> Proyecto independiente de LuconiOS y Biletta/FleetOS. No comparte código ni base de datos.

---

## Usuarios de prueba (se cargan solos la primera vez)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@boden | boden123 | admin |
| jefe@boden | boden123 | jefe de mantenimiento |
| diego@boden | boden123 | mantenimiento |
| martin@boden | boden123 | mantenimiento |
| recepcion@boden | boden123 | recepción (reporta) |
| mucama@boden | boden123 | mucama (reporta) |

> ⚠️ Cambiá estas contraseñas antes de usarlo en serio.

---

## Cómo subirlo a GitHub

**Opción fácil — GitHub Desktop**
1. Abrí GitHub Desktop → *File → New repository* → nombre `boden`.
2. Copiá **todos los archivos de esta carpeta** adentro del repo (respetando las carpetas).
3. *Commit* → *Publish repository* (podés dejarlo privado).

**Opción web (subir el ZIP)**
1. En github.com creá un repo nuevo `boden`.
2. *Add file → Upload files* y arrastrá la carpeta (o descomprimí el ZIP y subí todo).
3. *Commit changes*.

> No subas la carpeta `node_modules` ni el archivo `.env` (ya están en `.gitignore`).

---

## Cómo desplegarlo en Render

### 1) Crear la base de datos
1. En Render → **New + → PostgreSQL**.
2. Nombre `boden-db`, plan Free, *Create*.
3. Cuando termine, copiá la **Internal Database URL** (la vas a pegar en el paso 3).

### 2) Crear el Web Service
1. **New + → Web Service** → conectá tu repo `boden` de GitHub.
2. Configuración:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
3. *Create Web Service*.

### 3) Variables de entorno (Environment)
En el Web Service → pestaña **Environment**, agregá:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | la Internal Database URL del paso 1 |
| `JWT_SECRET` | una frase larga y random (inventala) |

Guardá. Render redeploya solo. **La base de datos se crea sola** la primera vez que arranca
(crea las tablas y carga los usuarios de prueba). No hace falta correr scripts a mano.

### 4) Listo
Entrá a la URL que te da Render (algo tipo `https://boden.onrender.com`).
Desde el celu: abrí esa URL en Chrome → menú → **"Agregar a pantalla de inicio"**.

---

## Activar las notificaciones push (opcional, recomendado)

Sin esto la app anda igual, pero con la campana in-app nomás. Para el push al celular:

1. En tu compu, dentro de la carpeta del proyecto, corré una vez:
   ```
   npm install
   npm run gen-vapid
   ```
2. Te imprime tres líneas (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
3. Pegá esas tres como **variables de entorno en Render** (igual que en el paso 3 de arriba).
4. Render redeploya y el push queda activo.

> **iOS:** Apple solo permite push si el usuario **primero agrega la app a la pantalla de
> inicio** (iOS 16.4+). En Android/Chrome funciona directo.

---

## Correr en tu compu (local, opcional)

Necesitás PostgreSQL instalado.
```
cp .env.example .env       # y completá DATABASE_URL y JWT_SECRET
npm install
npm start
```
Abrí http://localhost:3000

---

## Estructura del proyecto

```
boden/
├── server.js              punto de entrada
├── package.json
├── db/schema.sql          esquema de la base (se corre solo)
├── src/
│   ├── db.js              conexión + carga inicial de datos
│   ├── auth.js            JWT + permisos por rol
│   ├── push.js            envío de notificaciones
│   └── routes/            auth, alertas, catalogos, push, reportes
├── scripts/gen-vapid.js   genera las claves de push
└── public/                la PWA (frontend)
    ├── index.html
    ├── app.js  app.css
    ├── manifest.json  sw.js
    └── icons/
```

## Roles y permisos

- **recepción / mucama / personal:** crean alertas, ven solo las suyas.
- **mantenimiento:** ve la cola, toma, marca en proceso y resuelve.
- **jefe de mantenimiento:** todo lo anterior + asigna, reprioriza, **cierra** y ve el panel.
- **admin:** gestiona usuarios, ubicaciones y categorías.

## Flujo de una alerta

```
NUEVA → ASIGNADA → EN_PROCESO → RESUELTA → CERRADA
                                    ↘ REABIERTA
        ↘ CANCELADA
```
Cada paso queda registrado en el historial (quién, cuándo, nota).
