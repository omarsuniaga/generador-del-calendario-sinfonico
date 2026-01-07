
# 🎵 Sinfonía Calendar Core: Manual de Operaciones v1.5

## 1. Visión General
**Sinfonía Calendar Core** es una herramienta de planificación de grado profesional diseñada para instituciones musicales. Combina un motor visual de alta fidelidad con Inteligencia Artificial (Gemini API) para transformar la gestión académica en una experiencia estética y eficiente.

---

## 2. Capacidades del Menú de Herramientas

### ➕ Crear Eventos (Gestión de Eventos)
El punto de entrada principal para la planificación manual. 
- **Atributos:** Permite definir el Título, Fecha de Inicio, Fecha de Fin, Categoría (Color) y una Descripción técnica.
- **Validación:** El sistema asegura que las fechas sean coherentes y las integra automáticamente en las líneas de tiempo del canvas.

### 🏷️ Categorías (Gestión de Categorías)
Define el lenguaje visual de tu institución.
- **Identidad Cromática:** Crea etiquetas personalizadas (ej: "Gira Internacional", "Audiciones", "Mantenimiento") y asígnale un color único.
- **Impacto:** Todas las líneas de tiempo y decoraciones del calendario heredan los colores definidos aquí.

### 📋 Actividades (Lista de Eventos)
Un centro de control para la edición rápida del mes actual.
- **Listado Dinámico:** Muestra todos los eventos que ocurren en el mes seleccionado.
- **Edición en un Clic:** El botón de edición abre el panel de gestión avanzada del día, permitiendo cambiar iconos, formas y detalles logísticos.
- **Eliminación:** Limpieza rápida de la agenda con confirmación visual.

### 📅 Mes de Trabajo (Navegación Temporal)
Controla la ventana temporal del sistema.
- **Selector Rápido:** Cambia entre los 12 meses del año para planificar temporadas completas.
- **Actualización en Tiempo Real:** Al cambiar de mes, el canvas y el listado de actividades se sincronizan instantáneamente.

### ✨ Inteligencia Artificial (Creación asistida)
El módulo más avanzado del sistema para agilizar la carga de datos.
- **Prompting Natural:** Puedes escribir frases como *"Tengo un ensayo de orquesta el 15 de julio y un concierto de gala el día 20"*.
- **Flujo de Confirmación:** **Crítico.** La IA no escribe directamente en la base de datos. Genera una propuesta que el usuario debe validar (Confirmar o Descartar) para asegurar la precisión de los datos interpretados.

### 📥 Importar
- **Compatibilidad:** Soporta archivos `.json` (backups completos) y `.csv` (datos de tablas).
- **Flexibilidad:** Detecta automáticamente el formato y ofrece una vista previa antes de fusionar los datos con la sesión actual.

### 🚀 Exportar
- **Backup JSON:** Descarga toda la configuración (logo, categorías, eventos) para moverla a otro dispositivo.
- **Spreadsheet CSV:** Genera una hoja de cálculo con todos los eventos para análisis externo.

### 🏛️ Ajuste Institucional
- **Personalización:** Cambia el nombre de la institución y sube el logotipo oficial.
- **Impacto Visual:** Estos datos se renderizan en el encabezado del canvas principal, asegurando que cada exportación mantenga el branding oficial.

---

## 3. El Motor Visual (Canvas)
El calendario no es una simple cuadrícula; es un lienzo interactivo:
- **Líneas de Tiempo:** Conectan los días de inicio y fin con el color de la categoría, facilitando la lectura de la duración de proyectos.
- **Decoración de Celdas:** Permite encerrar días en **Círculos** o **Cuadros** con transparencia, ideal para resaltar hitos.
- **Iconografía Musical:** Biblioteca integrada de iconos (🎹, 🎻, 🎺) para identificar el tipo de actividad de un vistazo.
- **Días Feriados:** Marcador especial de "Día Feriado" que aplica un diseño distintivo (Bandera/Color Rojo) para alertar sobre la inactividad operativa.

---

## 4. Auditoría Logística (Analizar IA)
En la parte superior, el botón "Analizar IA" utiliza Gemini 3 Pro para auditar todo el calendario en busca de:
- **Conflictos de Horario:** Ensayos solapados en el mismo programa.
- **Inconsistencias:** Días de concierto sin ensayos previos recomendados.
- **Alertas Logísticas:** Notificaciones sobre la carga de trabajo institucional.

---
*Desarrollado para la excelencia en la gestión musical y operativa.*
