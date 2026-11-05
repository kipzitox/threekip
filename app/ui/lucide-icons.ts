import Bookmark from "lucide-react-native/dist/esm/icons/bookmark";
import Box from "lucide-react-native/dist/esm/icons/box";
import ChevronLeft from "lucide-react-native/dist/esm/icons/chevron-left";
import Compass from "lucide-react-native/dist/esm/icons/compass";
import Copy from "lucide-react-native/dist/esm/icons/copy";
import Cpu from "lucide-react-native/dist/esm/icons/cpu";
import Download from "lucide-react-native/dist/esm/icons/download";
import Droplets from "lucide-react-native/dist/esm/icons/droplets";
import Eraser from "lucide-react-native/dist/esm/icons/eraser";
import FileBox from "lucide-react-native/dist/esm/icons/file-box";
import FilePlus from "lucide-react-native/dist/esm/icons/file-plus";
import FileStack from "lucide-react-native/dist/esm/icons/file-stack";
import FolderOpen from "lucide-react-native/dist/esm/icons/folder-open";
import GitMerge from "lucide-react-native/dist/esm/icons/git-merge";
import Globe from "lucide-react-native/dist/esm/icons/globe";
import Grid3x3 from "lucide-react-native/dist/esm/icons/grid-3x3";
import Hand from "lucide-react-native/dist/esm/icons/hand";
import Heart from "lucide-react-native/dist/esm/icons/heart";
import Image from "lucide-react-native/dist/esm/icons/image";
import Layers from "lucide-react-native/dist/esm/icons/layers";
import LayoutGrid from "lucide-react-native/dist/esm/icons/layout-grid";
import Locate from "lucide-react-native/dist/esm/icons/locate";
import Menu from "lucide-react-native/dist/esm/icons/menu";
import Moon from "lucide-react-native/dist/esm/icons/moon";
import MousePointer2 from "lucide-react-native/dist/esm/icons/mouse-pointer-2";
import Move3d from "lucide-react-native/dist/esm/icons/move-3d";
import Orbit from "lucide-react-native/dist/esm/icons/orbit";
import Palette from "lucide-react-native/dist/esm/icons/palette";
import Pencil from "lucide-react-native/dist/esm/icons/pencil";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Redo from "lucide-react-native/dist/esm/icons/redo";
import Save from "lucide-react-native/dist/esm/icons/save";
import Scaling from "lucide-react-native/dist/esm/icons/scaling";
import Share from "lucide-react-native/dist/esm/icons/share";
import Share2 from "lucide-react-native/dist/esm/icons/share-2";
import Square from "lucide-react-native/dist/esm/icons/square";
import Star from "lucide-react-native/dist/esm/icons/star";
import SunMoon from "lucide-react-native/dist/esm/icons/sun-moon";
import Target from "lucide-react-native/dist/esm/icons/target";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import Undo from "lucide-react-native/dist/esm/icons/undo";
import Video from "lucide-react-native/dist/esm/icons/video";
import ZoomIn from "lucide-react-native/dist/esm/icons/zoom-in";
import ZoomOut from "lucide-react-native/dist/esm/icons/zoom-out";

/**
 * Iconos de lucide usados por la app, indexados por el nombre que recibe <Icon />.
 *
 * Cada icono se importa por su ruta profunda en lugar de desde la raiz del
 * paquete. `lucide-react-native` reexporta ~1535 iconos desde su index, y Metro
 * no hace tree-shaking de ESM: importar desde la raiz arrastraba los 1535 al
 * bundle (2.18 MB -> 3.75 MB) aunque solo se usen 44. Con estas rutas solo
 * entran los que la app necesita.
 *
 * La version de lucide esta fijada en package.json porque estos paths apuntan a
 * `dist/esm`, que es interno del paquete: un cambio de version podria moverlos.
 *
 * Si agregas un icono nuevo: importalo aqui con su kebab-case y agregalo al mapa.
 */
export const lucideIcons = {
  Bookmark,
  Box,
  ChevronLeft,
  Compass,
  Copy,
  Cpu,
  Download,
  Droplets,
  Eraser,
  FileBox,
  FilePlus,
  FileStack,
  FolderOpen,
  GitMerge,
  Globe,
  Grid3x3,
  Hand,
  Heart,
  Image,
  Layers,
  LayoutGrid,
  Locate,
  Menu,
  Moon,
  MousePointer2,
  Move3d,
  Orbit,
  Palette,
  Pencil,
  Plus,
  Redo,
  Save,
  Scaling,
  Share,
  Share2,
  Square,
  Star,
  SunMoon,
  Target,
  Trash2,
  TriangleAlert,
  Undo,
  Video,
  ZoomIn,
  ZoomOut,
} as const;

export type LucideIconName = keyof typeof lucideIcons;
