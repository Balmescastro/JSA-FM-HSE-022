# Especificación Técnica — FM-HSE-022 (versión _AN_ mejorada)
## Documento maestro para integración de campos rellenables

> Extracción directa del XML de `FM-HSE-022_Análisis_continuo_de_peligros_AN_.docx`
> Esta versión incorpora mejoras del autor: pie de página real, tablas independientes por columna y tipografía unificada Arial Narrow.

---

## Cambios respecto a la versión anterior

| Aspecto | Versión anterior | Versión _AN_ (esta) |
|---|---|---|
| Pie de página | Text box en el cuerpo | **Footer real (footer1.xml) con campo PAGE automático** |
| Número de página | Texto manual | **Campo automático `PAGE \* MERGEFORMAT`** |
| Tipografía | Arial + Arial Narrow mixto | **Arial Narrow unificada en todo** |
| Checkbox | MS Gothic | **Segoe UI Symbol** |
| Página 2 | Generada por flujo (no existía) | **Integrada como filas en Tabla 5** |
| Estructura de columnas | Tablas + flujo | **Tablas independientes por columna** |

---

## 1. Configuración de página

| Propiedad | Valor |
|---|---|
| Tamaño | Carta (Letter) — 279.4 × 215.9 mm |
| Orientación | Horizontal (Landscape) |
| Márgenes (4 lados) | 12.7 mm |
| Distancia a encabezado | 11.99 mm |
| Distancia a pie | 11.99 mm |
| Secciones | 1 |
| Columnas de sección | 3 × 76.341 mm, separación 12.488 mm |
| Área útil | 254.0 × 190.5 mm |

---

## 2. Pie de página (mejora clave)

Ahora existe un **footer real** (`word/footer1.xml`), no un cuadro de texto:

| Elemento | Valor |
|---|---|
| Texto | "Copia no Controlada" |
| Número de página | Campo automático `PAGE \* MERGEFORMAT` |
| Fuente | Arial Narrow |
| Tamaños | 8 pt (texto), 7 pt y 24 pt (número de página en distintos puntos) |
| `different_first_page` | No (mismo footer en todas las páginas) |

> **Ventaja para la app:** el número de página se numera solo. Una conversión que respete campos de Word lo actualiza automáticamente; una reconstrucción debe inyectar el número real.

---

## 3. Tipografía — unificada Arial Narrow

Toda la tipografía es **Arial Narrow** (eliminada la mezcla con Arial). Esto simplifica la reproducción: una sola familia de fuente para todo el documento.

| Elemento | Fuente | Tamaño | Estilo | Alineación |
|---|---|---|---|---|
| Título encabezado | Arial Narrow | 10 pt | Bold | Centro |
| Etiqueta metadatos | Arial Narrow | 7 pt | Bold | Izquierda |
| Valor metadatos | Arial Narrow | 7 pt | Regular | Centro |
| Lugar / Fecha / Tarea (etiqueta) | Arial Narrow | 10 pt | Bold | — |
| Lugar / Fecha / Tarea (valor) | Arial Narrow | 10 pt | Regular | — |
| Texto compromiso | Arial Narrow | 9 pt | Itálica | — |
| Responsables header/subheader | Arial Narrow | 10 pt | Bold | Centro |
| Punto encuentro / Ducha (label) | Arial Narrow | 10 pt | Bold | — |
| Señales header | Arial Narrow | 10 pt | Bold | Centro |
| Señales instrucción | Arial Narrow | 9 pt | Regular | Justificado |
| Casilla ☐ | **Segoe UI Symbol** | 8.5 pt | Regular | — |
| Señales texto | Arial Narrow | 8.5 pt | Regular | — |
| Peligros título | Arial Narrow | 8.5 pt | Regular | Justificado |
| Peligros categoría | Arial Narrow | 7.5 pt | Bold | Centro |
| Peligros ítem | Arial Narrow | 7 pt | Bold | — |
| Controles header | Arial Narrow | 8 pt | Bold | Centro |
| Controles texto | Arial Narrow | 7.5 pt | Regular | — |
| Página 2 headers | Arial Narrow | 10 pt | Bold | Centro |
| Footer texto | Arial Narrow | 8 pt | Regular | — |

Interlineado: sencillo. Sin espacio antes/después salvo los 9 párrafos del cuerpo que definen spacing propio. Sin sangrías.

---

## 4. Estructura de tablas (6 tablas independientes)

