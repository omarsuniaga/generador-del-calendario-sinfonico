
# 🎵 Sinfonía Calendar Core: Documentación del Sistema

## 1. Visión General
**Sinfonía Calendar Core** es una plataforma de ingeniería frontend de alto rendimiento diseñada para la planificación estratégica de instituciones musicales (Orquestas, Coros y Conservatorios). El sistema combina un motor de renderizado de alta fidelidad con inteligencia artificial generativa para transformar la logística compleja en cronogramas visuales elegantes y planes operativos formales.

---

## 2. Guía Detallada del Menú Lateral (Sidebar)

El menú lateral es el centro de control operativo del sistema. A continuación se detallan las funciones de cada sección:

### 📥 Crear Eventos
*   **Función:** Permite la entrada manual de actividades individuales.
*   **Capacidades:**
    *   **Título y Rango:** Definición del nombre del evento y sus fechas de inicio/fin.
    *   **Varita Mágica (Magic Fill):** Un botón integrado con IA que autocompleta fechas y programas analizando solo el título ingresado.
    *   **Asignación de Categoría:** Vinculación inmediata a los perfiles de color definidos.

### 🏷️ Categorías
*   **Función:** Gestión del sistema de codificación por colores de la institución.
*   **Capacidades:**
    *   **Personalización:** Creación, edición y eliminación de etiquetas (ej: "Conciertos", "Feriados", "Ensayos").
    *   **Selector Hexadecimal:** Control total sobre la paleta cromática para coherencia con la identidad visual institucional.

### 📋 Actividades
*   **Función:** Listado dinámico y filtrado de los eventos registrados para el mes seleccionado.
*   **Capacidades:**
    *   **Gestión de Ciclo de Vida:** Acceso rápido para **Posponer** (reprogramar manteniendo el historial), **Suspender** (marcar como inactivo visualmente) o **Eliminar**.
    *   **Focus Mode:** Al hacer clic, la actividad se resalta tanto en el listado como en el Canvas principal.

### 📅 Mes de Trabajo
*   **Función:** Selector rápido de navegación temporal.
*   **Capacidades:** Permite saltar entre los 12 meses del año de gestión actual para visualizar y editar cronogramas específicos de forma instantánea.

### ✨ Inteligencia Artificial
*   **Función:** Procesamiento de lenguaje natural masivo (NLP).
*   **Capacidades:** Área de texto donde el usuario puede escribir párrafos complejos (ej: "Agrega ensayos de coro todos los martes de marzo y un concierto el día 30"). La IA parsea el texto y crea múltiples entradas automáticamente.

### 🔔 Notificaciones IA
*   **Función:** Feed de retroalimentación del asistente inteligente.
*   **Capacidades:** Muestra advertencias logísticas, sugerencias de optimización de tiempos y alertas de conflictos de horarios detectadas tras el análisis de la agenda.

### 📤 Importar Eventos
*   **Función:** Migración de datos externos al sistema.
*   **Capacidades:**
    *   **Modo Texto (CSV):** Pegado directo de registros separados por comas.
    *   **Modo Archivo:** Carga de archivos `.csv` o `.txt` con detección automática de cabeceras (Títulos, Fechas, Programas).

### 🚀 Exportar
*   **Función:** Generación de entregables profesionales.
*   **Capacidades:**
    *   **Plan Operativo (DOCX):** La IA redacta un documento formal en Word con objetivos y justificación académica basada en tus eventos.
    *   **PNG / PDF:** Capturas de alta resolución del calendario visual para impresión o envío por WhatsApp/Correo.

### ⚙️ Ajustes Institucionales
*   **Función:** Configuración de la identidad de marca del calendario.
*   **Capacidades:** Cambio del nombre de la institución (que actualiza todos los encabezados y documentos) y carga del logotipo oficial.

---

## 3. Capacidades de Inteligencia Artificial (Gemini API)

El sistema integra modelos **Gemini 3 (Flash y Pro)** para flujos de trabajo críticos:

1.  **Auto-Programación:** Conversión de lenguaje natural en objetos de datos estructurados.
2.  **Análisis de Conflictos:** Escaneo de base de datos buscando sobrecargas de músicos o espacios.
3.  **Generación de POI:** Redacción de planes operativos institucionales formales.

---

## 4. Especificaciones Técnicas

*   **Lienzo (Canvas):** 1280x720px con soporte para Zoom y Panning.
*   **Persistencia:** Guardado automático en el navegador.
*   **Exportación:** Alta fidelidad (2x Pixel Ratio) para evitar pixelación en impresiones grandes.

*Desarrollado para la excelencia en la gestión musical académica.*
