

# Fix: Busqueda de contactos ignora filtro de categoria

## Problema

Tanto "Xuso Carbonell" como "Raul Agustito" existen en la base de datos pero no aparecen al buscarlos porque el filtro de categoria (personal/familiar/profesional) se aplica incluso cuando hay texto en la barra de busqueda.

## Solucion

Un cambio de 1 linea en `src/pages/StrategicNetwork.tsx` (linea 1487):

**Antes:**
```text
if (categoryFilter !== 'all' && (c.category || 'profesional') !== categoryFilter) return false;
```

**Despues:**
```text
if (!search && categoryFilter !== 'all' && (c.category || 'profesional') !== categoryFilter) return false;
```

Cuando escribes un nombre en la busqueda, se busca en TODOS los contactos sin importar la categoria. Cuando no hay busqueda, los filtros siguen funcionando igual.