| Tabla | Función | Filas × Cols | Anchos (mm) |
|---|---|---|---|
| T0 | Encabezado (logo/título/metadatos) | 4 × 4 | 15.61 / 34.13 / 12.44 / 14.55 |
| T1 | Responsables | 10 × 3 | 32.00 / 23.00 / 24.01 |
| T2 | Punto encuentro + Ducha | 4 × 1 | 79.01 |
| T3 | Señales para detener | 10 × 2 | 39.53 / 39.48 |
| T4 | Catálogo de peligros | 45 × 2 | 39.49 / 39.51 |
| T5 | Guía controles **+ Página 2** | 32 × 4 | 10.00 / 0.34 / 63.27 / 2.42 |

Márgenes de celda: default de Word (1.9 mm izq/der, 0 arriba/abajo) en todas.
Bordes: línea sencilla 0.5 pt.

### Nota sobre T5

La Tabla 5 ahora integra **dos contenidos**: las medidas de control (filas 0-1, con `gridSpan=4`) y la **Página 2** (Pasos/Peligros/Medidas), cada bloque con 9 filas de datos + 1 header. Las filas de pasos miden 19.403 mm de alto. La columna Ítem mide ~10 mm.

---

## 5. Encabezado (T0)

| Celda | Contenido | Tipografía |
|---|---|---|
| [0,0] | Logo (combinado vertical en las 4 filas) | imagen |
| [0-3,1] | "ANÁLISIS CONTINUO DE PELIGROS POR LA TAREA" (combinado) | Arial Narrow 10 pt Bold, centro |
| [0,2]/[0,3] | Código: / FM-HSE-022 | Arial Narrow 7 pt |
| [1,2]/[1,3] | Página: / Pie de pág. | Arial Narrow 7 pt |
| [2,2]/[2,3] | Revisión: / 1 | Arial Narrow 7 pt |
| [3,2]/[3,3] | Fecha: / 11-mar-2026 | Arial Narrow 7 pt |

---

## 6. CAMPOS RELLENABLES por la aplicación

### 6.1 Información general (párrafos, Columna 1)

| Campo | Etiqueta | Tipografía | Formato |
|---|---|---|---|
| **Lugar** | `Lugar:` (Bold) | Arial Narrow 10 pt | texto libre sobre línea `___` |
| **Fecha** | `Fecha:` (Bold) | Arial Narrow 10 pt | fecha |
| **Tarea** | `Tarea:` (Bold) | Arial Narrow 10 pt | texto libre |

### 6.2 Responsables (T1) — máx. 8

| Columna | Ancho | Rellenable |
|---|---|---|
| Nombre | 32.00 mm | ✅ |
| Cédula | 23.00 mm | ✅ |
| Firma | 24.01 mm | ❌ manuscrita |

Filas de datos: 4.992 mm de alto.

### 6.3 Ubicación (T2)

| Campo | Etiqueta (fija) | Altura label / valor |
|---|---|---|
| **puntoEncuentro** | Punto de encuentro cercano: | 2.999 / 4.992 mm |
| **duchaLavaojos** | Ducha y lavaojos cercano: | 2.999 / 4.992 mm |

### 6.4 Señales (T3) — 16 opciones marcables

Casilla en **Segoe UI Symbol 8.5 pt**, texto Arial Narrow 8.5 pt. Header 2.999 mm, instrucción 8.996 mm, filas 4.992 mm.
13 casillas fijas + 3 "Otros" con texto libre.

### 6.5 Peligros (T4) — selección, 61 códigos

Catálogo fijo, 12 categorías. Título 6.297 mm; categoría 3.792 mm (Bold 7.5 pt); ítem 3.493 mm (7 pt).

### 6.6 Controles (T5 filas 0-1) — selección, 43

### 6.7 Página 2 (T5 filas 2-31) — 3 bloques × 9 filas

| Bloque | Filas | Header | Rellenable |
|---|---|---|---|
| Pasos de la Tarea | 9 | F2 | ✅ texto |
| Peligros Identificados | 9 | F12 | ✅ códigos |
| Medidas Preventivas y de Control | 9 | F22 | ✅ números |

Columna Ítem ~10 mm; filas de datos 19.403 mm. ITEM = número de paso, coincidente en los 3 bloques.

---

## 7. Observaciones para la aplicación

1. **Tipografía única (Arial Narrow)** simplifica la reproducción: una sola familia para embeber.
2. **El checkbox usa Segoe UI Symbol**, no MS Gothic. Es una fuente de Windows; en una reconstrucción conviene usar **casilla vectorial** (rectángulo dibujado) para no depender de ella.
3. **El footer con campo PAGE** se numera automáticamente; al reconstruir debe inyectarse el número de página real.
4. **La Página 2 ya está modelada en el DOCX** (dentro de T5) — a diferencia de la versión anterior donde no existía. Esto facilita la reproducción fiel.
5. Las **tablas son independientes por columna**, lo que hace el layout más predecible que el flujo de columnas anterior.
