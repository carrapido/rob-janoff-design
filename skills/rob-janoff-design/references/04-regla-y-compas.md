# Método de regla y compás (serie áurea)

Cada curva del logo es un arco de un círculo de **una sola serie**; ninguna medida se elige a ojo. El método convierte la intuición de Janoff ("juega con el espacio, la proporción y el peso hasta que el diseño se sienta inevitable") en geometría que se puede medir, explicar y repetir. Los ejemplos vienen de un logo real hecho así: un gato construido en un marco de 700 unidades.

## 1. La serie

- **Fórmula:** `R(n) = R0 / φⁿ`, con φ ≈ 1.618 ([proporción áurea](https://en.wikipedia.org/wiki/Golden_ratio)). R0 es el radio de la forma principal; los diámetros son `D(n) = 2·R(n)`.
- **Ejemplo con R0 = 240:** R−1 388.3 · R0 240 · R1 148.3 · R2 91.7 · R3 56.7 · R4 35 · R5 21.6 · R6 13.4 · R7 8.3.
- **Propiedad que más se usa:** `R(n) = R(n+1) + R(n+2)`. Un contorno parejo de R4 alrededor de una esquina R2 deja una esquina R3 en el mismo centro (R2 − R4 = R3), así que los desfases también caen en la serie.
- **Pendiente áurea:** 1 de ancho por φ de alto (por ejemplo, un colmillo que baja R3 y entra R4).

## 2. Construcción

1. **Origen y cuadrado:** pon el origen en el centro de la forma principal y dibuja su cuadrado contenedor. Toda posición se nombra como una distancia de la serie desde ese centro o desde los lados del cuadrado ("la punta de la oreja, D5 sobre el lado de arriba").
2. **Solo arcos de la serie:** cada `A` del SVG declara un radio de la serie. Las banderas large-arc y sweep se verifican calculando el centro que el navegador elegirá ([conversión de extremos a centro](https://www.w3.org/TR/SVG2/implnote.html#ArcConversionEndpointToCenter)) y comparándolo con el centro de la construcción.
3. **Simetría:** al reflejar en x, invierte la bandera sweep; si además el tramo se recorre al revés, la bandera se conserva.
4. **Uniones sin quiebre:** cuando dos curvas se encuentran, usa un arco tangente: su centro está sobre la recta que une el centro del primer arco con el punto de contacto. Un solo arco tangente no puede pasar por una esquina; ahí se encadenan dos (un párpado R4 que sigue, tangente, en un arco R−1).
5. **Encuadre:** los márgenes también son de la serie. Para el centro óptico, deja arriba y abajo márgenes en razón 1 : φ (por ejemplo R2 arriba y R1 abajo).
6. **Documenta la construcción:** en el código, cada medida lleva el nombre de su paso de la serie, para que quien lo lea pueda rehacerla.

## 3. Del trazo a mano al ajuste áureo

El cliente dibuja, el agente mide. Así no se le imponen formas: se le devuelve su propio trazo, exacto.

1. **Copia editable:** entrega una copia del logo con rutas literales en Béziers cúbicos de máximo 90° por tramo (control a `4/3 · tan(θ/4) · r`, ver [círculos y Béziers cúbicos](https://pomax.github.io/bezierinfo/#circles_cubic)), para que el cliente arrastre cada nodo en el editor.
2. **El cliente ajusta a mano** y avisa ("haz el proceso").
3. **Compara:** lee la versión vigente (puede haber cambiado desde tu última lectura) y haz un diff de rutas contra la última copia para saber exactamente qué movió.
4. **Ajusta cada cambio con la serie:** muestrea el trazo, prueba candidatos (radios y posiciones de la serie) y elige el de menor error cuadrático medio. Reporta el número y la causa del residuo ("6.4 RMS, casi todo por la asimetría de los lados").
5. **Aplica sin pisar:** el resultado va al componente áureo, como interruptor con un valor por defecto que conserva lo aprobado. Nunca sobrescribas la hoja a mano del cliente.
6. **Respeta el significado:** si una forma del cliente representa algo (una "capucha" que en realidad es pelo cayendo detrás de la cabeza), ajusta la forma que dibujó. Antes de convertirla en otra cosa, pregunta qué es: un marco parejo alrededor de la cara, por ejemplo, se leyó como papada.

## 4. Pruebas, además de color, monocromo y 256 / 48 / 16 px

- **Escala con números:** el tamaño en pantalla de un detalle es `medida × px ÷ ancho del marco`. Lo que mide menos de 1 px desaparece: un hueco de 10 en un marco de 700 mide 0.7 px a 48 px, y a D7 (16.6) ya mide 1.1 px.
- **Píxeles reales:** muestra el render de 16 px ampliado ×8 con [`image-rendering: pixelated`](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering).
- **Avatar:** la mayoría de las redes recortan el avatar en círculo. Calcula el círculo más chico que contiene la marca y encuadra con un margen de la serie (R4); el círculo inscrito del cuadrado suele cortar las puntas.
- **Fondo oscuro y marca de agua:** versión de un solo color con una [máscara SVG](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/mask) hecha con las mismas figuras (tinta → blanco, papel → negro), para que la cara y los huecos queden calados. Con varias copias en una página, cada máscara necesita un id propio (un hash de lo que dibuja).
- **Maqueta de uso:** prueba el logo donde va a vivir (avatar, encabezado, marca de agua al 10–25 % sobre una imagen), no solo aislado.
- **Navegador real:** verifica en un navegador además del rasterizador del script; las uniones de trazo y las máscaras pueden verse distinto.

## 5. Trampas que ya aparecieron

- **Puntas planas:** con `stroke-linejoin: miter`, si `1 / sin(θ/2)` supera [`stroke-miterlimit`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-miterlimit) (4 por defecto), el navegador usa bisel y la punta queda plana. Subir el límite alarga demasiado el pico; mejor tapa la punta y redibuja el contorno con arcos tangentes que cierren en un pico corto (R5 más allá de la punta).
- **Cortes rectos sobre curvas:** dejan quiebres y "garras". Corta con arcos tangentes.
- **Líneas finas entre capas:** dos capas que comparten un borde dejan una línea de antialiasing; solápalas unas 4 unidades para que la de arriba la tape.
- **Piezas invisibles que trabajan:** un disco crema sobre fondo crema puede estar tapando colas de otras piezas. Antes de quitar algo que "no se ve", revisa qué cubre.
