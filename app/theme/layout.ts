import { useWindowDimensions } from 'react-native';
import { spacing } from './spacing';

/**
 * Umbrales de ancho compartidos por toda la app.
 *
 * Antes cada pantalla comparaba `width` contra numeros sueltos (540, 768,
 * 1024), asi que un cambio de criterio habia que repetirlo en varios archivos y
 * era facil que dos pantallas empezaran a romperse en tamanos distintos.
 */
export const breakpoints = {
  /** Telefonos en vertical. */
  phone: 540,
  /** Tablets y telefonos en horizontal. */
  tablet: 768,
  /** Tablets grandes o ventanas de escritorio. */
  wide: 1024,
  /** Pantallas de escritorio muy anchas. */
  desktop: 1440,
} as const;

/**
 * Ancho maximo del contenido centrado. Sin esto, en una tablet las tarjetas y
 * los parrafos se estiran hasta los bordes y las lineas de texto se vuelven
 * incomodas de leer.
 */
export const contentMaxWidth = {
  /** Formularios, ajustes y textos: una sola columna legible. */
  narrow: 760,
  /** Rejillas de proyectos, donde conviene aprovechar el ancho. */
  wide: 1280,
} as const;

/**
 * Medidas reactivas al tamano de la ventana. Se recalcula solo cuando cambia el
 * tamano (rotacion, ventana redimensionada, modo dividido en tablet).
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isPhone = width < breakpoints.phone;
  const isTablet = width >= breakpoints.tablet;
  const isWide = width >= breakpoints.wide;

  /**
   * Margen lateral del contenido: ajustado en telefono, comodo en tablet y
   * amplio en pantallas grandes, donde el aire extra ayuda a leer.
   */
  const gutter = isPhone ? spacing.md : isWide ? spacing.xl : spacing.lg;

  return { width, height, isPhone, isTablet, isWide, gutter };
}
