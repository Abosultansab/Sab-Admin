import React from "react";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";

type Props = { size?: number; color?: string } & Record<string, any>;

const makeFeather = (name: React.ComponentProps<typeof Feather>["name"]) => {
  const Component = (props: Props) => {
    const { size = 20, color = "#111827", ...rest } = props;
    return <Feather name={name} size={size} color={color} {...rest} />;
  };
  Component.displayName = `Feather(${name})`;
  return Component;
};

const makeIon = (name: React.ComponentProps<typeof Ionicons>["name"]) => {
  const Component = (props: Props) => {
    const { size = 20, color = "#111827", ...rest } = props;
    return <Ionicons name={name} size={size} color={color} {...rest} />;
  };
  Component.displayName = `Ionicons(${name})`;
  return Component;
};

const makeMaterial = (name: React.ComponentProps<typeof MaterialIcons>["name"]) => {
  const Component = (props: Props) => {
    const { size = 20, color = "#111827", ...rest } = props;
    return <MaterialIcons name={name} size={size} color={color} {...rest} />;
  };
  Component.displayName = `MaterialIcons(${name})`;
  return Component;
};

export const Mail = makeFeather("mail");
export const Eye = makeFeather("eye");
export const EyeOff = makeFeather("eye-off");
export const ArrowLeft = makeFeather("arrow-left");
export const Phone = makeFeather("phone");
export const Lock = makeFeather("lock");
export const ChevronDown = makeFeather("chevron-down");
export const User = makeFeather("user");
export const MapPin = makeFeather("map-pin");
export const CreditCard = makeFeather("credit-card");
export const Globe = makeFeather("globe");
export const DollarSign = makeFeather("dollar-sign");
export const HelpCircle = makeFeather("help-circle");
export const FileText = makeFeather("file-text");
export const Shield = makeFeather("shield");
export const MessageCircle = makeFeather("message-circle");
export const Info = makeFeather("info");
export const Trash2 = makeFeather("trash-2");
export const LogOut = makeFeather("log-out");
export const ChevronRight = makeFeather("chevron-right");
export const Edit2 = makeFeather("edit-2");
export const Plus = makeFeather("plus");
export const ChevronLeft = makeFeather("chevron-left");
export const ShoppingCart = makeFeather("shopping-cart");
export const Minus = makeFeather("minus");
export const ArrowRight = makeFeather("arrow-right");
export const Clock = makeFeather("clock");
export const Camera = makeFeather("camera");
export const X = makeFeather("x");
export const Zap = makeFeather("zap");
export const Search = makeFeather("search");
export const Package = makeFeather("package");
export const Edit = makeFeather("edit");
export const Tag = makeFeather("tag");
export const Upload = makeFeather("upload");
export const Folder = makeFeather("folder");
export const ArrowUp = makeFeather("arrow-up");
export const ArrowDown = makeFeather("arrow-down");
export const Truck = makeFeather("truck");
export const CheckCircle = makeFeather("check-circle");
export const XCircle = makeFeather("x-circle");
export const FileCheck = makeFeather("file-text");
export const AlertCircle = makeFeather("alert-circle");
export const Navigation = makeIon("navigate");
export const Users = makeFeather("users");
export const UserCheck = makeFeather("user-check");
export const UserX = makeFeather("user-x");
export const RefreshCw = makeFeather("refresh-cw");
export const Moon = makeFeather("moon");
export const Sun = makeFeather("sun");
export const LayoutDashboard = makeMaterial("dashboard");
export const Menu = makeFeather("menu");
export const ChefHat = makeIon("restaurant");
export const Building2 = makeMaterial("business");

export const Facebook = makeIon("logo-facebook");
export const Palette = makeIon("color-palette");
export const TrendingUp = makeFeather("trending-up");
