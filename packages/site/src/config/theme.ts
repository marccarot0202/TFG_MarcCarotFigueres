import type { DefaultTheme } from 'styled-components';
import { createGlobalStyle } from 'styled-components';

const breakpoints = ['600px', '768px', '992px'];

/**
 * Common theme properties.
 */
const theme = {
  fonts: {
    default:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
    code: 'ui-monospace,Menlo,Monaco,"Cascadia Mono","Segoe UI Mono","Roboto Mono","Oxygen Mono","Ubuntu Monospace","Source Code Pro","Fira Mono","Droid Sans Mono","Courier New", monospace',
  },
  fontSizes: {
    heading: '3.2rem',
    mobileHeading: '2.6rem',
    title: '2rem',
    large: '1.8rem',
    text: '1.6rem',
    small: '1.4rem',
  },
  radii: {
    default: '8px',
    button: '6px',
  },
  breakpoints,
  mediaQueries: {
    small: `@media screen and (max-width: ${breakpoints[0] as string})`,
    medium: `@media screen and (min-width: ${breakpoints[1] as string})`,
    large: `@media screen and (min-width: ${breakpoints[2] as string})`,
  },
  shadows: {
    default: '0 1px 2px rgba(31, 35, 40, 0.08)',
    button: '0 1px 2px rgba(31, 35, 40, 0.12)',
  },
};

/**
 * Light theme color properties.
 */
export const light: DefaultTheme = {
  colors: {
    background: {
      default: '#FFFFFF',
      alternative: '#F6F8FA',
      inverse: '#1F2328',
    },
    icon: {
      default: '#141618',
      alternative: '#BBC0C5',
    },
    text: {
      default: '#1F2328',
      muted: '#656D76',
      alternative: '#57606A',
      inverse: '#FFFFFF',
    },
    border: {
      default: '#D0D7DE',
    },
    primary: {
      default: '#0969DA',
      inverse: '#FFFFFF',
    },
    card: {
      default: '#FFFFFF',
    },
    error: {
      default: '#d73a49',
      alternative: '#b92534',
      muted: '#d73a4919',
    },
  },
  ...theme,
};

/**
 * Dark theme color properties
 */
export const dark: DefaultTheme = {
  colors: {
    background: {
      default: '#0D1117',
      alternative: '#161B22',
      inverse: '#FFFFFF',
    },
    icon: {
      default: '#FFFFFF',
      alternative: '#BBC0C5',
    },
    text: {
      default: '#F0F6FC',
      muted: '#8C959F',
      alternative: '#B1BAC4',
      inverse: '#0D1117',
    },
    border: {
      default: '#30363D',
    },
    primary: {
      default: '#58A6FF',
      inverse: '#FFFFFF',
    },
    card: {
      default: '#141618',
    },
    error: {
      default: '#d73a49',
      alternative: '#b92534',
      muted: '#d73a4919',
    },
  },
  ...theme,
};

/**
 * Default style applied to the app.
 *
 * @param props - Styled Components props.
 * @returns Global style React component.
 */
export const GlobalStyle = createGlobalStyle`
  html {
    /* 62.5% of the base size of 16px = 10px.*/
    font-size: 62.5%;
  }

  body {
    background-color: ${(props) => props.theme.colors.background?.default};
    color: ${(props) => props.theme.colors.text?.default};
    font-family: ${(props) => props.theme.fonts.default};
    font-size: ${(props) => props.theme.fontSizes.text};
    margin: 0;
    line-height: 1.5;
  }

  * {
    box-sizing: border-box;
    transition: background-color .1s linear, border-color .1s linear;
  }

  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    letter-spacing: 0;
  }

  code {
    background-color: ${(props) => props.theme.colors.background?.alternative};
    font-family: ${(props) => props.theme.fonts.code};
    padding: 1.2rem;
    font-weight: normal;
    font-size: ${(props) => props.theme.fontSizes.text};
  }

  button {
    font-size: ${(props) => props.theme.fontSizes.small};
    border-radius: ${(props) => props.theme.radii.button};
    background-color: ${(props) => props.theme.colors.background?.inverse};
    color: ${(props) => props.theme.colors.text?.inverse};
    border: 1px solid ${(props) => props.theme.colors.background?.inverse};
    font-weight: bold;
    padding: 1rem;
    min-height: 4.2rem;
    cursor: pointer;
    transition: all .2s ease-in-out;

    &:hover {
      background-color: transparent;
      border: 1px solid ${(props) => props.theme.colors.background?.inverse};
      color: ${(props) => props.theme.colors.text?.default};
    }

    &:disabled,
    &[disabled] {
      border: 1px solid ${(props) => props.theme.colors.background?.inverse};
      cursor: not-allowed;
    }

    &:disabled:hover,
    &[disabled]:hover {
      background-color: ${(props) => props.theme.colors.background?.inverse};
      color: ${(props) => props.theme.colors.text?.inverse};
      border: 1px solid ${(props) => props.theme.colors.background?.inverse};
    }
  }
`;
