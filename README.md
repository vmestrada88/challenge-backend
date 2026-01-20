# Challenge Backend - Event Management System

## Project Overview
This project is a Node.js backend for an Event Management System using Fastify. It interacts with external APIs and provides endpoints to view and add events.

## Production-Ready Configuration

### 1. Environment Variables
- Separated configuration using environment variables.
- Archivo `.env.example` agregado para mostrar las variables necesarias.

### 2. Git Ignore
- Archivo `.gitignore` para evitar subir archivos sensibles y dependencias (`node_modules`, `.env`, etc).

### 3. Linting y Formateo
- Configuración de ESLint (`.eslintrc.json`) para mantener la calidad del código.
- Configuración de Prettier (`.prettierrc`) para formato consistente.
- Scripts agregados en `package.json` para lint y format.

### 4. Scripts Útiles
- `npm run start`: Inicia el servidor en modo producción.
- `npm run dev`: Inicia el servidor en modo desarrollo con recarga automática (requiere `nodemon`).
- `npm run lint`: Ejecuta ESLint en todo el proyecto.
- `npm run format`: Formatea el código con Prettier.

### 5. Estructura de Carpetas
- `services/`: Lógica principal del backend.
- `mock-server/`: Mock de servicios externos para pruebas locales.
- `utils/`: Utilidades y helpers.

### 6. Dependencias
- Fastify para el servidor HTTP.
- MSW para simular servicios externos.

### 7. Testing (Pendiente)
- No hay tests automáticos. Se recomienda agregar Jest o similar para pruebas unitarias y de integración.

### 8. Seguridad y Buenas Prácticas
- No subir `.env` ni datos sensibles al repositorio.
- Usar variables de entorno para endpoints y configuraciones sensibles.
- Mantener dependencias actualizadas.

## Setup
```bash
npm install
cp .env.example .env # y personalizar si es necesario
npm start
```

## Decisiones
- Se eligió ESLint y Prettier por ser estándar en la industria.
- Se documentó cada configuración para facilitar onboarding y mantenimiento.
- Se recomienda agregar integración continua (CI) y tests en el futuro.

---

Para dudas, revisar el archivo `DevTask.md` para instrucciones específicas del challenge.
