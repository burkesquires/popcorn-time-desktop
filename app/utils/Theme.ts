import { remote } from "electron";
import { EventEmitter } from "events";

export const lightTheme = {
  "body-bg": "#fff",
  "body-color": "#212529",
  "input-bg": "#fff",
  "input-border-color": "#ced4da",
  "input-group-addon-bg": "#e9ecef",
  "input-color": "#495057",
  "list-group-border-color": "rgba(0, 0, 0, 0.125)",
  "list-group-hover-bg": "#f8f9fa",
  "list-group-bg": "#fff",
  "card-bg": "#fff",
  "card-border-color": "rgba(0, 0, 0, 0.125)",
  "component-active-bg": "#007bff",
  "navbar-dark-color": "hsla(0, 0%, 100%, 0.5)",
  "headings-color": "gray",
  "link-color": "black",
  blue: "#007bff",
  indigo: "#6610f2",
  purple: "#6f42c1",
  pink: "#e83e8c",
  red: "#dc3545",
  orange: "#fd7e14",
  yellow: "#ffc107",
  green: "#28a745",
  teal: "#20c997",
  cyan: "#17a2b8",
  white: "#fff",
  gray: "#6c757d",
  "gray-dark": "#343a40",
  primary: "#007bff",
  secondary: "#6c757d",
  success: "#28a745",
  info: "#17a2b8",
  warning: "#ffc107",
  danger: "#dc3545",
  light: "#f8f9fa",
  dark: "#343a40",
  "modal-content-bg": "white",
};

export const darkTheme = {
  "bg-dark": "#1b1b1b",
  gray: "#303030",
  "gray-dark": "#151515",
  "gray-light": "gray",
  "gray-lighter": "gray",
  "gray-lightest": "gray",

  // Base
  "body-bg": "#252525",
  "body-color": "white",
  "link-color": "white",
  "brand-primary": "white",

  // Navbar
  dark: "#151515",

  // Input
  "input-bg": "rgb(53, 53, 53)",
  "input-border-color": "rgb(53, 53, 53)",
  "input-group-addon-bg": "rgb(53, 53, 53)",
  "input-color": "white",

  // List Group
  "list-group-border-color": "black",
  "list-group-link-color": "white",
  "list-group-hover-bg": "#333",
  "list-group-active-border": "black",
  "list-group-bg": "#484848",

  // Card
  "card-bg": "#484848",
  "card-border-color": "none",
  "card-color": "white",

  // Components
  "component-active-bg": "gray",
  "headings-color": "white",
  "navbar-dark-color": "#848484",
  "modal-content-bg": "#343a40",
};

export enum Theme {
  Light = "light",
  Dark = "dark",
}

export enum ThemeWithSystem {
  Light = "light",
  Dark = "dark",
  System = "system",
}

export type ManagerTheme = {
  id: string;
  name: string;
  colors: Record<string, string>;
};

const { nativeTheme } = remote;

export default class ThemeManager extends EventEmitter {
  private theme: ThemeWithSystem = ThemeWithSystem.System;

  private systemTheme: Theme;

  static themes: ManagerTheme[] = [
    {
      name: "Light",
      id: "light",
      colors: lightTheme,
    },
    {
      name: "Dark",
      id: "dark",
      colors: darkTheme,
    },
    {
      name: "System",
      id: "system",
      colors: {},
    },
  ];

  constructor(themeId: ThemeWithSystem = ThemeWithSystem.System) {
    super();
    this.theme = themeId;
    this.systemTheme = nativeTheme.shouldUseDarkColors
      ? Theme.Dark
      : Theme.Light;

    this.change(this.theme);

    nativeTheme.on("updated", () => {
      if (this.theme === ThemeWithSystem.System) {
        this.systemTheme = nativeTheme.shouldUseDarkColors
          ? Theme.Dark
          : Theme.Light;
        this.change(ThemeWithSystem.System);
      }
      this.emit("themeChanged");
    });
  }

  cleanup() {
    nativeTheme.removeAllListeners();
    this.removeAllListeners();
  }

  getTheme(): Theme {
    return this.theme === ThemeWithSystem.System
      ? this.systemTheme
      : this.theme;
  }

  change(themeId: ThemeWithSystem) {
    this.theme = themeId;
    if (themeId === ThemeWithSystem.System) {
      // eslint-disable-next-line no-param-reassign
      themeId = this.systemTheme;
    }

    const theme = ThemeManager.themes.find((_theme) => _theme.id === themeId);
    if (!theme) {
      throw new Error(`Theme "${themeId}" not found`);
    }

    const { colors } = theme;
    Object.entries(colors).forEach(([cssVar, value]) => {
      document.documentElement.style.setProperty(`--${cssVar}`, value);
    });
  }
}
