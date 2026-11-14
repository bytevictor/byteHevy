# ByteHevy 🏋️‍♂️⚡

**ByteHevy** es una plataforma personal de analítica de fuerza, seguimiento de progresión y gestión de entrenamientos diseñada para atletas y levantadores. Permite importar historiales completos de aplicaciones como **Hevy** y **JEFIT**, visualizar curvas de progresión avanzadas, organizar el entrenamiento en temporadas (**Seasons**) y definir objetivos inteligentes de carga y repeticiones.

<img width="1503" height="923" alt="image" src="https://github.com/user-attachments/assets/a96fc90e-ded9-487e-880b-b7f544f4bd1a" />

<img width="1462" height="919" alt="image" src="https://github.com/user-attachments/assets/33004b6f-e234-405b-941c-7a662ddcb7a7" />


---

## 🚀 Características Principales

- 📈 **Explorador de Progresión**:
  - Curvas de rendimiento interactivas (Lineal, Suavizada y Fluida continua).
  - Vistas por sesión uniforme o distribución temporal exacta por fecha.
  - Métricas dinámicas: **Peso Máximo (Top Set)** y **1RM Medio Estimado** (fórmula Brzycki).
  - Detección automática de **PR Progresivo**, **PR de Season** y **Récord Histórico (All-Time)**.
  - **Líneas horizontales de referencia de objetivo**: Si un ejercicio tiene meta de peso y repeticiones, se dibuja automáticamente el objetivo en las gráficas tanto de carga máxima como de 1RM medio.
- 🎯 **Gestión de Objetivos**:
  - Tarjetas comparativas en tiempo real: *Récord de Season*, *Récord Histórico* y *Objetivo Ideal*.
  - Alertas inteligentes de estado: Badge pulsante animado **`Recuperar`** cuando un objetivo fue conquistado históricamente pero aún no en la season actual.
- 🏆 **Sistema de Seasons (Temporadas)**:
  - Periodización por bloques de entrenamiento con rangos de fechas y paletas de color personalizadas.
  - Filtrado instantáneo entre temporadas pasadas o la temporada activa en curso.
- 📓 **Diario de Sesiones (Journal)**:
  - Calendario mensual interactivo con mapa de calor de intensidad y racha de entrenamiento activa.
  - Desglose detallado por sesión con series, peso, repeticiones, RPE, tonelaje acumulado y notas.
- 🔄 **Sincronización e Importación**:
  - Motor de ingesta y reconciliación para archivos CSV exportados desde **Hevy** y **JEFIT**.
  - Detección y prevención de duplicados con mapeo de ejercicios y tipos de métricas.
- 🎬 **Visor Multimedia de Ejercicios**:
  - Animaciones 3D e información muscular primaria/equipamiento integrados mediante caché local.

---

## 🛠️ Stack Tecnológico

- **Runtime & Gestor de Paquetes**: [Bun](https://bun.sh/) (v1.1+)
- **Framework Frontend & API**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Librería UI**: [React 19](https://react.dev/)
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Base de Datos**: [SQLite](https://sqlite.org/) gestionado con [@libsql/client](https://github.com/tursodatabase/libsql-client-ts) (modo WAL y reconexión auto-recuperable)

---

## 📦 Guía de Instalación y Ejecución con Bun

### 1. Requisitos Previos

Asegúrate de tener instalado **Bun** en tu sistema. Si aún no lo tienes, puedes instalarlo ejecutando en tu terminal:

#### En Linux / macOS / WSL:
```bash
curl -fsSL https://bun.sh/install | bash
```

#### En Windows (PowerShell):
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verifica la instalación:
```bash
bun --version
```

---

### 2. Clonar el Repositorio

Clona el proyecto en tu máquina local y accede a su directorio:

```bash
git clone https://github.com/tu-usuario/bytehevy.git
cd bytehevy
```

---

### 3. Instalar Dependencias con Bun

Instala todos los paquetes requeridos utilizando el gestor de paquetes de Bun (mucho más rápido que npm o pnpm):

```bash
bun install
```

---

### 4. Base de Datos Local

ByteHevy utiliza SQLite local mediante **libSQL**. 

- No necesitas instalar ningún servicio de base de datos externo (como PostgreSQL o MySQL).
- El esquema, índices y tablas se inicializan automáticamente en `data/bytehevy.db` la primera vez que se inicia la aplicación.

---

### 5. Iniciar el Servidor de Desarrollo

Ejecuta el servidor de desarrollo de Next.js potenciado por Turbopack:

```bash
bun dev
```

Abre tu navegador en:
👉 **[http://localhost:3000](http://localhost:3000)**

---

### 6. Compilación y Ejecución para Producción (Opcional)

Si deseas compilar la aplicación para un entorno de producción:

1. **Generar el build optimizado**:
   ```bash
   bun run build
   ```

2. **Iniciar el servidor de producción**:
   ```bash
   bun start
   ```

---

## 📋 Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `bun dev` | Inicia el servidor de desarrollo en `http://localhost:3000` con Turbopack |
| `bun run build` | Compila y optimiza la aplicación para producción |
| `bun start` | Inicia el servidor de producción con la compilación generada |
| `bun run lint` | Ejecuta ESLint para analizar la calidad y estilo del código |

---

## 📂 Estructura del Proyecto

```text
bytehevy/
├── app/                  # Rutas App Router y API endpoints de Next.js
│   ├── api/              # Endpoints REST (ejercicios, metas, sincronización, seasons)
│   ├── globals.css       # Estilos globales y temas Tailwind v4
│   ├── layout.tsx        # Layout principal de la aplicación
│   └── page.tsx          # Página principal y contenedor de pestañas
├── components/           # Componentes modulares de React
│   ├── charts/           # Gráficas interactivas SVG (ProgressionChart)
│   ├── skeletons/        # Componentes de carga esqueleto
│   ├── ExplorerTab.tsx   # Explorador detallado de ejercicios y analítica
│   ├── GoalsTab.tsx      # Tablero de objetivos y récords comparativos
│   ├── JournalTab.tsx    # Historial de sesiones y calendario mensual
│   ├── SeasonsTab.tsx    # Gestión de bloques de entrenamiento
│   └── SyncTab.tsx       # Importador CSV de Hevy y JEFIT
├── data/                 # Directorio de datos locales (base de datos SQLite bytehevy.db)
├── lib/                  # Lógica de negocio, consultas SQL, colores y contextos
│   ├── actions.ts        # Métodos de acceso a datos y cálculos de fuerza
│   ├── db.ts             # Cliente SQLite resiliente con auto-healing
│   └── season-context.tsx# Contexto global de temporada activa
└── package.json          # Metadatos del proyecto y dependencias de Bun
```

---

## 📄 Licencia

Este proyecto está bajo licencia privada para uso personal y de código abierto bajo términos MIT.
