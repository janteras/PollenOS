// Primary UI Color Palette
export const theme = {
  colors: {
    // Base colors
    transparent: 'rgba(0, 0, 0, 0)',
    dark: 'rgb(37, 37, 37)',
    light: 'rgb(247, 248, 250)',
    background: 'rgb(235, 238, 243)',
    semiTransparent: 'rgba(255, 255, 255, 0.75)',
    primary: 'rgb(222, 45, 79)',

    // Derived colors
    primaryLight: 'rgba(222, 45, 79, 0.8)',
    primaryDark: 'rgba(222, 45, 79, 0.95)',
    primaryHover: 'rgba(222, 45, 79, 0.9)',
    primaryActive: 'rgba(222, 45, 79, 1)',

    // Text colors
    textPrimary: 'rgb(37, 37, 37)',
    textSecondary: 'rgba(37, 37, 37, 0.7)',
    textMuted: 'rgba(37, 37, 37, 0.5)',
    textDisabled: 'rgba(37, 37, 37, 0.3)',

    // Border colors
    border: 'rgba(37, 37, 37, 0.1)',
    borderHover: 'rgba(37, 37, 37, 0.2)',
    borderActive: 'rgba(37, 37, 37, 0.3)',

    // State colors
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',

    // Chart colors
    chart: {
      primary: 'rgb(222, 45, 79)',
      secondary: 'rgb(37, 37, 37)',
      tertiary: 'rgb(247, 248, 250)',
      background: 'rgb(235, 238, 243)',
      grid: 'rgba(37, 37, 37, 0.1)',
      axis: 'rgba(37, 37, 37, 0.3)'
    }
  },

  // Typography
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: '14px',
    fontWeight: {
      regular: 400,
      medium: 500,
      bold: 600
    },
    lineHeight: 1.5
  },

  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },

  // Components
  components: {
    button: {
      primary: {
        background: 'rgb(222, 45, 79)',
        color: 'white',
        hover: {
          background: 'rgba(222, 45, 79, 0.9)',
          color: 'white'
        },
        active: {
          background: 'rgba(222, 45, 79, 1)',
          color: 'white'
        }
      },
      secondary: {
        background: 'transparent',
        color: 'rgb(37, 37, 37)',
        border: '1px solid rgba(37, 37, 37, 0.1)',
        hover: {
          background: 'rgba(37, 37, 37, 0.05)',
          color: 'rgb(37, 37, 37)'
        }
      }
    },
    card: {
      background: 'rgb(247, 248, 250)',
      border: '1px solid rgba(37, 37, 37, 0.1)',
      shadow: '0 2px 4px rgba(37, 37, 37, 0.05)'
    },
    chart: {
      background: 'rgb(235, 238, 243)',
      border: '1px solid rgba(37, 37, 37, 0.1)',
      padding: '16px'
    }
  },

  // Breakpoints
  breakpoints: {
    xs: '0px',
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
    xxl: '1400px'
  }
};

// Export CSS variables
export const cssVariables = {
  '--theme-dark': theme.colors.dark,
  '--theme-light': theme.colors.light,
  '--theme-background': theme.colors.background,
  '--theme-primary': theme.colors.primary,
  '--theme-primary-light': theme.colors.primaryLight,
  '--theme-primary-dark': theme.colors.primaryDark,
  '--theme-text-primary': theme.colors.textPrimary,
  '--theme-text-secondary': theme.colors.textSecondary,
  '--theme-border': theme.colors.border,
  '--theme-chart-primary': theme.colors.chart.primary,
  '--theme-chart-background': theme.colors.chart.background
};

// Apply CSS variables to root
export const applyTheme = () => {
  Object.entries(cssVariables).forEach(([variable, value]) => {
    document.documentElement.style.setProperty(variable, value);
  });
};
