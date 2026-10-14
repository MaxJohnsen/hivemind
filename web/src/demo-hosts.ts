// Approximate host styles for previewing the card outside a real assistant. In a real
// conversation the host sends its own values through MCP Apps.
export const demoHosts: Record<string, { label: string; theme: 'light' | 'dark'; variables: Record<string, string> }> = {
  'claude-light': {
    label: 'Claude, light',
    theme: 'light',
    variables: {
      '--color-background-primary': '#ffffff',
      '--color-background-secondary': '#f5f4ed',
      '--color-text-primary': '#141413',
      '--color-text-secondary': '#5e5d59',
      '--color-border-primary': '#e8e6dc',
      '--color-border-secondary': '#a3a198',
      '--font-sans': 'ui-sans-serif, system-ui, sans-serif',
      '--border-radius-lg': '12px',
    },
  },
  'claude-dark': {
    label: 'Claude, dark',
    theme: 'dark',
    variables: {
      '--color-background-primary': '#30302e',
      '--color-background-secondary': '#262624',
      '--color-text-primary': '#faf9f5',
      '--color-text-secondary': '#b7b5a9',
      '--color-border-primary': '#4a4945',
      '--color-border-secondary': '#8a8880',
      '--font-sans': 'ui-sans-serif, system-ui, sans-serif',
      '--border-radius-lg': '12px',
    },
  },
  'chatgpt-light': {
    label: 'ChatGPT, light',
    theme: 'light',
    variables: {
      '--color-background-primary': '#ffffff',
      '--color-background-secondary': '#f4f4f4',
      '--color-text-primary': '#0d0d0d',
      '--color-text-secondary': '#5d5d5d',
      '--color-border-primary': '#e5e5e5',
      '--color-border-secondary': '#9b9b9b',
      '--font-sans': 'ui-sans-serif, -apple-system, system-ui, "Segoe UI", sans-serif',
      '--border-radius-lg': '16px',
    },
  },
};

export const hostBackground: Record<string, string> = {
  'claude-light': '#faf9f5',
  'claude-dark': '#262624',
  'chatgpt-light': '#ffffff',
};
