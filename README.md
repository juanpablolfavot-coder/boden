# BÖDEN · Mantenimiento Hotelero

PWA deliberadamente simple para que el personal reporte incidencias, los técnicos
ejecuten y documenten, y la supervisión asigne y verifique el cierre.

Stack: **Node.js + Express + PostgreSQL + JWT**, frontend PWA (HTML/CSS/JS), hosting **Render**.

> Proyecto independiente de LuconiOS y Biletta/FleetOS. No comparte código ni base de datos.

---

## Acceso inicial seguro

En una base nueva se crea **solo el administrador** con email `admin@boden`.
La contraseña inicial debe definirse mediante la variable privada
`BODEN_ADMIN_PASSWORD` (mínimo 16 caracteres). El secreto de sesiones
`JWT_SECRET` es obligatorio (mínimo 32 caracteres).

No se crean usuarios de prueba ni contraseñas conocidas. Crear y asignar
las cuentas de empleados desde el panel de administración y cambiar la
contraseña inicial antes de entregar el sistema al hotel.

No se publican ni se generan usuarios de prueba, contraseñas conocidas,
habitaciones, turnos ni equipos ficticios.

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
| `JWT_SECRET` | secreto aleatorio de 32+ caracteres |
| `BODEN_ADMIN_PASSWORD` | contraseña inicial aleatoria de 16+ caracteres |

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



## Identidad visual BÖDEN · AKEN SOUL (octubre 2026)

La plataforma interna adopta el lenguaje visual del sitio oficial
[bodenhotel.com](https://bodenhotel.com/es/about/) y de la marca AKEN SOUL,
sin replicar la web pública ni incorporar módulos de reservas.

**Componentes y criterios**
- Carbón cálido `#302F2E` y negro `#211E1B` para navegación y superficies oscuras.
- Arena `#D0BDAB`, champagne `#B79A80`, crema `#EEE8DF` y blanco
  cálido `#F8F5F0`; uso contenido de rojo/verde reservado a estados reales.
- Fuente `Jost` con pesos livianos para la identidad, navegación, titulares
  y formularios; `Inter` para números de métricas y datos operativos.
- Wordmark tipográfico BÖDEN / AKEN SOUL; reemplazar por SVG oficial
  suministrado por el hotel cuando esté disponible.
- Fondos editoriales propios en CSS: no dependen de fotografías, fuentes ni
  otros recursos externos que puedan cambiar o bloquearse.
- Estética editorial: navegación silenciosa, espacios consistentes,
  bordes discretos, iconografía simple y contrastes suficientemente legibles.
- **Una única aplicación** para alertas, trabajos, equipos, mantenimiento
  preventivo, repuestos, herramientas, personal, turnos y sectores.
- Imágenes decorativas solo en login y cabecera; los formularios, las tablas
  y las acciones técnicas priorizan legibilidad, rapidez y accesibilidad.
- `public/boden-brand.css` contiene los tokens y las adaptaciones de identidad.
  El resto del CSS y las API conservan el comportamiento y los permisos
  existentes. Hay degradación visual a fondo carbón si una imagen no carga.

**Criterios para revisar la experiencia:**
1. Login en computadora y móvil sin desplazamientos innecesarios.
2. Registro de incidencias, trabajos y repuestos en pocos pasos.
3. Lectura de prioridad, sector, estado y acciones sin depender solo del color.
4. Disponibilidad del inventario: sin mostrar 100% cuando aún no hay activos
   registrados.
5. Fotos no deben utilizarse para encubrir o dificultar avisos urgentes.


## MaintenanceOS v2 · gestión integral del hotel (octubre 2026)

La portada `/` concentra todos los módulos operativos y administrativos en una
única interfaz. Se incorporan pantallas nativas para personal, turnos,
ubicaciones, categorías, historial de alertas, fotografías y asignaciones.
La interfaz anterior se conserva solo en el historial de Git para recuperación.

### Módulos disponibles

- **Centro de control**: disponibilidad de activos, vencimientos, consumo
  de stock, trabajos recientes, productividad y alertas.
- **Equipos e instalaciones**: código único, familia, sector/ubicación, serie,
  marca/modelo, garantía, criticidad, estado e historial de intervenciones.
  Catálogo de familias técnicas para hoteles: HVAC, bombas, calderas, grupos
  electrógenos, ascensores, contra incendios, piscina, spa, lavandería, cocina,
  habitaciones, infraestructura y más. No se cargan activos ficticios.
- **Mantenimiento preventivo**: frecuencia y próxima fecha por equipo,
  instrucciones de servicio, responsable y cumplimiento desde el celular.
  Completar un preventivo genera automáticamente un parte firmado por usuario
  y reprograma el siguiente servicio.
- **Partes de trabajo**: registro diario manual por técnico, con tiempo, equipo,
  alerta asociada, descripción, tipo, estado y resultado; la autoría se toma
  del token, no se puede suplantar desde el formulario.
- **Almacén de repuestos**: SKU, mínimos, ubicación, proveedor y cantidad.
  Ingresos/consumos/ajustes en kardex auditable; se rechazan saldos negativos,
  incluso ante concurrencia.
- **Herramientas**: ficha, condición, ubicación, estado, préstamo nominativo,
  devolución y trazabilidad. Los cambios de custodia son transaccionales.
- **Alertas**: se mantienen la gestión anterior, las prioridades y los permisos.

### Permisos

Recepción/mucamas pueden reportar alertas. Técnicos ven activos, planificaciones,
almacén y registran su propio trabajo; pueden consumir stock y pedir/prestar a sí
mismos herramientas. Jefatura/administración administra catálogos técnicos,
repuestos, planes y préstamos a otros empleados. La administración de usuarios, turnos y sectores se realiza desde el mismo menú.

### Despliegue

Render `boden` utiliza Node y PostgreSQL `boden-db` con las variables
`DATABASE_URL`, `JWT_SECRET` y `BODEN_ADMIN_PASSWORD` (requerida solo
cuando la base de usuarios está vacía). Las migraciones nuevas están en
`db/operations.sql` y son aditivas; no se eliminan tablas existentes.
No almacenar secretos en GitHub. Se requiere respaldo de PostgreSQL antes de
cambios importantes en producción.

### Próximas mejoras recomendadas

Integración de lectores de medidores (horómetros, temperatura, presión),
checklists normativos específicos del establecimiento, adjuntos fotográficos
de OT, informes PDF, aprobación de compras y notificaciones push VAPID.
Las reglas y frecuencias regulatorias dependen de la jurisdicción y del equipo;
no se presuponen sin relevamiento técnico.


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
