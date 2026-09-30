declare module "lucide-react-native/dist/esm/icons/*" {
  import type { ForwardRefExoticComponent } from "react";
  import type { SvgProps } from "react-native-svg";

  export interface LucideIconProps extends SvgProps {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  }

  const Icon: ForwardRefExoticComponent<LucideIconProps>;
  export default Icon;
}
