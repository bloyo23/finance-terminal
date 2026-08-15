# Finance Terminal 🖥️💸

App de finanzas personales, 100% offline, instalable en iPhone desde Safari, sin servidores ni dominios pagos.

## Cómo ponerla a andar (sin instalar nada en tu compu de trabajo)

La forma más simple, ya que no podés instalar programas: **StackBlitz** (funciona 100% en el navegador).

1. Andá a **https://stackblitz.com** desde cualquier compu (podés usar el navegador de tu trabajo, no hace falta instalar nada).
2. Creá una cuenta gratis (podés entrar con Google).
3. Elegí "Import Project" o el botón de subir carpeta, y arrastrá la carpeta `finance-terminal` completa (o subí este ZIP y descomprimilo dentro de StackBlitz).
   - Alternativa: creá un repositorio nuevo y gratis en **GitHub** (github.com), subí ahí todos estos archivos, y después andá a `https://stackblitz.com/github/TU-USUARIO/TU-REPO` para abrirlo automáticamente.
4. StackBlitz va a detectar el `package.json`, instalar las dependencias solo, y levantar la app. Te va a dar una URL tipo `https://xxxx.stackblitz.io`.

## Cómo instalarla en tu iPhone

1. Abrí esa URL de StackBlitz **desde Safari en tu iPhone** (tiene que ser Safari, no Chrome).
2. Esperá a que cargue la app (fondo gris oscuro, letras "FINANCE TERMINAL").
3. Tocá el botón de **Compartir** (el cuadradito con la flecha hacia arriba).
4. Elegí **"Agregar a pantalla de inicio"**.
5. Confirmá. Ya te va a quedar un ícono como cualquier app.
6. Abrila desde ese ícono (no desde Safari) para que funcione en modo pantalla completa y guarde los datos localmente.

**Importante:** la primera vez que la abras necesitás tener internet (para que el iPhone descargue y guarde en caché todos los archivos). Después de esa primera carga, funciona 100% sin conexión — vas a poder cargar movimientos en el subte, sin wifi, donde sea.

## Dónde se guardan tus datos

Todo se guarda en el propio iPhone, en una base de datos local (IndexedDB) dentro de Safari. Nada sale a internet, no hay servidores, no hay que pagar nada.

⚠️ Ojo: si algún día borrás la app o los datos de Safari, se pierde todo (no hay backup en la nube). Si querés, más adelante te puedo agregar una función de "exportar/importar" para hacer copias de seguridad manuales.

## Sobre el tipo de cambio (USDT → ARS)

DolarHoy.com no tiene una API pública que se pueda consultar directo desde el navegador. Usé **dolarapi.com** (gratuita, sin registro, con los mismos valores tipo blue/cripto). Si en algún momento no hay internet o la API no responde, la app usa automáticamente el último valor que hayas cargado a mano (botón "Editar" en el Dashboard).

## Categorías predefinidas

Arranqué la app con categorías ya armadas según tu perfil (Alquiler, Expensas, Servicios, Comida perros, Venta/Compra de flores, etc.), pero **sin ninguna cuenta ni movimiento cargado** — eso lo vas cargando vos desde cero.

## Estructura del proyecto

```
finance-terminal/
├── index.html
├── package.json
├── vite.config.ts          ← configuración de la PWA (manifest, iconos, cache offline)
├── tsconfig.json
├── public/icons/           ← iconos de la app
└── src/
    ├── main.tsx
    ├── App.tsx              ← las 4 pantallas + modales
    ├── index.css            ← estilo "hacker financiero"
    ├── types/finance.ts     ← tipos de datos
    ├── db/db.ts             ← base de datos local (Dexie/IndexedDB)
    ├── store/financeStore.ts← lógica de negocio (Zustand)
    ├── services/exchangeRateService.ts
    └── utils/money.ts       ← cálculos (liquidez, flujo, Pareto, ahorro)
```
